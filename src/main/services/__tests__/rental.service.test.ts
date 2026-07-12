import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))
vi.mock('../notification-queue.service', () => ({ buildWhatsAppLink: vi.fn().mockResolvedValue('https://wa.me/x') }))
vi.mock('../sequence.service', () => ({ generateSequenceNumber: vi.fn().mockResolvedValue('RENT-00001') }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import {
  checkAvailability,
  createBooking,
  checkoutBooking,
  returnBooking,
  extendBooking,
  cancelBooking,
  generateRentalInvoice,
} from '../rental.service'

const MS_PER_DAY = 86_400_000

function makeBulkProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-tent', productName: 'Party Tent', isRentable: true, rentalTrackingType: 'BULK',
    rentalRates: JSON.stringify([{ basis: 'DAY', amount: 500 }]),
    taxRate: 18,
    ...overrides,
  }
}

function makeUnitProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-car', productName: 'Sedan Car', isRentable: true, rentalTrackingType: 'UNIT',
    rentalRates: JSON.stringify([{ basis: 'DAY', amount: 2000 }]),
    taxRate: 18,
    ...overrides,
  }
}

function makeBaseMockDb() {
  const db: Record<string, any> = {
    product: { findUnique: vi.fn(), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
    inventory: { findUnique: vi.fn().mockResolvedValue({ quantity: 10 }) },
    rentalUnit: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({}) },
    rentalBookingItem: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { quantity: 0 } }),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    rentalBooking: {
      create: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}), updateMany: vi.fn(),
    },
    setting: { findUnique: vi.fn().mockResolvedValue(null) },
  }
  db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return db
}

describe('rental.service — checkAvailability', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a product that is not rentable', async () => {
    const db = makeBaseMockDb()
    db.product.findUnique.mockResolvedValue({ id: 'p1', isRentable: false })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await checkAvailability({ productId: 'p1', startDateTime: '2026-08-01T00:00:00Z', endDateTime: '2026-08-03T00:00:00Z' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RENT-001')
  })

  it('rejects an end date/time before the start', async () => {
    const db = makeBaseMockDb()
    db.product.findUnique.mockResolvedValue(makeBulkProduct())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await checkAvailability({ productId: 'prod-tent', startDateTime: '2026-08-05T00:00:00Z', endDateTime: '2026-08-01T00:00:00Z' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RENT-002')
  })

  it('BULK: computes availableQuantity as owned minus overlapping committed quantity', async () => {
    const db = makeBaseMockDb()
    db.product.findUnique.mockResolvedValue(makeBulkProduct())
    db.inventory.findUnique.mockResolvedValue({ quantity: 10 })
    db.rentalBookingItem.aggregate.mockResolvedValue({ _sum: { quantity: 4 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await checkAvailability({ productId: 'prod-tent', startDateTime: '2026-08-01T00:00:00Z', endDateTime: '2026-08-03T00:00:00Z', quantity: 5 })
    expect(res.success).toBe(true)
    expect((res as any).data.availableQuantity).toBe(6)
    expect((res as any).data.available).toBe(true)
  })

  it('BULK: reports unavailable when requested quantity exceeds what remains', async () => {
    const db = makeBaseMockDb()
    db.product.findUnique.mockResolvedValue(makeBulkProduct())
    db.inventory.findUnique.mockResolvedValue({ quantity: 10 })
    db.rentalBookingItem.aggregate.mockResolvedValue({ _sum: { quantity: 8 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await checkAvailability({ productId: 'prod-tent', startDateTime: '2026-08-01T00:00:00Z', endDateTime: '2026-08-03T00:00:00Z', quantity: 5 })
    expect(res.success).toBe(true)
    expect((res as any).data.available).toBe(false)
  })

  it('UNIT: excludes units with an overlapping active booking', async () => {
    const db = makeBaseMockDb()
    db.product.findUnique.mockResolvedValue(makeUnitProduct())
    db.rentalUnit.findMany.mockResolvedValue([{ id: 'unit-1', unitLabel: 'Car #1' }, { id: 'unit-2', unitLabel: 'Car #2' }])
    db.rentalBookingItem.findMany.mockResolvedValue([{ rentalUnitId: 'unit-1' }])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await checkAvailability({ productId: 'prod-car', startDateTime: '2026-08-01T00:00:00Z', endDateTime: '2026-08-03T00:00:00Z' })
    expect(res.success).toBe(true)
    expect((res as any).data.availableUnits).toEqual([{ id: 'unit-2', unitLabel: 'Car #2' }])
    expect((res as any).data.available).toBe(true)
  })

  it('UNIT: reports unavailable when every unit is booked', async () => {
    const db = makeBaseMockDb()
    db.product.findUnique.mockResolvedValue(makeUnitProduct())
    db.rentalUnit.findMany.mockResolvedValue([{ id: 'unit-1', unitLabel: 'Car #1' }])
    db.rentalBookingItem.findMany.mockResolvedValue([{ rentalUnitId: 'unit-1' }])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await checkAvailability({ productId: 'prod-car', startDateTime: '2026-08-01T00:00:00Z', endDateTime: '2026-08-03T00:00:00Z' })
    expect(res.success).toBe(true)
    expect((res as any).data.available).toBe(false)
  })

  it('passes the interval-overlap filter (startDateTime < end && endDateTime > start) to the query', async () => {
    const db = makeBaseMockDb()
    db.product.findUnique.mockResolvedValue(makeBulkProduct())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const start = '2026-08-01T00:00:00.000Z'
    const end = '2026-08-03T00:00:00.000Z'
    await checkAvailability({ productId: 'prod-tent', startDateTime: start, endDateTime: end })

    expect(db.rentalBookingItem.aggregate).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        booking: expect.objectContaining({
          status: { in: ['RESERVED', 'CHECKED_OUT'] },
          startDateTime: { lt: new Date(end) },
          endDateTime: { gt: new Date(start) },
        }),
      }),
    }))
  })
})

function makeBookingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1', bookingNumber: 'RENT-00001', customerId: 'cust-1', status: 'RESERVED',
    startDateTime: new Date('2026-08-01T00:00:00Z'), endDateTime: new Date('2026-08-04T00:00:00Z'),
    securityDepositCollected: 1000, securityDepositRefunded: null, lateFeeAmount: 0, damageChargeAmount: 0,
    checkoutNotes: null, returnNotes: null, checkedOutAt: null, returnedAt: null, cancelledAt: null,
    invoiceId: null, notes: null, createdAt: new Date(), updatedAt: new Date(),
    customer: { customerName: 'Test Customer' },
    items: [],
    ...overrides,
  }
}

describe('rental.service — createBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects an end date/time not after the start', async () => {
    const db = makeBaseMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBooking({ customerId: 'cust-1', startDateTime: '2026-08-05T00:00:00Z', endDateTime: '2026-08-01T00:00:00Z', items: [{ productId: 'prod-tent', rateBasis: 'DAY' }] })
    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('RENT-002')
  })

  it('rejects a booking with no items', async () => {
    const db = makeBaseMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBooking({ customerId: 'cust-1', startDateTime: '2026-08-01T00:00:00Z', endDateTime: '2026-08-04T00:00:00Z', items: [] })
    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('RENT-007')
  })

  it('rejects an item whose product has no rate configured for the requested basis', async () => {
    const db = makeBaseMockDb()
    db.rentalBooking.create.mockResolvedValue({ id: 'booking-1' })
    db.product.findUnique.mockResolvedValue(makeBulkProduct({ rentalRates: JSON.stringify([{ basis: 'HOUR', amount: 50 }]) }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBooking({ customerId: 'cust-1', startDateTime: '2026-08-01T00:00:00Z', endDateTime: '2026-08-04T00:00:00Z', items: [{ productId: 'prod-tent', rateBasis: 'DAY' }] })
    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('RENT-008')
  })

  it('BULK: rejects when requested quantity exceeds availability inside the transaction', async () => {
    const db = makeBaseMockDb()
    db.rentalBooking.create.mockResolvedValue({ id: 'booking-1' })
    db.product.findUnique.mockResolvedValue(makeBulkProduct())
    db.inventory.findUnique.mockResolvedValue({ quantity: 3 })
    db.rentalBookingItem.aggregate.mockResolvedValue({ _sum: { quantity: 2 } }) // 1 remaining
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBooking({ customerId: 'cust-1', startDateTime: '2026-08-01T00:00:00Z', endDateTime: '2026-08-04T00:00:00Z', items: [{ productId: 'prod-tent', rateBasis: 'DAY', quantity: 5 }] })
    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('RENT-009')
    expect(db.rentalBookingItem.create).not.toHaveBeenCalled()
  })

  it('BULK: creates the item with a lineTotal of rate * ceil(duration) * quantity', async () => {
    const db = makeBaseMockDb()
    db.rentalBooking.create.mockResolvedValue({ id: 'booking-1' })
    db.product.findUnique.mockResolvedValue(makeBulkProduct())
    db.inventory.findUnique.mockResolvedValue({ quantity: 10 })
    db.rentalBookingItem.aggregate.mockResolvedValue({ _sum: { quantity: 0 } })
    db.rentalBooking.findUnique.mockResolvedValue(makeBookingRow())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // exactly 3 days
    const res = await createBooking({
      customerId: 'cust-1', startDateTime: '2026-08-01T00:00:00Z', endDateTime: '2026-08-04T00:00:00Z',
      items: [{ productId: 'prod-tent', rateBasis: 'DAY', quantity: 2 }],
    })
    expect(res.success).toBe(true)
    expect(db.rentalBookingItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ quantity: 2, rateBasis: 'DAY', rateAmount: 500, lineTotal: 500 * 3 * 2 }),
    })
  })

  it('UNIT: rejects when no unit is available inside the transaction', async () => {
    const db = makeBaseMockDb()
    db.rentalBooking.create.mockResolvedValue({ id: 'booking-1' })
    db.product.findUnique.mockResolvedValue(makeUnitProduct())
    db.rentalUnit.findMany.mockResolvedValue([])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBooking({ customerId: 'cust-1', startDateTime: '2026-08-01T00:00:00Z', endDateTime: '2026-08-04T00:00:00Z', items: [{ productId: 'prod-car', rateBasis: 'DAY' }] })
    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('RENT-010')
    expect(db.rentalBookingItem.create).not.toHaveBeenCalled()
  })

  it('UNIT: claims exactly one specific available unit and stamps rentalUnitId on the item', async () => {
    const db = makeBaseMockDb()
    db.rentalBooking.create.mockResolvedValue({ id: 'booking-1' })
    db.product.findUnique.mockResolvedValue(makeUnitProduct())
    db.rentalUnit.findMany.mockResolvedValue([{ id: 'unit-1', unitLabel: 'Car #1' }, { id: 'unit-2', unitLabel: 'Car #2' }])
    db.rentalBookingItem.findMany.mockResolvedValue([])
    db.rentalBooking.findUnique.mockResolvedValue(makeBookingRow())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBooking({ customerId: 'cust-1', startDateTime: '2026-08-01T00:00:00Z', endDateTime: '2026-08-02T00:00:00Z', items: [{ productId: 'prod-car', rateBasis: 'DAY' }] })
    expect(res.success).toBe(true)
    expect(db.rentalBookingItem.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ rentalUnitId: 'unit-1', quantity: 1, rateAmount: 2000, lineTotal: 2000 }),
    })
  })

  it('rejects an unrentable product referenced by an item', async () => {
    const db = makeBaseMockDb()
    db.rentalBooking.create.mockResolvedValue({ id: 'booking-1' })
    db.product.findUnique.mockResolvedValue({ id: 'prod-x', isRentable: false })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBooking({ customerId: 'cust-1', startDateTime: '2026-08-01T00:00:00Z', endDateTime: '2026-08-04T00:00:00Z', items: [{ productId: 'prod-x', rateBasis: 'DAY' }] })
    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('RENT-001')
  })
})

describe('rental.service — checkoutBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects checking out a booking not in RESERVED status', async () => {
    const db = makeBaseMockDb()
    db.rentalBooking.findUnique.mockResolvedValue(makeBookingRow({ status: 'CANCELLED', items: [] }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await checkoutBooking({ id: 'booking-1' })
    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('RENT-012')
  })

  it('checks out a RESERVED booking and flips its assigned units to RENTED', async () => {
    const db = makeBaseMockDb()
    db.rentalBooking.findUnique
      .mockResolvedValueOnce(makeBookingRow({ status: 'RESERVED', items: [{ rentalUnitId: 'unit-1' }, { rentalUnitId: null }] }))
      .mockResolvedValueOnce(makeBookingRow({ status: 'CHECKED_OUT' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await checkoutBooking({ id: 'booking-1', checkoutNotes: 'all good' })
    expect(res.success).toBe(true)
    expect(db.rentalBooking.update).toHaveBeenCalledWith({ where: { id: 'booking-1' }, data: expect.objectContaining({ status: 'CHECKED_OUT', checkoutNotes: 'all good' }) })
    expect(db.rentalUnit.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['unit-1'] } }, data: { status: 'RENTED' } })
  })
})

describe('rental.service — returnBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects returning a booking not in CHECKED_OUT status', async () => {
    const db = makeBaseMockDb()
    db.rentalBooking.findUnique.mockResolvedValue(makeBookingRow({ status: 'RESERVED' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await returnBooking({ id: 'booking-1' })
    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('RENT-014')
  })

  it('rejects a negative damage charge', async () => {
    const db = makeBaseMockDb()
    db.rentalBooking.findUnique.mockResolvedValue(makeBookingRow({ status: 'CHECKED_OUT' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await returnBooking({ id: 'booking-1', damageChargeAmount: -10 })
    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('RENT-015')
  })

  it('rejects a refund amount exceeding the deposit collected', async () => {
    const db = makeBaseMockDb()
    db.rentalBooking.findUnique.mockResolvedValue(makeBookingRow({ status: 'CHECKED_OUT', securityDepositCollected: 500 }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await returnBooking({ id: 'booking-1', securityDepositRefunded: 600 })
    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('RENT-016')
  })

  it('charges no late fee for an on-time return', async () => {
    const db = makeBaseMockDb()
    const future = new Date(Date.now() + 10 * MS_PER_DAY)
    db.rentalBooking.findUnique
      .mockResolvedValueOnce(makeBookingRow({ status: 'CHECKED_OUT', endDateTime: future, items: [{ rateAmount: 500, rateBasis: 'DAY', quantity: 1, rentalUnitId: null }] }))
      .mockResolvedValueOnce(makeBookingRow({ status: 'RETURNED' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await returnBooking({ id: 'booking-1' })
    expect(res.success).toBe(true)
    expect(db.rentalBooking.update).toHaveBeenCalledWith({ where: { id: 'booking-1' }, data: expect.objectContaining({ lateFeeAmount: 0 }) })
  })

  it('computes a late fee using the configured multiplier, normalized to a per-day rate, for a late return', async () => {
    const db = makeBaseMockDb()
    db.setting.findUnique.mockResolvedValue({ settingValue: '2' }) // multiplier = 2
    const end = new Date('2026-08-01T00:00:00Z')
    const oneDayLate = new Date(end.getTime() + MS_PER_DAY + 1000) // just over 1 day late -> ceil = 2? need control
    // Use a mocked "now" via vi.useFakeTimers to make the lateness deterministic (exactly 1 day late).
    vi.useFakeTimers()
    vi.setSystemTime(new Date(end.getTime() + MS_PER_DAY)) // exactly 1 day late

    db.rentalBooking.findUnique
      .mockResolvedValueOnce(makeBookingRow({ status: 'CHECKED_OUT', endDateTime: end, items: [{ rateAmount: 2000, rateBasis: 'DAY', quantity: 1, rentalUnitId: null }] }))
      .mockResolvedValueOnce(makeBookingRow({ status: 'RETURNED' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await returnBooking({ id: 'booking-1' })
    vi.useRealTimers()

    expect(res.success).toBe(true)
    // dailyEquivalent = 2000 (already DAY-basis) * multiplier(2) * lateDurationUnits(1) * quantity(1) = 4000
    expect(db.rentalBooking.update).toHaveBeenCalledWith({ where: { id: 'booking-1' }, data: expect.objectContaining({ lateFeeAmount: 4000 }) })
    void oneDayLate
  })

  it('releases assigned rental units back to AVAILABLE on return', async () => {
    const db = makeBaseMockDb()
    const future = new Date(Date.now() + 10 * MS_PER_DAY)
    db.rentalBooking.findUnique
      .mockResolvedValueOnce(makeBookingRow({ status: 'CHECKED_OUT', endDateTime: future, items: [{ rateAmount: 2000, rateBasis: 'DAY', quantity: 1, rentalUnitId: 'unit-1' }] }))
      .mockResolvedValueOnce(makeBookingRow({ status: 'RETURNED' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await returnBooking({ id: 'booking-1' })
    expect(db.rentalUnit.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['unit-1'] } }, data: { status: 'AVAILABLE' } })
  })
})

describe('rental.service — extendBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects extending a CANCELLED or RETURNED booking', async () => {
    const db = makeBaseMockDb()
    db.rentalBooking.findUnique.mockResolvedValue(makeBookingRow({ status: 'RETURNED' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await extendBooking({ id: 'booking-1', newEndDateTime: '2026-08-10T00:00:00Z' })
    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('RENT-018')
  })

  it('rejects a UNIT extension that conflicts with another booking of the same unit', async () => {
    const db = makeBaseMockDb()
    db.rentalBooking.findUnique.mockResolvedValue(makeBookingRow({
      status: 'CHECKED_OUT',
      items: [{ id: 'item-1', productId: 'prod-car', rentalUnitId: 'unit-1', quantity: 1, rateBasis: 'DAY', rateAmount: 2000, product: makeUnitProduct() }],
    }))
    // The unit is NOT in the available list for the extended range (someone else has it)
    db.rentalUnit.findMany.mockResolvedValue([])
    db.rentalBookingItem.findMany.mockResolvedValue([])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await extendBooking({ id: 'booking-1', newEndDateTime: '2026-08-10T00:00:00Z' })
    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('RENT-020')
  })

  it('excludes the booking itself from its own conflict check via excludeBookingId', async () => {
    const db = makeBaseMockDb()
    db.rentalBooking.findUnique
      .mockResolvedValueOnce(makeBookingRow({
        status: 'CHECKED_OUT', startDateTime: new Date('2026-08-01T00:00:00Z'),
        items: [{ id: 'item-1', productId: 'prod-car', rentalUnitId: 'unit-1', quantity: 1, rateBasis: 'DAY', rateAmount: 2000, product: makeUnitProduct() }],
      }))
      .mockResolvedValueOnce(makeBookingRow({ status: 'CHECKED_OUT' }))
    db.rentalUnit.findMany.mockResolvedValue([{ id: 'unit-1', unitLabel: 'Car #1' }])
    db.rentalBookingItem.findMany.mockResolvedValue([]) // no other booking holds unit-1 in the new range
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await extendBooking({ id: 'booking-1', newEndDateTime: '2026-08-06T00:00:00Z' })
    expect(res.success).toBe(true)
    expect(db.rentalBookingItem.update).toHaveBeenCalledWith({ where: { id: 'item-1' }, data: expect.objectContaining({ lineTotal: 2000 * 5 }) })
  })

  it('BULK: rejects an extension that would exceed available stock', async () => {
    const db = makeBaseMockDb()
    db.rentalBooking.findUnique.mockResolvedValue(makeBookingRow({
      status: 'RESERVED',
      items: [{ id: 'item-1', productId: 'prod-tent', rentalUnitId: null, quantity: 5, rateBasis: 'DAY', rateAmount: 500, product: makeBulkProduct() }],
    }))
    db.inventory.findUnique.mockResolvedValue({ quantity: 5 })
    db.rentalBookingItem.aggregate.mockResolvedValue({ _sum: { quantity: 3 } }) // only 2 left, need 5
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await extendBooking({ id: 'booking-1', newEndDateTime: '2026-08-10T00:00:00Z' })
    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('RENT-019')
  })
})

describe('rental.service — cancelBooking', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects cancelling a CHECKED_OUT booking (must be returned instead)', async () => {
    const db = makeBaseMockDb()
    db.rentalBooking.findUnique.mockResolvedValue(makeBookingRow({ status: 'CHECKED_OUT' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await cancelBooking({ id: 'booking-1' })
    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('RENT-022')
  })

  it('cancels a RESERVED booking and releases any claimed units', async () => {
    const db = makeBaseMockDb()
    db.rentalBooking.findUnique
      .mockResolvedValueOnce(makeBookingRow({ status: 'RESERVED', items: [{ rentalUnitId: 'unit-1' }] }))
      .mockResolvedValueOnce(makeBookingRow({ status: 'CANCELLED' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await cancelBooking({ id: 'booking-1', reason: 'customer changed mind' })
    expect(res.success).toBe(true)
    expect(db.rentalUnit.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['unit-1'] } }, data: { status: 'AVAILABLE' } })
  })
})

describe('rental.service — generateRentalInvoice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing booking', async () => {
    const db = makeBaseMockDb()
    db.rentalBooking.updateMany.mockResolvedValue({ count: 0 })
    db.rentalBooking.findUnique.mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateRentalInvoice('booking-missing')
    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('RENT-005')
  })

  it('rejects when a concurrent call already claimed the invoice slot', async () => {
    const db = makeBaseMockDb()
    db.rentalBooking.updateMany.mockResolvedValue({ count: 0 })
    db.rentalBooking.findUnique.mockResolvedValue({ id: 'booking-1', invoiceId: 'invoice-existing' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateRentalInvoice('booking-1')
    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('RENT-025')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })

  it('rejects a double-invoice attempt caught mid-generation via the claim sentinel', async () => {
    const db = makeBaseMockDb()
    db.rentalBooking.updateMany.mockResolvedValue({ count: 0 })
    db.rentalBooking.findUnique.mockResolvedValue({ id: 'booking-1', invoiceId: 'CLAIMING' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateRentalInvoice('booking-1')
    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('RENT-024')
  })

  it('generates an invoice with rental-charge line items, late fee, and damage charge — but never the deposit', async () => {
    const db = makeBaseMockDb()
    db.rentalBooking.updateMany.mockResolvedValue({ count: 1 })
    db.rentalBooking.findUnique.mockResolvedValue(makeBookingRow({
      lateFeeAmount: 300, damageChargeAmount: 150, securityDepositCollected: 1000,
      items: [{ productId: 'prod-tent', lineTotal: 1500, product: makeBulkProduct() }],
    }))
    db.product.findFirst.mockResolvedValue(null)
    db.product.create
      .mockResolvedValueOnce({ id: 'charge-product-1' })
      .mockResolvedValueOnce({ id: 'late-fee-product' })
      .mockResolvedValueOnce({ id: 'damage-product' })
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-1' } } as never)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateRentalInvoice('booking-1')

    expect(res.success).toBe(true)
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'cust-1',
      items: [
        expect.objectContaining({ productId: 'charge-product-1', unitPrice: 1500 }),
        expect.objectContaining({ productId: 'late-fee-product', unitPrice: 300 }),
        expect.objectContaining({ productId: 'damage-product', unitPrice: 150 }),
      ],
    }))
    // Deposit must never appear as an invoice line item
    const callArgs = vi.mocked(billingService.createInvoice).mock.calls[0][0] as { items: Array<{ unitPrice: number }> }
    expect(callArgs.items.some((i) => i.unitPrice === 1000)).toBe(false)
    expect(db.rentalBooking.update).toHaveBeenCalledWith({ where: { id: 'booking-1' }, data: { invoiceId: 'invoice-1' } })
  })

  it('omits late-fee and damage-charge lines entirely when both are zero', async () => {
    const db = makeBaseMockDb()
    db.rentalBooking.updateMany.mockResolvedValue({ count: 1 })
    db.rentalBooking.findUnique.mockResolvedValue(makeBookingRow({
      lateFeeAmount: 0, damageChargeAmount: 0,
      items: [{ productId: 'prod-tent', lineTotal: 1500, product: makeBulkProduct() }],
    }))
    db.product.findFirst.mockResolvedValue({ id: 'charge-product-1' })
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-1' } } as never)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await generateRentalInvoice('booking-1')

    const callArgs = vi.mocked(billingService.createInvoice).mock.calls[0][0] as { items: unknown[] }
    expect(callArgs.items).toHaveLength(1)
  })

  it('releases the claim (invoiceId back to null) when billing fails', async () => {
    const db = makeBaseMockDb()
    db.rentalBooking.updateMany.mockResolvedValue({ count: 1 })
    db.rentalBooking.findUnique.mockResolvedValue(makeBookingRow({ items: [{ productId: 'prod-tent', lineTotal: 1500, product: makeBulkProduct() }] }))
    db.product.findFirst.mockResolvedValue({ id: 'charge-product-1' })
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'BILL-001', message: 'failed' } } as never)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateRentalInvoice('booking-1')
    expect(res.success).toBe(false)
    expect(db.rentalBooking.update).toHaveBeenCalledWith({ where: { id: 'booking-1' }, data: { invoiceId: null } })
  })

  it('invoices the per-product SERVICE placeholder, never the raw rentable Product directly', async () => {
    // Regression guard: invoicing the raw STANDARD rentable product would
    // trigger billing.service.ts's stock-check/deduction logic, which is
    // wrong for rentals (see rental.service.ts's own header comment).
    const db = makeBaseMockDb()
    db.rentalBooking.updateMany.mockResolvedValue({ count: 1 })
    db.rentalBooking.findUnique.mockResolvedValue(makeBookingRow({ items: [{ productId: 'prod-tent', lineTotal: 1500, product: makeBulkProduct() }] }))
    db.product.findFirst.mockResolvedValue(null)
    db.product.create.mockResolvedValue({ id: 'charge-product-1' })
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-1' } } as never)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await generateRentalInvoice('booking-1')

    expect(db.product.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ productName: 'Party Tent — Rental Charge', productType: 'SERVICE' }),
    }))
    const callArgs = vi.mocked(billingService.createInvoice).mock.calls[0][0] as { items: Array<{ productId: string }> }
    expect(callArgs.items.every((i) => i.productId !== 'prod-tent')).toBe(true)
  })
})
