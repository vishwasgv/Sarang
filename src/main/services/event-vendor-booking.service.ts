import { getPrisma } from '../database/db'

// EventVendorBooking.quotedAmount/advancePaid/perHeadRate are Prisma Decimal
// fields — Electron's IPC (structured clone) cannot serialize a Decimal
// instance and throws "An object could not be cloned" on every response
// that includes one. Exported so event-booking.service.ts can apply it to
// vendorBookings nested under an event (listEventBookings/createEventBooking/
// updateEventBooking's `include: { vendorBookings }`).
export function serializeVendorBooking<T extends { quotedAmount: unknown; advancePaid: unknown; perHeadRate?: unknown }>(v: T): T {
  return {
    ...v,
    quotedAmount: Number(v.quotedAmount),
    advancePaid: Number(v.advancePaid),
    ...('perHeadRate' in v ? { perHeadRate: v.perHeadRate == null ? null : Number(v.perHeadRate) } : {}),
  }
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

// Phase 58 §2 — Event Management: guest-count-to-costing. Computes the real
// billable amount for a PER_HEAD line — never accepted directly from the
// caller. Returns null (not 0/guessed) when the event has no real guest
// count set yet, so the caller can reject rather than silently billing ₹0.
function computePerHeadAmount(perHeadRate: number, expectedGuestCount: number | null): number | null {
  if (expectedGuestCount == null || expectedGuestCount <= 0) return null
  return perHeadRate * expectedGuestCount
}

export async function createVendorBooking(payload: {
  eventId: string
  vendorId: string
  vendorCategory: string
  pricingType?: string
  quotedAmount?: number
  perHeadRate?: number
  advancePaid?: number
  status?: string
  notes?: string
}) {
  const db = getPrisma()
  const pricingType = payload.pricingType ?? 'FLAT'
  let quotedAmount: number
  let perHeadRate: number | null = null

  if (pricingType === 'PER_HEAD') {
    if (payload.perHeadRate == null || payload.perHeadRate < 0) {
      return { success: false, error: { code: 'EVB-001', message: 'Per-head rate is required for per-head pricing.' } }
    }
    const event = await db.eventBooking.findUnique({ where: { id: payload.eventId }, select: { expectedGuestCount: true } })
    if (!event) return { success: false, error: { code: 'EVB-002', message: 'Event not found.' } }
    const computed = computePerHeadAmount(payload.perHeadRate, event.expectedGuestCount)
    if (computed == null) {
      return { success: false, error: { code: 'EVB-003', message: "Set the event's expected guest count before adding a per-head vendor line." } }
    }
    quotedAmount = computed
    perHeadRate = payload.perHeadRate
  } else {
    if (payload.quotedAmount == null || payload.quotedAmount < 0) {
      return { success: false, error: { code: 'EVB-004', message: 'Quoted amount is required.' } }
    }
    quotedAmount = payload.quotedAmount
  }

  const booking = await db.eventVendorBooking.create({
    data: {
      eventId: payload.eventId,
      vendorId: payload.vendorId,
      vendorCategory: payload.vendorCategory,
      pricingType,
      perHeadRate,
      quotedAmount,
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
  pricingType?: string
  quotedAmount?: number
  perHeadRate?: number
  advancePaid?: number
  status?: string
  notes?: string | null
}) {
  const db = getPrisma()
  const { id, pricingType, quotedAmount, perHeadRate, ...rest } = payload

  const existing = await db.eventVendorBooking.findUnique({ where: { id } })
  if (!existing) return { success: false, error: { code: 'EVB-005', message: 'Vendor booking not found.' } }

  const effectivePricingType = pricingType ?? existing.pricingType
  const data: Record<string, unknown> = { ...rest }

  if (effectivePricingType === 'PER_HEAD') {
    const effectiveRate = perHeadRate ?? (existing.perHeadRate == null ? null : Number(existing.perHeadRate))
    if (effectiveRate == null || effectiveRate < 0) {
      return { success: false, error: { code: 'EVB-001', message: 'Per-head rate is required for per-head pricing.' } }
    }
    const event = await db.eventBooking.findUnique({ where: { id: existing.eventId }, select: { expectedGuestCount: true } })
    const computed = computePerHeadAmount(effectiveRate, event?.expectedGuestCount ?? null)
    if (computed == null) {
      return { success: false, error: { code: 'EVB-003', message: "Set the event's expected guest count before using per-head pricing." } }
    }
    data.pricingType = 'PER_HEAD'
    data.perHeadRate = effectiveRate
    data.quotedAmount = computed
  } else {
    data.pricingType = 'FLAT'
    data.perHeadRate = null
    if (quotedAmount !== undefined) {
      if (quotedAmount < 0) return { success: false, error: { code: 'EVB-004', message: 'Quoted amount cannot be negative.' } }
      data.quotedAmount = quotedAmount
    }
  }

  const booking = await db.eventVendorBooking.update({
    where: { id },
    data,
    include: { vendor: { select: { id: true, supplierName: true, phone: true } } },
  })
  await db.auditLog.create({ data: { action: payload.status === 'CONFIRMED' ? 'CONFIRMED' : 'UPDATE', entityType: 'EventVendorBooking', entityId: booking.id } }).catch(() => {})
  return { success: true, data: serializeVendorBooking(booking) }
}

// Phase 58 §2 — called from event-booking.service.ts's updateEventBooking
// whenever expectedGuestCount changes, so every PER_HEAD vendor line for
// that event stays in sync with the real current guest count rather than
// silently going stale.
export async function recomputePerHeadVendorBookings(eventId: string, expectedGuestCount: number | null) {
  const db = getPrisma()
  const perHeadBookings = await db.eventVendorBooking.findMany({
    where: { eventId, pricingType: 'PER_HEAD' },
    select: { id: true, perHeadRate: true },
  })
  for (const b of perHeadBookings) {
    const computed = computePerHeadAmount(Number(b.perHeadRate), expectedGuestCount)
    if (computed != null) {
      await db.eventVendorBooking.update({ where: { id: b.id }, data: { quotedAmount: computed } })
    }
  }
}

export async function deleteVendorBooking(id: string) {
  const db = getPrisma()
  await db.eventVendorBooking.delete({ where: { id } })
  await db.auditLog.create({ data: { action: 'DELETE', entityType: 'EventVendorBooking', entityId: id } }).catch(() => {})
  return { success: true }
}
