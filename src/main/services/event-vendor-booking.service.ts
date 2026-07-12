import { getPrisma } from '../database/db'

// EventVendorBooking.quotedAmount/advancePaid are Prisma Decimal fields —
// Electron's IPC (structured clone) cannot serialize a Decimal instance and
// throws "An object could not be cloned" on every response that includes
// one. Exported so event-booking.service.ts can apply it to vendorBookings
// nested under an event (listEventBookings/createEventBooking/
// updateEventBooking's `include: { vendorBookings }`).
export function serializeVendorBooking<T extends { quotedAmount: unknown; advancePaid: unknown }>(v: T): T {
  return { ...v, quotedAmount: Number(v.quotedAmount), advancePaid: Number(v.advancePaid) }
}

export async function listVendorBookings(eventId: string) {
  const db = getPrisma()
  const bookings = await db.eventVendorBooking.findMany({
    where: { eventId },
    include: { vendor: { select: { id: true, supplierName: true, phone: true, email: true } } },
    orderBy: [{ vendorCategory: 'asc' }, { createdAt: 'asc' }],
  })
  return { success: true, data: bookings.map(serializeVendorBooking) }
}

export async function createVendorBooking(payload: {
  eventId: string
  vendorId: string
  vendorCategory: string
  quotedAmount: number
  advancePaid?: number
  status?: string
  notes?: string
}) {
  const db = getPrisma()
  const booking = await db.eventVendorBooking.create({
    data: {
      eventId: payload.eventId,
      vendorId: payload.vendorId,
      vendorCategory: payload.vendorCategory,
      quotedAmount: payload.quotedAmount,
      advancePaid: payload.advancePaid ?? 0,
      status: payload.status ?? 'ENQUIRED',
      notes: payload.notes || null,
    },
    include: { vendor: { select: { id: true, supplierName: true, phone: true } } },
  })
  await db.auditLog.create({ data: { action: 'CREATE', entityType: 'EventVendorBooking', entityId: booking.id, newValue: JSON.stringify({ eventId: booking.eventId, vendorCategory: booking.vendorCategory }) } }).catch(() => {})
  return { success: true, data: serializeVendorBooking(booking) }
}

export async function updateVendorBooking(payload: {
  id: string
  vendorCategory?: string
  quotedAmount?: number
  advancePaid?: number
  status?: string
  notes?: string | null
}) {
  const db = getPrisma()
  const { id, ...rest } = payload
  const booking = await db.eventVendorBooking.update({
    where: { id },
    data: rest,
    include: { vendor: { select: { id: true, supplierName: true, phone: true } } },
  })
  await db.auditLog.create({ data: { action: payload.status === 'CONFIRMED' ? 'CONFIRMED' : 'UPDATE', entityType: 'EventVendorBooking', entityId: booking.id } }).catch(() => {})
  return { success: true, data: serializeVendorBooking(booking) }
}

export async function deleteVendorBooking(id: string) {
  const db = getPrisma()
  await db.eventVendorBooking.delete({ where: { id } })
  await db.auditLog.create({ data: { action: 'DELETE', entityType: 'EventVendorBooking', entityId: id } }).catch(() => {})
  return { success: true }
}
