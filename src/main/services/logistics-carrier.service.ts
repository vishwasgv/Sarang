import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

export interface CarrierRecord {
  id: string
  name: string
  type: string
  phone: string | null
  email: string | null
  gstNumber: string | null
  ratePerKg: number | null
  ratePerKm: number | null
  notes: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

function toRecord(r: any): CarrierRecord {
  return {
    id: r.id, name: r.name, type: r.type,
    phone: r.phone, email: r.email, gstNumber: r.gstNumber,
    ratePerKg: r.ratePerKg, ratePerKm: r.ratePerKm,
    notes: r.notes, isActive: r.isActive,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  }
}

export async function listCarriers(payload?: { activeOnly?: boolean; offset?: number; limit?: number }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (payload?.activeOnly) where.isActive = true
    const take = Math.min(payload?.limit ?? 500, 500)
    const skip = payload?.offset ?? 0
    const [rows, total] = await Promise.all([
      db.carrier.findMany({ where, orderBy: { name: 'asc' }, skip, take }),
      db.carrier.count({ where }),
    ])
    return { success: true, data: rows.map(toRecord), total }
  } catch (err) {
    return { success: false, error: { code: 'LOG-010', message: err instanceof Error ? err.message : 'Failed to list carriers.' } }
  }
}

export async function createCarrier(payload: {
  name: string; type?: string; phone?: string; email?: string; gstNumber?: string
  ratePerKg?: number; ratePerKm?: number; notes?: string
}, userId?: string) {
  try {
    const db = getPrisma()
    if (!payload.name?.trim()) return { success: false, error: { code: 'VAL-001', message: 'Carrier name is required.' } }
    if ((payload.ratePerKg !== undefined && payload.ratePerKg !== null && payload.ratePerKg < 0) ||
        (payload.ratePerKm !== undefined && payload.ratePerKm !== null && payload.ratePerKm < 0))
      return { success: false, error: { code: 'VAL-002', message: 'Rates cannot be negative.' } }
    const row = await db.carrier.create({
      data: {
        name: payload.name.trim(), type: payload.type ?? 'COURIER',
        phone: payload.phone?.trim() || null, email: payload.email?.trim() || null,
        gstNumber: payload.gstNumber?.trim() || null,
        ratePerKg: payload.ratePerKg ?? null, ratePerKm: payload.ratePerKm ?? null,
        notes: payload.notes?.trim() || null,
      }
    })
    await logAction({ userId, action: 'CREATE', entityType: 'Carrier', entityId: row.id, newValue: { name: row.name } })
    return { success: true, data: toRecord(row) }
  } catch (err: any) {
    if (err?.code === 'P2002') return { success: false, error: { code: 'DUP-001', message: 'A carrier with this name already exists.' } }
    return { success: false, error: { code: 'LOG-011', message: err instanceof Error ? err.message : 'Failed to create carrier.' } }
  }
}

export async function updateCarrier(payload: {
  id: string; name?: string; type?: string; phone?: string; email?: string; gstNumber?: string
  ratePerKg?: number | null; ratePerKm?: number | null; notes?: string; isActive?: boolean
}, userId?: string) {
  try {
    const db = getPrisma()
    if (!payload.id) return { success: false, error: { code: 'VAL-001', message: 'id is required.' } }
    if ((payload.ratePerKg !== undefined && payload.ratePerKg !== null && payload.ratePerKg < 0) ||
        (payload.ratePerKm !== undefined && payload.ratePerKm !== null && payload.ratePerKm < 0))
      return { success: false, error: { code: 'VAL-002', message: 'Rates cannot be negative.' } }
    const row = await db.carrier.update({
      where: { id: payload.id },
      data: {
        ...(payload.name && { name: payload.name.trim() }),
        ...(payload.type && { type: payload.type }),
        ...(payload.phone !== undefined && { phone: payload.phone?.trim() || null }),
        ...(payload.email !== undefined && { email: payload.email?.trim() || null }),
        ...(payload.gstNumber !== undefined && { gstNumber: payload.gstNumber?.trim() || null }),
        ...(payload.ratePerKg !== undefined && { ratePerKg: payload.ratePerKg }),
        ...(payload.ratePerKm !== undefined && { ratePerKm: payload.ratePerKm }),
        ...(payload.notes !== undefined && { notes: payload.notes?.trim() || null }),
        ...(payload.isActive !== undefined && { isActive: payload.isActive }),
      }
    })
    await logAction({ userId, action: 'UPDATE', entityType: 'Carrier', entityId: payload.id })
    return { success: true, data: toRecord(row) }
  } catch (err: any) {
    if (err?.code === 'P2025') return { success: false, error: { code: 'NF-001', message: 'Carrier not found.' } }
    if (err?.code === 'P2002') return { success: false, error: { code: 'DUP-001', message: 'A carrier with this name already exists.' } }
    return { success: false, error: { code: 'LOG-012', message: err instanceof Error ? err.message : 'Failed to update carrier.' } }
  }
}

export async function deleteCarrier(id: string, userId?: string) {
  try {
    const db = getPrisma()
    const shipCount = await db.shipment.count({ where: { carrierId: id } })
    const freightCount = await db.freightLedger.count({ where: { carrierId: id } })
    if (shipCount + freightCount > 0)
      return { success: false, error: { code: 'REF-001', message: `Cannot delete: ${shipCount} shipment(s) and ${freightCount} freight entry/entries reference this carrier.` } }
    const existing = await db.carrier.findUnique({ where: { id } })
    await db.carrier.delete({ where: { id } })
    await logAction({ userId, action: 'DELETE', entityType: 'Carrier', entityId: id, oldValue: { name: existing?.name } })
    return { success: true }
  } catch (err: any) {
    if (err?.code === 'P2025') return { success: false, error: { code: 'NF-001', message: 'Carrier not found.' } }
    return { success: false, error: { code: 'LOG-013', message: err instanceof Error ? err.message : 'Failed to delete carrier.' } }
  }
}

export async function toggleCarrierActive(id: string, userId?: string) {
  try {
    const db = getPrisma()
    const existing = await db.carrier.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'NF-001', message: 'Carrier not found.' } }
    const row = await db.carrier.update({ where: { id }, data: { isActive: !existing.isActive } })
    await logAction({ userId, action: 'STATUS_CHANGE', entityType: 'Carrier', entityId: id, newValue: { isActive: row.isActive } })
    return { success: true, data: toRecord(row) }
  } catch (err) {
    return { success: false, error: { code: 'LOG-014', message: err instanceof Error ? err.message : 'Failed to toggle carrier status.' } }
  }
}
