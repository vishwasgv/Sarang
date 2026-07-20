import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { listEventBookings, createEventBooking, updateEventBooking, deleteEventBooking, generateEventInvoice } from '../event-booking.service'

// Regression coverage for the Phase 32 re-audit finding: EventBooking.
// clientBudget is a Prisma Decimal field, returned unserialized by every
// function below. Electron's IPC can't serialize a Decimal instance and
// throws "An object could not be cloned". Every function also nests
// `vendorBookings[]` (its own 2 Decimal fields, quotedAmount/advancePaid —
// a second crash surface), serialized via the shared helper from
// event-vendor-booking.service.ts so the fix stays in one place.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeVendorBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vb-1', eventId: 'event-1', vendorId: 'sup-1', vendorCategory: 'CATERING',
    quotedAmount: new FakeDecimal(100000) as unknown as number,
    advancePaid: new FakeDecimal(20000) as unknown as number,
    status: 'ENQUIRED', notes: null,
    vendor: { id: 'sup-1', supplierName: 'Test Caterer', phone: null },
    ...overrides,
  }
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1', clientId: 'cust-1', eventName: 'Sharma Wedding', eventType: 'WEDDING',
    eventDate: new Date(), eventEndDate: null, venueName: 'Test Venue', venueAddress: null,
    expectedGuestCount: null,
    clientBudget: new FakeDecimal(500000) as unknown as number,
    status: 'INQUIRY', invoiceId: null, notes: null,
    client: { id: 'cust-1', customerName: 'Ramesh Kumar', phone: null },
    vendorBookings: [makeVendorBooking()],
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeEvent> | null = null) {
  const db: Record<string, any> = {
    eventBooking: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeEvent({ id: 'event-new', ...data, vendorBookings: [] }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeEvent({ ...existing, ...data }))
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('event-booking.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createEventBooking returns clientBudget as a plain number', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createEventBooking({ clientId: 'cust-1', eventName: 'Sharma Wedding', eventType: 'WEDDING', eventDate: '2026-07-01', venueName: 'Test Venue', clientBudget: 500000 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { clientBudget: unknown } }).data.clientBudget).toBe('number')
  })

  it('createEventBooking returns clientBudget as null when unset, not a Decimal', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    db.eventBooking.create = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(makeEvent({ id: 'event-new', ...data, clientBudget: null, vendorBookings: [] }))
    )

    const res = await createEventBooking({ clientId: 'cust-1', eventName: 'Corporate Meet', eventType: 'CORPORATE', eventDate: '2026-07-01', venueName: 'Office' })

    expect(res.success).toBe(true)
    expect((res as { data: { clientBudget: unknown } }).data.clientBudget).toBeNull()
  })

  it('listEventBookings serializes both clientBudget and nested vendorBookings[].quotedAmount/advancePaid', async () => {
    const db = makeMockDb(makeEvent())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listEventBookings({})

    expect(res.success).toBe(true)
    const event = (res as { data: Array<{ clientBudget: unknown; vendorBookings: Array<{ quotedAmount: unknown; advancePaid: unknown }> }> }).data[0]
    expect(typeof event.clientBudget).toBe('number')
    expect(typeof event.vendorBookings[0].quotedAmount).toBe('number')
    expect(typeof event.vendorBookings[0].advancePaid).toBe('number')
  })

  it('updateEventBooking returns clientBudget as a plain number', async () => {
    const db = makeMockDb(makeEvent())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateEventBooking({ id: 'event-1', clientBudget: 600000 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { clientBudget: unknown } }).data.clientBudget).toBe('number')
  })

  it('rejects a negative finalAmount before touching the database', async () => {
    const db = makeMockDb(makeEvent())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateEventBooking({ id: 'event-1', finalAmount: -100 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('EVT-006')
    expect(db.eventBooking.update).not.toHaveBeenCalled()
  })
})

// Phase 58 §2 — Event Management: changing expectedGuestCount must keep
// every PER_HEAD vendor line's billable amount honest, not silently stale.
// event-vendor-booking.service.ts is NOT mocked here — its real
// recomputePerHeadVendorBookings runs against this same mocked db.

describe('event-booking.service — updateEventBooking recomputes PER_HEAD vendor lines on guest-count change', () => {
  beforeEach(() => vi.clearAllMocks())

  it('recomputes every PER_HEAD vendor line when expectedGuestCount changes', async () => {
    const db = makeMockDb(makeEvent({ expectedGuestCount: 200 }))
    db.eventBooking.findUnique = vi.fn().mockResolvedValue(makeEvent({ expectedGuestCount: 300 }))
    db.eventVendorBooking = {
      findMany: vi.fn().mockResolvedValue([{ id: 'vb-1', perHeadRate: 500 }]),
      update: vi.fn().mockResolvedValue({}),
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateEventBooking({ id: 'event-1', expectedGuestCount: 300 })

    expect(res.success).toBe(true)
    expect(db.eventVendorBooking.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId: 'event-1', pricingType: 'PER_HEAD' } }))
    expect(db.eventVendorBooking.update).toHaveBeenCalledWith({ where: { id: 'vb-1' }, data: { quotedAmount: 150000 } })
  })

  it('does NOT touch vendor lines when expectedGuestCount is not part of the update', async () => {
    const db = makeMockDb(makeEvent())
    db.eventVendorBooking = { findMany: vi.fn(), update: vi.fn() }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateEventBooking({ id: 'event-1', venueName: 'New Venue' })

    expect(db.eventVendorBooking.findMany).not.toHaveBeenCalled()
  })
})

// Phase 40 — deleteEventBooking invoice guard (EVT-002). The structurally
// identical ShootBooking already had this guard (SHT-002); EventBooking
// never did, a real gap found while implementing generateEventInvoice.

describe('event-booking.service — deleteEventBooking invoice guard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('blocks deleting a booking that already has an invoice', async () => {
    const db = {
      eventBooking: {
        findUnique: vi.fn().mockResolvedValue({ invoiceId: 'invoice-1' }),
        delete: vi.fn(),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deleteEventBooking('event-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('EVT-002')
    expect(db.eventBooking.delete).not.toHaveBeenCalled()
  })

  it('allows deleting a booking with no invoice', async () => {
    const db = {
      eventBooking: {
        findUnique: vi.fn().mockResolvedValue({ invoiceId: null }),
        delete: vi.fn().mockResolvedValue({}),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deleteEventBooking('event-1')

    expect(res.success).toBe(true)
    expect(db.eventBooking.delete).toHaveBeenCalledWith({ where: { id: 'event-1' } })
  })
})

// Phase 40 — generateEventInvoice

function makeBookingForInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1', clientId: 'cust-1', eventName: 'Sharma Wedding', eventType: 'WEDDING',
    finalAmount: 500000, invoiceId: null,
    ...overrides,
  }
}

function makeInvoiceMockDb(booking: ReturnType<typeof makeBookingForInvoice> | null) {
  // Mirrors the real atomic claim: UPDATE...WHERE invoiceId IS NULL only
  // matches (and only "wins") when the booking exists and isn't already
  // invoiced/claimed.
  const canClaim = !!booking && !booking.invoiceId
  return {
    eventBooking: {
      updateMany: vi.fn().mockResolvedValue({ count: canClaim ? 1 : 0 }),
      findUnique: vi.fn().mockResolvedValue(booking),
      update: vi.fn().mockResolvedValue({}),
    },
    product: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'product-1', hsnCode: '998596' }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
}

describe('event-booking.service — generateEventInvoice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing event booking', async () => {
    const db = makeInvoiceMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateEventInvoice('event-missing')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('EVT-003')
  })

  it('rejects an event that already has an invoice', async () => {
    const db = makeInvoiceMockDb(makeBookingForInvoice({ invoiceId: 'invoice-existing' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateEventInvoice('event-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('EVT-004')
  })

  it('rejects an event with no final amount set', async () => {
    const db = makeInvoiceMockDb(makeBookingForInvoice({ finalAmount: null }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateEventInvoice('event-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('EVT-005')
  })

  it('generates an invoice and links it back to the event booking', async () => {
    const db = makeInvoiceMockDb(makeBookingForInvoice())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-1' } } as never)

    const res = await generateEventInvoice('event-1')

    expect(res.success).toBe(true)
    expect((res as { data: { invoiceId: string } }).data.invoiceId).toBe('invoice-1')
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'cust-1',
      items: [expect.objectContaining({ productId: 'product-1', unitPrice: 500000 })],
    }))
    expect(db.eventBooking.update).toHaveBeenCalledWith({ where: { id: 'event-1' }, data: { invoiceId: 'invoice-1' } })
  })

  it('propagates a billing failure without linking an invoice, and releases the claim', async () => {
    const db = makeInvoiceMockDb(makeBookingForInvoice())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'BILL-001', message: 'failed' } } as never)

    const res = await generateEventInvoice('event-1')

    expect(res.success).toBe(false)
    expect(db.eventBooking.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: { invoiceId: 'invoice-1' } }))
    expect(db.eventBooking.update).toHaveBeenCalledWith({ where: { id: 'event-1' }, data: { invoiceId: null } })
  })

  it('rejects and releases the claim when a concurrent call wins the race', async () => {
    const db = makeInvoiceMockDb(makeBookingForInvoice())
    db.eventBooking.updateMany = vi.fn().mockResolvedValueOnce({ count: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateEventInvoice('event-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('EVT-004')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })
})
