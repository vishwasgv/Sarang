import { getPrisma } from '../database/db'
import { parseLocalDateStart } from '../utils/date.util'

// Phase 68 §9.1 — Photo Studio item 3: studio-owned equipment rental-and-
// return tracking. Reuses FixedAsset as the equipment registry (a camera/
// lens/drone the studio owns IS a fixed asset) — this is the checkout/
// return EVENT log on top of it, not a parallel "Equipment" entity.

const INCLUDE = {
  fixedAsset: { select: { id: true, assetName: true, assetCode: true, category: true } },
  shootBooking: { select: { id: true, shootType: true, shootDate: true } },
  checkedOutTo: { select: { id: true, fullName: true } },
} as const

export async function listEquipmentCheckouts(filters?: { fixedAssetId?: string; shootBookingId?: string; outstandingOnly?: boolean }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.fixedAssetId) where.fixedAssetId = filters.fixedAssetId
    if (filters?.shootBookingId) where.shootBookingId = filters.shootBookingId
    if (filters?.outstandingOnly) where.actualReturnDate = null
    const checkouts = await db.equipmentCheckout.findMany({ where, include: INCLUDE, orderBy: { checkedOutDate: 'desc' } })
    return { success: true, data: checkouts }
  } catch (err) {
    return { success: false, error: { code: 'EQC-001', message: err instanceof Error ? err.message : 'Could not list equipment checkouts.' } }
  }
}

export async function checkOutEquipment(payload: {
  fixedAssetId: string
  shootBookingId?: string
  checkedOutToId?: string
  checkedOutDate: string
  expectedReturnDate?: string
  notes?: string
}) {
  try {
    if (!payload.checkedOutDate) return { success: false, error: { code: 'EQC-002', message: 'Checkout date is required.' } }
    const db = getPrisma()
    const asset = await db.fixedAsset.findUnique({ where: { id: payload.fixedAssetId }, select: { id: true, status: true } })
    if (!asset) return { success: false, error: { code: 'EQC-003', message: 'Equipment (fixed asset) not found.' } }
    if (asset.status === 'DISPOSED') return { success: false, error: { code: 'EQC-004', message: 'This equipment has been disposed and cannot be checked out.' } }

    const checkout = await db.equipmentCheckout.create({
      data: {
        fixedAssetId: payload.fixedAssetId,
        shootBookingId: payload.shootBookingId ?? null,
        checkedOutToId: payload.checkedOutToId ?? null,
        checkedOutDate: parseLocalDateStart(payload.checkedOutDate),
        expectedReturnDate: payload.expectedReturnDate ? parseLocalDateStart(payload.expectedReturnDate) : null,
        notes: payload.notes ?? null,
      },
      include: INCLUDE,
    })
    await db.auditLog.create({ data: { action: 'CREATE', entityType: 'EquipmentCheckout', entityId: checkout.id, newValue: JSON.stringify({ fixedAssetId: checkout.fixedAssetId }) } }).catch(() => {})
    return { success: true, data: checkout }
  } catch (err) {
    return { success: false, error: { code: 'EQC-005', message: err instanceof Error ? err.message : 'Could not check out equipment.' } }
  }
}

export async function returnEquipment(payload: { id: string; actualReturnDate: string; notes?: string }) {
  try {
    if (!payload.actualReturnDate) return { success: false, error: { code: 'EQC-006', message: 'Return date is required.' } }
    const db = getPrisma()
    const checkout = await db.equipmentCheckout.update({
      where: { id: payload.id },
      data: {
        actualReturnDate: parseLocalDateStart(payload.actualReturnDate),
        ...(payload.notes !== undefined ? { notes: payload.notes } : {}),
      },
      include: INCLUDE,
    })
    await db.auditLog.create({ data: { action: 'RETURNED', entityType: 'EquipmentCheckout', entityId: checkout.id } }).catch(() => {})
    return { success: true, data: checkout }
  } catch (err) {
    return { success: false, error: { code: 'EQC-007', message: err instanceof Error ? err.message : 'Could not record equipment return.' } }
  }
}

export async function deleteEquipmentCheckout(id: string) {
  try {
    const db = getPrisma()
    await db.equipmentCheckout.delete({ where: { id } })
    await db.auditLog.create({ data: { action: 'DELETE', entityType: 'EquipmentCheckout', entityId: id } }).catch(() => {})
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'EQC-008', message: err instanceof Error ? err.message : 'Could not delete equipment checkout.' } }
  }
}
