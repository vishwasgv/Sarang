import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listVendorBookings, createVendorBooking, updateVendorBooking, recomputePerHeadVendorBookings } from '../event-vendor-booking.service'

// Regression coverage for the Phase 32 re-audit finding: EventVendorBooking.
// quotedAmount/advancePaid are Prisma Decimal fields, returned unserialized
// by every function below. Electron's IPC can't serialize a Decimal
// instance and throws "An object could not be cloned". serializeVendorBooking
// is also exported and reused by event-booking.service.ts to serialize
// vendorBookings[] nested under an event — covered separately in
// event-booking.service.test.ts.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeVendorBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vb-1', eventId: 'event-1', vendorId: 'sup-1', vendorCategory: 'CATERING',
    pricingType: 'FLAT', perHeadRate: null,
    quotedAmount: new FakeDecimal(100000) as unknown as number,
    advancePaid: new FakeDecimal(20000) as unknown as number,
    status: 'ENQUIRED', notes: null,
    vendor: { id: 'sup-1', supplierName: 'Test Caterer', phone: null },
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeVendorBooking> | null = null, expectedGuestCount: number | null = 200) {
  const db: Record<string, any> = {
    eventVendorBooking: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      findUnique: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeVendorBooking({ id: 'vb-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeVendorBooking({ ...existing, ...data }))
      ),
    },
    eventBooking: {
      findUnique: vi.fn().mockResolvedValue({ id: 'event-1', expectedGuestCount }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('event-vendor-booking.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createVendorBooking returns quotedAmount and advancePaid as plain numbers', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createVendorBooking({ eventId: 'event-1', vendorId: 'sup-1', vendorCategory: 'CATERING', quotedAmount: 100000, advancePaid: 20000 })

    expect(res.success).toBe(true)
    const data = (res as { data: { quotedAmount: unknown; advancePaid: unknown } }).data
    expect(typeof data.quotedAmount).toBe('number')
    expect(typeof data.advancePaid).toBe('number')
  })

  it('listVendorBookings returns quotedAmount as a plain number, not a Decimal instance', async () => {
    const db = makeMockDb(makeVendorBooking())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listVendorBookings('event-1')

    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ quotedAmount: unknown }> }).data[0].quotedAmount).toBe('number')
  })

  it('updateVendorBooking returns quotedAmount as a plain number', async () => {
    const db = makeMockDb(makeVendorBooking())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateVendorBooking({ id: 'vb-1', quotedAmount: 120000 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { quotedAmount: unknown } }).data.quotedAmount).toBe('number')
  })

  // Real bug caught live: perHeadRate is ALSO a Prisma Decimal field (like
  // quotedAmount/advancePaid) but was missing from serializeVendorBooking —
  // every PER_HEAD create/update/list crashed the real app over IPC with
  // "An object could not be cloned" until this was added. listVendorBookings
  // exercises this most realistically since its mock preserves the real
  // Prisma behavior of always returning a Decimal instance for a Decimal
  // column, regardless of what plain-number input created the row.
  it('serializes perHeadRate as a plain number on a PER_HEAD booking, not a raw Decimal instance', async () => {
    const db = makeMockDb(makeVendorBooking({ pricingType: 'PER_HEAD', perHeadRate: new FakeDecimal(800) as unknown as number }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listVendorBookings('event-1')

    expect(res.success).toBe(true)
    const booking = (res as { data: Array<{ perHeadRate: unknown }> }).data[0]
    expect(typeof booking.perHeadRate).toBe('number')
    expect(booking.perHeadRate).toBe(800)
  })

  it('serializes perHeadRate as null (not undefined/a Decimal) on a FLAT booking', async () => {
    const db = makeMockDb(makeVendorBooking({ pricingType: 'FLAT', perHeadRate: null }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listVendorBookings('event-1')

    expect(res.success).toBe(true)
    expect((res as { data: Array<{ perHeadRate: unknown }> }).data[0].perHeadRate).toBeNull()
  })
})

// Phase 58 §2 — Event Management: guest-count-to-costing (per-head pricing)

describe('event-vendor-booking.service — per-head pricing', () => {
  beforeEach(() => vi.clearAllMocks())

  it('computes quotedAmount server-side from perHeadRate × the event\'s real guest count on create — never trusts a caller-sent quotedAmount', async () => {
    const db = makeMockDb(null, 250)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createVendorBooking({
      eventId: 'event-1', vendorId: 'sup-1', vendorCategory: 'CATERING',
      pricingType: 'PER_HEAD', perHeadRate: 800,
      quotedAmount: 1, // bogus caller-sent flat amount — must be ignored for PER_HEAD
    })

    expect(res.success).toBe(true)
    expect(db.eventVendorBooking.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ pricingType: 'PER_HEAD', perHeadRate: 800, quotedAmount: 200000 }),
    }))
  })

  it('rejects per-head pricing when the event has no expected guest count set yet', async () => {
    const db = makeMockDb(null, null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createVendorBooking({ eventId: 'event-1', vendorId: 'sup-1', vendorCategory: 'CATERING', pricingType: 'PER_HEAD', perHeadRate: 800 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('EVB-003')
  })

  it('rejects per-head pricing when a real 0-guest count would silently compute ₹0', async () => {
    const db = makeMockDb(null, 0)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createVendorBooking({ eventId: 'event-1', vendorId: 'sup-1', vendorCategory: 'CATERING', pricingType: 'PER_HEAD', perHeadRate: 800 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('EVB-003')
  })

  it('rejects flat pricing with no quoted amount', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createVendorBooking({ eventId: 'event-1', vendorId: 'sup-1', vendorCategory: 'CATERING' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('EVB-004')
  })

  it('recomputes quotedAmount on update when the per-head rate changes, using the event\'s current guest count', async () => {
    const db = makeMockDb(makeVendorBooking({ pricingType: 'PER_HEAD', perHeadRate: 500 }), 300)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateVendorBooking({ id: 'vb-1', perHeadRate: 600 })

    expect(res.success).toBe(true)
    expect(db.eventVendorBooking.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ perHeadRate: 600, quotedAmount: 180000 }),
    }))
  })

  it('switching an existing PER_HEAD line back to FLAT clears perHeadRate and honors the new flat amount', async () => {
    const db = makeMockDb(makeVendorBooking({ pricingType: 'PER_HEAD', perHeadRate: 500 }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateVendorBooking({ id: 'vb-1', pricingType: 'FLAT', quotedAmount: 75000 })

    expect(res.success).toBe(true)
    expect(db.eventVendorBooking.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ pricingType: 'FLAT', perHeadRate: null, quotedAmount: 75000 }),
    }))
  })

  it('recomputePerHeadVendorBookings updates every PER_HEAD line for the event and skips FLAT ones', async () => {
    const perHeadBookings = [
      { id: 'vb-1', perHeadRate: new FakeDecimal(500) as unknown as number },
      { id: 'vb-2', perHeadRate: new FakeDecimal(1000) as unknown as number },
    ]
    const db = {
      eventVendorBooking: {
        findMany: vi.fn().mockResolvedValue(perHeadBookings),
        update: vi.fn().mockResolvedValue({}),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await recomputePerHeadVendorBookings('event-1', 400)

    expect(db.eventVendorBooking.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId: 'event-1', pricingType: 'PER_HEAD' } }))
    expect(db.eventVendorBooking.update).toHaveBeenCalledWith({ where: { id: 'vb-1' }, data: { quotedAmount: 200000 } })
    expect(db.eventVendorBooking.update).toHaveBeenCalledWith({ where: { id: 'vb-2' }, data: { quotedAmount: 400000 } })
  })

  it('recomputePerHeadVendorBookings leaves lines untouched when the guest count is cleared to null', async () => {
    const db = {
      eventVendorBooking: {
        findMany: vi.fn().mockResolvedValue([{ id: 'vb-1', perHeadRate: new FakeDecimal(500) as unknown as number }]),
        update: vi.fn().mockResolvedValue({}),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await recomputePerHeadVendorBookings('event-1', null)

    expect(db.eventVendorBooking.update).not.toHaveBeenCalled()
  })
})
