import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

// Phase 68 §9.1 — Beauty Salon item 5: service-combo package builder. A
// combo bundles N ServiceCatalog entries at one package price, typically
// below the sum of the members' own basePrice. Booking a combo (via
// resolveComboServices below) expands it into the SAME multi-service JSON
// shape appointment.service.ts already uses for a plain multi-service
// booking — no changes needed anywhere downstream (invoicing, reports),
// since a combo becomes indistinguishable from an ad-hoc multi-service
// selection the moment it's expanded, just with package-scaled prices.

export interface ServiceComboRecord {
  id: string
  comboName: string
  description: string | null
  comboPrice: number
  isActive: boolean
  memberBasePriceTotal: number
  services: Array<{ id: string; serviceName: string; basePrice: number }>
}

function toRecord(row: {
  id: string; comboName: string; description: string | null; comboPrice: number; isActive: boolean
  items: Array<{ serviceCatalog: { id: string; serviceName: string; basePrice: number } }>
}): ServiceComboRecord {
  const services = row.items.map((i) => i.serviceCatalog)
  return {
    id: row.id, comboName: row.comboName, description: row.description,
    comboPrice: row.comboPrice, isActive: row.isActive,
    memberBasePriceTotal: services.reduce((s, svc) => s + svc.basePrice, 0),
    services,
  }
}

const include = { items: { include: { serviceCatalog: { select: { id: true, serviceName: true, basePrice: true } } } } }

export async function listServiceCombos(filters?: { activeOnly?: boolean }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.activeOnly) where.isActive = true
    const rows = await db.serviceCombo.findMany({ where, include, orderBy: { comboName: 'asc' } })
    return { success: true, data: rows.map(toRecord) }
  } catch (err) {
    return { success: false, error: { code: 'SVC-001', message: err instanceof Error ? err.message : 'Could not list service combos.' } }
  }
}

export async function createServiceCombo(
  payload: { comboName: string; description?: string; comboPrice: number; serviceCatalogIds: string[] },
  userId?: string
) {
  try {
    if (!payload.comboName?.trim()) return { success: false, error: { code: 'SVC-002', message: 'Combo name is required.' } }
    if (payload.comboPrice <= 0) return { success: false, error: { code: 'SVC-003', message: 'Combo price must be greater than zero.' } }
    const uniqueIds = Array.from(new Set(payload.serviceCatalogIds))
    if (uniqueIds.length < 2) return { success: false, error: { code: 'SVC-004', message: 'A combo needs at least 2 distinct services.' } }

    const db = getPrisma()
    const found = await db.serviceCatalog.findMany({ where: { id: { in: uniqueIds }, isActive: true }, select: { id: true } })
    if (found.length !== uniqueIds.length) return { success: false, error: { code: 'SVC-005', message: 'One or more selected services could not be found.' } }

    const combo = await db.$transaction(async (tx) => {
      const created = await tx.serviceCombo.create({
        data: { comboName: payload.comboName.trim(), description: payload.description?.trim() || null, comboPrice: payload.comboPrice },
      })
      await tx.serviceComboItem.createMany({ data: uniqueIds.map((serviceCatalogId) => ({ comboId: created.id, serviceCatalogId })) })
      return tx.serviceCombo.findUniqueOrThrow({ where: { id: created.id }, include })
    })

    await logAction({ userId, action: 'SERVICE_COMBO_CREATED', entityType: 'ServiceCombo', entityId: combo.id, newValue: { comboName: combo.comboName } })
    return { success: true, data: toRecord(combo) }
  } catch (err) {
    return { success: false, error: { code: 'SVC-006', message: err instanceof Error ? err.message : 'Could not create service combo.' } }
  }
}

export async function updateServiceCombo(
  payload: { id: string; comboName?: string; description?: string | null; comboPrice?: number; isActive?: boolean; serviceCatalogIds?: string[] },
  userId?: string
) {
  try {
    const db = getPrisma()
    const existing = await db.serviceCombo.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'SVC-007', message: 'Service combo not found.' } }
    if (payload.comboPrice !== undefined && payload.comboPrice <= 0) return { success: false, error: { code: 'SVC-003', message: 'Combo price must be greater than zero.' } }

    let uniqueIds: string[] | undefined
    if (payload.serviceCatalogIds !== undefined) {
      uniqueIds = Array.from(new Set(payload.serviceCatalogIds))
      if (uniqueIds.length < 2) return { success: false, error: { code: 'SVC-004', message: 'A combo needs at least 2 distinct services.' } }
      const found = await db.serviceCatalog.findMany({ where: { id: { in: uniqueIds }, isActive: true }, select: { id: true } })
      if (found.length !== uniqueIds.length) return { success: false, error: { code: 'SVC-005', message: 'One or more selected services could not be found.' } }
    }

    const combo = await db.$transaction(async (tx) => {
      await tx.serviceCombo.update({
        where: { id: payload.id },
        data: {
          comboName: payload.comboName?.trim(),
          description: payload.description !== undefined ? (payload.description?.trim() || null) : undefined,
          comboPrice: payload.comboPrice,
          isActive: payload.isActive,
        },
      })
      if (uniqueIds) {
        await tx.serviceComboItem.deleteMany({ where: { comboId: payload.id } })
        await tx.serviceComboItem.createMany({ data: uniqueIds.map((serviceCatalogId) => ({ comboId: payload.id, serviceCatalogId })) })
      }
      return tx.serviceCombo.findUniqueOrThrow({ where: { id: payload.id }, include })
    })

    await logAction({ userId, action: 'SERVICE_COMBO_UPDATED', entityType: 'ServiceCombo', entityId: payload.id, oldValue: existing })
    return { success: true, data: toRecord(combo) }
  } catch (err) {
    return { success: false, error: { code: 'SVC-008', message: err instanceof Error ? err.message : 'Could not update service combo.' } }
  }
}

export async function deleteServiceCombo(id: string, userId?: string) {
  try {
    const db = getPrisma()
    const existing = await db.serviceCombo.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'SVC-007', message: 'Service combo not found.' } }
    // Soft delete, same convention every other shop-defined "definition" row
    // in this codebase uses — an appointment already booked from this combo
    // keeps its own already-expanded services JSON, unaffected either way.
    await db.serviceCombo.update({ where: { id }, data: { isActive: false } })
    await logAction({ userId, action: 'SERVICE_COMBO_DELETED', entityType: 'ServiceCombo', entityId: id, oldValue: existing })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'SVC-009', message: err instanceof Error ? err.message : 'Could not delete service combo.' } }
  }
}

// Booking-form-facing: expand a combo into the exact multi-service JSON
// shape Appointment.services already uses, with each member's own price
// scaled DOWN proportionally from comboPrice by its basePrice weight (so
// the combo's real discount is baked into the per-line prices, and
// invoicing needs zero special-casing for a combo-originated appointment).
// A member priced at 0 in a mixed combo stays at 0 (a genuinely free
// add-on should stay free) -- the equal-split fallback below only kicks in
// when EVERY member is priced at 0, so the combo price is never silently
// dropped entirely.
export async function resolveComboServices(comboId: string) {
  try {
    const db = getPrisma()
    const combo = await db.serviceCombo.findUnique({ where: { id: comboId }, include })
    if (!combo) return { success: false, error: { code: 'SVC-007', message: 'Service combo not found.' } }
    if (!combo.isActive) return { success: false, error: { code: 'SVC-010', message: 'This combo is no longer active.' } }

    const services = combo.items.map((i) => i.serviceCatalog)
    const totalBasePrice = services.reduce((s, svc) => s + svc.basePrice, 0)
    const round2 = (n: number) => Math.round(n * 100) / 100

    const priced = services.map((svc) => ({
      id: svc.id,
      name: svc.serviceName,
      price: totalBasePrice > 0
        ? round2((svc.basePrice / totalBasePrice) * combo.comboPrice)
        : round2(combo.comboPrice / services.length),
    }))
    // Rounding can leave the sum a few paise off comboPrice — correct it on
    // the last line so the appointment's own total always matches exactly.
    const roundedSum = priced.reduce((s, p) => s + p.price, 0)
    const drift = round2(combo.comboPrice - roundedSum)
    if (drift !== 0 && priced.length > 0) priced[priced.length - 1].price = round2(priced[priced.length - 1].price + drift)

    return { success: true, data: { comboName: combo.comboName, services: priced } }
  } catch (err) {
    return { success: false, error: { code: 'SVC-011', message: err instanceof Error ? err.message : 'Could not resolve combo services.' } }
  }
}

export const serviceComboService = {
  listServiceCombos,
  createServiceCombo,
  updateServiceCombo,
  deleteServiceCombo,
  resolveComboServices,
}
