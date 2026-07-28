import { getPrisma } from '../database/db'
import { sumCurrency } from './currency.service'

// ShootAddOnItem.unitPrice is a Prisma Decimal field — Electron's IPC
// (structured clone) cannot serialize a Decimal instance.
function serializeAddOn<T extends { unitPrice: unknown }>(a: T): T {
  return { ...a, unitPrice: Number(a.unitPrice) }
}

export async function listShootAddOns(shootBookingId: string) {
  const db = getPrisma()
  const items = await db.shootAddOnItem.findMany({
    where: { shootBookingId },
    orderBy: { createdAt: 'asc' },
  })
  return { success: true, data: items.map(serializeAddOn) }
}

export async function addShootAddOn(payload: { shootBookingId: string; description: string; quantity?: number; unitPrice: number }) {
  if (!payload.description || !payload.description.trim()) {
    return { success: false, error: { code: 'SAO-001', message: 'Add-on description is required.' } }
  }
  const quantity = payload.quantity ?? 1
  if (quantity <= 0) return { success: false, error: { code: 'SAO-002', message: 'Quantity must be at least 1.' } }
  if (payload.unitPrice == null || payload.unitPrice < 0) {
    return { success: false, error: { code: 'SAO-003', message: 'Unit price cannot be negative.' } }
  }
  const db = getPrisma()
  const booking = await db.shootBooking.findUnique({ where: { id: payload.shootBookingId } })
  if (!booking) return { success: false, error: { code: 'SAO-004', message: 'Shoot booking not found.' } }
  if (booking.invoiceId) return { success: false, error: { code: 'SAO-005', message: 'This booking is already invoiced — cannot add more add-on items.' } }
  const item = await db.shootAddOnItem.create({
    data: {
      shootBookingId: payload.shootBookingId,
      description: payload.description.trim(),
      quantity,
      unitPrice: payload.unitPrice,
    },
  })
  return { success: true, data: serializeAddOn(item) }
}

export async function deleteShootAddOn(id: string) {
  const db = getPrisma()
  const item = await db.shootAddOnItem.findUnique({ where: { id }, include: { shootBooking: { select: { invoiceId: true } } } })
  if (item?.shootBooking.invoiceId) {
    return { success: false, error: { code: 'SAO-006', message: 'This booking is already invoiced — cannot remove add-on items.' } }
  }
  await db.shootAddOnItem.delete({ where: { id } })
  return { success: true, data: { id } }
}

export async function getShootAddOnsTotal(shootBookingId: string) {
  const db = getPrisma()
  const items = await db.shootAddOnItem.findMany({ where: { shootBookingId } })
  // Real bug found live (2026-07-28 sales/agency/education-vertical audit):
  // plain-float `reduce` here drifts off the correct cent for ordinary
  // quantity/unitPrice combinations — same bug class already fixed
  // systemically for billing/coaching-fee/rental (see commit "Fix systemic
  // float money-math bug") — routed through currency.service.ts's
  // sumCurrency (Decimal-backed summation) instead.
  const total = sumCurrency(items.map((i) => i.quantity * Number(i.unitPrice)))
  return { success: true, data: { total, count: items.length } }
}
