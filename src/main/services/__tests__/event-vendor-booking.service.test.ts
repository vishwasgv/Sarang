import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listVendorBookings, createVendorBooking, updateVendorBooking } from '../event-vendor-booking.service'

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
    quotedAmount: new FakeDecimal(100000) as unknown as number,
    advancePaid: new FakeDecimal(20000) as unknown as number,
    status: 'ENQUIRED', notes: null,
    vendor: { id: 'sup-1', supplierName: 'Test Caterer', phone: null },
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeVendorBooking> | null = null) {
  const db: Record<string, any> = {
    eventVendorBooking: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeVendorBooking({ id: 'vb-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeVendorBooking({ ...existing, ...data }))
      ),
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
})
