import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))
vi.mock('../sequence.service', () => ({ generateSequenceNumber: vi.fn().mockResolvedValue('HTL-00001') }))
vi.mock('../payment.service', () => ({ paymentService: { recordPayment: vi.fn().mockResolvedValue({ success: true }) } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { paymentService } from '../payment.service'
import {
  checkAvailability,
  createBooking,
  checkInBooking,
  checkOutBooking,
  cancelBooking,
  addExtraCharge,
  removeExtraCharge,
  generateHotelInvoice,
  generateGroupHotelInvoice,
  updateHousekeepingTaskStatus,
  getCustomerStayHistory,
} from '../hotel.service'

function makeRoom(overrides: Record<string, unknown> = {}) {
  return {
    id: 'room-1', roomNumber: '101', roomType: 'Deluxe', floor: '1',
    maxOccupancy: 2, baseRate: 2000, status: 'AVAILABLE', isActive: true,
    amenities: null, notes: null,
    ...overrides,
  }
}

function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1', bookingNumber: 'HTL-00001', roomId: 'room-1', customerId: 'cust-1',
    guestName: 'Jane Doe', guestPhone: null, guestEmail: null, numberOfGuests: 1,
    checkInDate: new Date('2026-08-01'), checkOutDate: new Date('2026-08-03'),
    actualCheckInAt: null, actualCheckOutAt: null,
    ratePerNight: 2000, status: 'CONFIRMED', advanceAmount: 0, advancePaymentMethod: 'CASH',
    cancelReason: null, notes: null, invoiceId: null,
    createdAt: new Date(), updatedAt: new Date(),
    room: { roomNumber: '101', roomType: 'Deluxe' },
    guests: [], charges: [],
    ...overrides,
  }
}

function makeBaseMockDb() {
  const db: Record<string, any> = {
    hotelRoom: {
      findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(), update: vi.fn().mockResolvedValue({}), delete: vi.fn(),
    },
    hotelBooking: {
      findFirst: vi.fn().mockResolvedValue(null), findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(), update: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(0),
    },
    hotelGuestId: { createMany: vi.fn().mockResolvedValue({}) },
    hotelExtraCharge: {
      create: vi.fn(), delete: vi.fn(), findUnique: vi.fn(),
    },
    // No seasonal rate entries by default — createBooking's calendar lookup
    // is then a pure no-op, matching the flat-rate behavior these
    // pre-existing tests already assert on.
    hotelRateCalendar: { findMany: vi.fn().mockResolvedValue([]) },
    // checkOutBooking always queues a default turnover task alongside the
    // room-status flip — these tests don't assert on it, just need it not
    // to throw.
    hotelHousekeepingTask: { create: vi.fn().mockResolvedValue({}), count: vi.fn().mockResolvedValue(0) },
    product: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() },
  }
  db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('hotel.service — checkAvailability', () => {
  it('rejects an end date before the start date', async () => {
    const db = makeBaseMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await checkAvailability({ roomId: 'room-1', checkInDate: '2026-08-05', checkOutDate: '2026-08-01' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('HTL-013')
  })

  it('detects an overlapping active booking via the interval-overlap formula', async () => {
    const db = makeBaseMockDb()
    db.hotelBooking.findFirst.mockResolvedValue({ id: 'other', bookingNumber: 'HTL-00002' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await checkAvailability({ roomId: 'room-1', checkInDate: '2026-08-01', checkOutDate: '2026-08-05' })
    expect(res.success).toBe(true)
    expect((res as { data: { available: boolean } }).data.available).toBe(false)
  })

  it('reports available when no conflicting booking exists', async () => {
    const db = makeBaseMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await checkAvailability({ roomId: 'room-1', checkInDate: '2026-08-01', checkOutDate: '2026-08-05' })
    expect(res.success).toBe(true)
    expect((res as { data: { available: boolean } }).data.available).toBe(true)
  })
})

describe('hotel.service — createBooking', () => {
  it('rejects a room that is under maintenance', async () => {
    const db = makeBaseMockDb()
    db.hotelRoom.findUnique.mockResolvedValue(makeRoom({ status: 'MAINTENANCE' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBooking({ roomId: 'room-1', guestName: 'Jane', checkInDate: '2026-08-01', checkOutDate: '2026-08-03' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('HTL-024')
  })

  it('rejects a party size larger than the room max occupancy', async () => {
    const db = makeBaseMockDb()
    db.hotelRoom.findUnique.mockResolvedValue(makeRoom({ maxOccupancy: 2 }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBooking({ roomId: 'room-1', guestName: 'Jane', numberOfGuests: 5, checkInDate: '2026-08-01', checkOutDate: '2026-08-03' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('HTL-025')
  })

  it('rejects an overlapping booking re-checked fresh inside the transaction', async () => {
    const db = makeBaseMockDb()
    db.hotelRoom.findUnique.mockResolvedValue(makeRoom())
    db.hotelBooking.findFirst.mockResolvedValue({ id: 'other', bookingNumber: 'HTL-00002' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBooking({ roomId: 'room-1', guestName: 'Jane', checkInDate: '2026-08-01', checkOutDate: '2026-08-03' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('HTL-026')
  })

  it('creates a booking snapshotting the room baseRate when no override rate is given', async () => {
    const db = makeBaseMockDb()
    db.hotelRoom.findUnique.mockResolvedValue(makeRoom({ baseRate: 3500 }))
    db.hotelBooking.create.mockResolvedValue({ id: 'booking-1' })
    db.hotelBooking.findUnique.mockResolvedValue(makeBooking({ ratePerNight: 3500 }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBooking({ roomId: 'room-1', guestName: 'Jane', checkInDate: '2026-08-01', checkOutDate: '2026-08-03' })
    expect(res.success).toBe(true)
    expect(db.hotelBooking.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ ratePerNight: 3500 }),
    }))
  })
})

describe('hotel.service — checkInBooking (guest ID compliance)', () => {
  it('rejects check-in with zero guest ID records', async () => {
    const db = makeBaseMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await checkInBooking({ id: 'booking-1', guests: [] })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('HTL-028')
  })

  it('rejects check-in when a guest record is missing an ID number', async () => {
    const db = makeBaseMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await checkInBooking({ id: 'booking-1', guests: [{ guestName: 'Jane', idType: 'AADHAAR', idNumber: '' }] })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('HTL-031')
  })

  it('rejects check-in for a booking that is not CONFIRMED', async () => {
    const db = makeBaseMockDb()
    db.hotelBooking.findUnique.mockResolvedValue(makeBooking({ status: 'CHECKED_IN' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await checkInBooking({ id: 'booking-1', guests: [{ guestName: 'Jane', idType: 'AADHAAR', idNumber: '1234' }] })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('HTL-032')
  })

  it('checks in successfully, recording guest IDs and marking the room OCCUPIED', async () => {
    const db = makeBaseMockDb()
    db.hotelBooking.findUnique
      .mockResolvedValueOnce(makeBooking({ status: 'CONFIRMED' }))
      .mockResolvedValueOnce(makeBooking({ status: 'CHECKED_IN', guests: [{ id: 'g1', guestName: 'Jane', idType: 'AADHAAR', idNumber: '1234', nationality: 'IN', address: null, isPrimary: true, createdAt: new Date() }] }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await checkInBooking({ id: 'booking-1', guests: [{ guestName: 'Jane', idType: 'AADHAAR', idNumber: '1234' }] })
    expect(res.success).toBe(true)
    expect(db.hotelGuestId.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [expect.objectContaining({ guestName: 'Jane', idType: 'AADHAAR', idNumber: '1234', isPrimary: true })],
    }))
    expect(db.hotelRoom.update).toHaveBeenCalledWith({ where: { id: 'room-1' }, data: { status: 'OCCUPIED' } })
  })
})

describe('hotel.service — checkOutBooking', () => {
  it('rejects check-out for a booking that is not CHECKED_IN', async () => {
    const db = makeBaseMockDb()
    db.hotelBooking.findUnique.mockResolvedValue(makeBooking({ status: 'CONFIRMED' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await checkOutBooking({ id: 'booking-1' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('HTL-034')
  })

  it('checks out successfully, marking the room CLEANING', async () => {
    const db = makeBaseMockDb()
    db.hotelBooking.findUnique
      .mockResolvedValueOnce(makeBooking({ status: 'CHECKED_IN' }))
      .mockResolvedValueOnce(makeBooking({ status: 'CHECKED_OUT' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await checkOutBooking({ id: 'booking-1' })
    expect(res.success).toBe(true)
    expect(db.hotelRoom.update).toHaveBeenCalledWith({ where: { id: 'room-1' }, data: { status: 'CLEANING' } })
  })
})

describe('hotel.service — cancelBooking', () => {
  it('rejects cancelling a booking that is already CHECKED_IN — a physically-present guest must be checked out, not cancelled', async () => {
    const db = makeBaseMockDb()
    db.hotelBooking.findUnique.mockResolvedValue(makeBooking({ status: 'CHECKED_IN' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await cancelBooking({ id: 'booking-1' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('HTL-036')
  })
})

describe('hotel.service — extra charges', () => {
  it('rejects adding a charge unless the booking is CHECKED_IN', async () => {
    const db = makeBaseMockDb()
    db.hotelBooking.findUnique.mockResolvedValue(makeBooking({ status: 'CONFIRMED' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await addExtraCharge({ bookingId: 'booking-1', description: 'Room Service', unitPrice: 500 })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('HTL-043')
  })

  it('computes amount as quantity × unitPrice without float drift', async () => {
    const db = makeBaseMockDb()
    db.hotelBooking.findUnique.mockResolvedValue(makeBooking({ status: 'CHECKED_IN' }))
    db.hotelExtraCharge.create.mockResolvedValue({
      id: 'charge-1', description: 'Laundry', quantity: 3, unitPrice: 33.33, amount: 99.99,
      chargeDate: new Date(), createdAt: new Date(),
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await addExtraCharge({ bookingId: 'booking-1', description: 'Laundry', quantity: 3, unitPrice: 33.33 })
    expect(res.success).toBe(true)
    expect(db.hotelExtraCharge.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ amount: 99.99 }),
    }))
  })

  it('rejects removing a charge once the booking is no longer CHECKED_IN', async () => {
    const db = makeBaseMockDb()
    db.hotelExtraCharge.findUnique.mockResolvedValue({ id: 'charge-1', booking: { status: 'CHECKED_OUT', id: 'booking-1' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await removeExtraCharge({ chargeId: 'charge-1' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('HTL-046')
  })
})

describe('hotel.service — generateHotelInvoice', () => {
  it('rejects generating a second invoice for the same booking (claim-sentinel already consumed)', async () => {
    const db = makeBaseMockDb()
    db.hotelBooking.updateMany.mockResolvedValue({ count: 0 })
    db.hotelBooking.findUnique.mockResolvedValue({ id: 'booking-1', invoiceId: 'inv-real-1' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateHotelInvoice('booking-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('HTL-049')
  })

  it('requires a linked customer before billing', async () => {
    const db = makeBaseMockDb()
    db.hotelBooking.findUnique.mockResolvedValue(makeBooking({ customerId: null }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateHotelInvoice('booking-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('HTL-050')
  })

  it('bills room charge as nights × ratePerNight plus one line per extra charge, and records the advance as a real payment capped at the invoice total', async () => {
    const db = makeBaseMockDb()
    db.hotelBooking.findUnique.mockResolvedValue(makeBooking({
      checkInDate: new Date('2026-08-01'), checkOutDate: new Date('2026-08-04'), // 3 nights
      ratePerNight: 2000, advanceAmount: 1000,
      charges: [{ id: 'c1', description: 'Room Service', quantity: 1, unitPrice: 300, amount: 300 }],
    }))
    db.product.findFirst.mockResolvedValue(null)
    db.product.create.mockImplementation(({ data }: { data: { productName: string } }) => Promise.resolve({ id: `prod-${data.productName}`, ...data }))
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1', totalAmount: 6300 } } as never)

    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateHotelInvoice('booking-1', 'user-1')
    expect(res.success).toBe(true)

    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'cust-1',
      items: [
        expect.objectContaining({ unitPrice: 6000 }), // 3 nights x 2000
        expect.objectContaining({ unitPrice: 300, quantity: 1 }),
      ],
    }))
    expect(paymentService.recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceId: 'inv-1', paymentMethod: 'CASH', amount: 1000 }),
      'user-1'
    )
  })

  // Regression for a real bug found 2026-07-22: the room-charge and
  // extra-charge placeholder Products used to be created with a hardcoded
  // taxRate: 0, so every hotel invoice was generated at 0% tax unconditionally.
  it('creates the room-charge and extra-charge placeholder products with non-zero, owner-editable tax rates, not hardcoded to 0', async () => {
    const db = makeBaseMockDb()
    db.hotelBooking.findUnique.mockResolvedValue(makeBooking({
      checkInDate: new Date('2026-08-01'), checkOutDate: new Date('2026-08-04'),
      ratePerNight: 2000,
      charges: [{ id: 'c1', description: 'Room Service', quantity: 1, unitPrice: 300, amount: 300 }],
    }))
    db.product.findFirst.mockResolvedValue(null)
    db.product.create.mockImplementation(({ data }: { data: { productName: string; taxRate: number } }) => Promise.resolve({ id: `prod-${data.productName}`, ...data }))
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1', totalAmount: 6300 } } as never)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateHotelInvoice('booking-1', 'user-1')
    expect(res.success).toBe(true)

    const roomChargeCall = db.product.create.mock.calls.find((c: [{ data: { productName: string } }]) => c[0].data.productName.includes('Room Charge'))
    const extraChargeCall = db.product.create.mock.calls.find((c: [{ data: { productName: string } }]) => c[0].data.productName === 'Room Service')
    expect(roomChargeCall?.[0].data.taxRate).toBeGreaterThan(0)
    expect(extraChargeCall?.[0].data.taxRate).toBeGreaterThan(0)
  })

  it('caps the recorded advance payment at the invoice total, never recording more than what is owed', async () => {
    const db = makeBaseMockDb()
    db.hotelBooking.findUnique.mockResolvedValue(makeBooking({
      checkInDate: new Date('2026-08-01'), checkOutDate: new Date('2026-08-02'), // 1 night
      ratePerNight: 1000, advanceAmount: 5000, // advance exceeds the eventual bill
    }))
    db.product.findFirst.mockResolvedValue({ id: 'prod-room', taxRate: 0 })
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-2', totalAmount: 1000 } } as never)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateHotelInvoice('booking-1')
    expect(res.success).toBe(true)
    expect(paymentService.recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 1000 }), // capped, not the full 5000 advance
      undefined
    )
  })

  it('releases the invoiceId claim if billing.createInvoice fails, so the booking is not left permanently stuck', async () => {
    const db = makeBaseMockDb()
    db.hotelBooking.findUnique.mockResolvedValue(makeBooking())
    db.product.findFirst.mockResolvedValue({ id: 'prod-room', taxRate: 0 })
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'INVOC-002', message: 'Invoice total cannot be negative.' } } as never)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateHotelInvoice('booking-1')
    expect(res.success).toBe(false)
    expect(db.hotelBooking.update).toHaveBeenCalledWith({ where: { id: 'booking-1' }, data: { invoiceId: null } })
  })
})

describe('hotel.service — createBooking seasonal rate calendar', () => {
  it('uses the room baseRate flat when no calendar entry matches the stay', async () => {
    const db = makeBaseMockDb()
    db.hotelRoom.findUnique.mockResolvedValue(makeRoom({ baseRate: 2000, roomType: 'Deluxe' }))
    db.hotelRateCalendar.findMany.mockResolvedValue([])
    db.hotelBooking.create.mockResolvedValue({ id: 'booking-1' })
    db.hotelBooking.findUnique.mockResolvedValue(makeBooking())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createBooking({ roomId: 'room-1', guestName: 'Jane', checkInDate: '2026-08-01', checkOutDate: '2026-08-03' })

    const call = db.hotelBooking.create.mock.calls[0][0]
    expect(call.data.ratePerNight).toBe(2000)
    expect(call.data.roomChargeTotal).toBeNull()
  })

  it('sums a per-night calendar-resolved rate across a 2-night stay, storing the true total and the average as ratePerNight', async () => {
    const db = makeBaseMockDb()
    db.hotelRoom.findUnique.mockResolvedValue(makeRoom({ baseRate: 2000, roomType: 'Deluxe' }))
    // Night 1 (Aug 1) hits a season entry at 3000; night 2 (Aug 2) has no match, falls back to baseRate 2000.
    db.hotelRateCalendar.findMany.mockImplementation(({ where }: { where: { startDate: { lte: Date } } }) => {
      const day = where.startDate.lte.getDate()
      return Promise.resolve(day === 1 ? [{ id: 'r1', roomType: 'Deluxe', rate: 3000, createdAt: new Date('2026-01-01') }] : [])
    })
    db.hotelBooking.create.mockResolvedValue({ id: 'booking-1' })
    db.hotelBooking.findUnique.mockResolvedValue(makeBooking())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createBooking({ roomId: 'room-1', guestName: 'Jane', checkInDate: '2026-08-01', checkOutDate: '2026-08-03' })

    const call = db.hotelBooking.create.mock.calls[0][0]
    expect(call.data.roomChargeTotal).toBe(5000) // 3000 + 2000
    expect(call.data.ratePerNight).toBe(2500) // average, display-only
  })

  it('bypasses the calendar entirely when a manual ratePerNight override is given', async () => {
    const db = makeBaseMockDb()
    db.hotelRoom.findUnique.mockResolvedValue(makeRoom({ baseRate: 2000, roomType: 'Deluxe' }))
    db.hotelBooking.create.mockResolvedValue({ id: 'booking-1' })
    db.hotelBooking.findUnique.mockResolvedValue(makeBooking())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createBooking({ roomId: 'room-1', guestName: 'Jane', checkInDate: '2026-08-01', checkOutDate: '2026-08-03', ratePerNight: 9999 })

    expect(db.hotelRateCalendar.findMany).not.toHaveBeenCalled()
    const call = db.hotelBooking.create.mock.calls[0][0]
    expect(call.data.ratePerNight).toBe(9999)
    expect(call.data.roomChargeTotal).toBeNull()
  })
})

describe('hotel.service — createBooking day-use', () => {
  it('forces the checkout to checkIn+1 day and prices at the room dayUseRate', async () => {
    const db = makeBaseMockDb()
    db.hotelRoom.findUnique.mockResolvedValue(makeRoom({ baseRate: 2000, dayUseRate: 800 }))
    db.hotelBooking.create.mockResolvedValue({ id: 'booking-1' })
    db.hotelBooking.findUnique.mockResolvedValue(makeBooking())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBooking({ roomId: 'room-1', guestName: 'Jane', checkInDate: '2026-08-01', bookingType: 'DAY_USE' })
    expect(res.success).toBe(true)

    const call = db.hotelBooking.create.mock.calls[0][0]
    expect(call.data.ratePerNight).toBe(800)
    expect(call.data.roomChargeTotal).toBe(800)
    expect(call.data.bookingType).toBe('DAY_USE')
    expect(call.data.checkOutDate).toEqual(new Date(2026, 7, 2))
    expect(db.hotelRateCalendar.findMany).not.toHaveBeenCalled()
  })

  it('falls back to half the base rate when the room has no dayUseRate set', async () => {
    const db = makeBaseMockDb()
    db.hotelRoom.findUnique.mockResolvedValue(makeRoom({ baseRate: 2000, dayUseRate: null }))
    db.hotelBooking.create.mockResolvedValue({ id: 'booking-1' })
    db.hotelBooking.findUnique.mockResolvedValue(makeBooking())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createBooking({ roomId: 'room-1', guestName: 'Jane', checkInDate: '2026-08-01', bookingType: 'DAY_USE' })

    const call = db.hotelBooking.create.mock.calls[0][0]
    expect(call.data.ratePerNight).toBe(1000)
  })
})

describe('hotel.service — createBooking channel tagging', () => {
  it('defaults to WALK_IN when no channel is given', async () => {
    const db = makeBaseMockDb()
    db.hotelRoom.findUnique.mockResolvedValue(makeRoom())
    db.hotelBooking.create.mockResolvedValue({ id: 'booking-1' })
    db.hotelBooking.findUnique.mockResolvedValue(makeBooking())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createBooking({ roomId: 'room-1', guestName: 'Jane', checkInDate: '2026-08-01', checkOutDate: '2026-08-03' })
    expect(db.hotelBooking.create.mock.calls[0][0].data.channel).toBe('WALK_IN')
  })

  it('persists an explicit OTA channel', async () => {
    const db = makeBaseMockDb()
    db.hotelRoom.findUnique.mockResolvedValue(makeRoom())
    db.hotelBooking.create.mockResolvedValue({ id: 'booking-1' })
    db.hotelBooking.findUnique.mockResolvedValue(makeBooking())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createBooking({ roomId: 'room-1', guestName: 'Jane', checkInDate: '2026-08-01', checkOutDate: '2026-08-03', channel: 'BOOKING_COM' })
    expect(db.hotelBooking.create.mock.calls[0][0].data.channel).toBe('BOOKING_COM')
  })
})

describe('hotel.service — checkOutBooking auto-queues a housekeeping task', () => {
  it('creates a default turnover task for the room alongside the CLEANING status flip', async () => {
    const db = makeBaseMockDb()
    db.hotelBooking.findUnique.mockResolvedValue(makeBooking({ status: 'CHECKED_IN' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await checkOutBooking({ id: 'booking-1' })
    expect(res.success).toBe(true)
    expect(db.hotelHousekeepingTask.create).toHaveBeenCalledWith({
      data: { roomId: 'room-1', bookingId: 'booking-1', taskLabel: 'Clean & inspect room after checkout' },
    })
  })
})

describe('hotel.service — updateHousekeepingTaskStatus', () => {
  function makeHkDb() {
    const db = makeBaseMockDb()
    db.hotelHousekeepingTask = {
      findUnique: vi.fn(), update: vi.fn(), count: vi.fn(),
    }
    return db
  }

  it('flips a CLEANING room back to AVAILABLE once the last open task is marked DONE', async () => {
    const db = makeHkDb()
    db.hotelHousekeepingTask.findUnique.mockResolvedValue({ id: 'task-1', roomId: 'room-1' })
    db.hotelHousekeepingTask.update.mockResolvedValue({ id: 'task-1', roomId: 'room-1', bookingId: null, taskLabel: 'Clean', status: 'DONE', assignedToId: null, completedAt: new Date(), notes: null, createdAt: new Date(), room: { roomNumber: '101' }, assignedTo: null })
    db.hotelHousekeepingTask.count.mockResolvedValue(0) // no other open tasks left
    db.hotelRoom.findUnique.mockResolvedValue(makeRoom({ status: 'CLEANING' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateHousekeepingTaskStatus({ id: 'task-1', status: 'DONE' })
    expect(res.success).toBe(true)
    expect(db.hotelRoom.update).toHaveBeenCalledWith({ where: { id: 'room-1' }, data: { status: 'AVAILABLE' } })
  })

  it('does not touch the room status while other tasks for that room are still open', async () => {
    const db = makeHkDb()
    db.hotelHousekeepingTask.findUnique.mockResolvedValue({ id: 'task-1', roomId: 'room-1' })
    db.hotelHousekeepingTask.update.mockResolvedValue({ id: 'task-1', roomId: 'room-1', bookingId: null, taskLabel: 'Clean', status: 'DONE', assignedToId: null, completedAt: new Date(), notes: null, createdAt: new Date(), room: { roomNumber: '101' }, assignedTo: null })
    db.hotelHousekeepingTask.count.mockResolvedValue(1) // one other task still open
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateHousekeepingTaskStatus({ id: 'task-1', status: 'DONE' })
    expect(res.success).toBe(true)
    expect(db.hotelRoom.update).not.toHaveBeenCalled()
  })

  it('does not auto-flip a room that is not currently CLEANING (e.g. already re-booked to OCCUPIED)', async () => {
    const db = makeHkDb()
    db.hotelHousekeepingTask.findUnique.mockResolvedValue({ id: 'task-1', roomId: 'room-1' })
    db.hotelHousekeepingTask.update.mockResolvedValue({ id: 'task-1', roomId: 'room-1', bookingId: null, taskLabel: 'Clean', status: 'DONE', assignedToId: null, completedAt: new Date(), notes: null, createdAt: new Date(), room: { roomNumber: '101' }, assignedTo: null })
    db.hotelHousekeepingTask.count.mockResolvedValue(0)
    db.hotelRoom.findUnique.mockResolvedValue(makeRoom({ status: 'OCCUPIED' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateHousekeepingTaskStatus({ id: 'task-1', status: 'DONE' })
    expect(res.success).toBe(true)
    expect(db.hotelRoom.update).not.toHaveBeenCalled()
  })
})

describe('hotel.service — generateGroupHotelInvoice', () => {
  function makeGroupBooking(overrides: Record<string, unknown> = {}) {
    return makeBooking({
      status: 'CHECKED_OUT', invoiceId: null, customerId: 'cust-1',
      room: { roomNumber: '101', roomType: 'Deluxe' },
      ...overrides,
    })
  }

  it('rejects fewer than two bookings', async () => {
    const res = await generateGroupHotelInvoice(['b1'])
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('HTL-055')
  })

  it('combines two checked-out bookings for the same customer into one invoice and writes the invoiceId onto both', async () => {
    const db = makeBaseMockDb()
    db.hotelBooking.findMany.mockResolvedValue([
      makeGroupBooking({ id: 'b1', bookingNumber: 'HTL-00001', room: { roomNumber: '101', roomType: 'Deluxe' } }),
      makeGroupBooking({ id: 'b2', bookingNumber: 'HTL-00002', room: { roomNumber: '102', roomType: 'Deluxe' } }),
    ])
    db.product.findFirst.mockResolvedValue(null)
    db.product.create.mockImplementation(({ data }: { data: { productName: string } }) => Promise.resolve({ id: `prod-${data.productName}`, ...data }))
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-combined', totalAmount: 8000 } } as never)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateGroupHotelInvoice(['b1', 'b2'], 'user-1')
    expect(res.success).toBe(true)
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({ customerId: 'cust-1' }))
    expect(db.hotelBooking.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['b1', 'b2'] } }, data: { invoiceId: 'inv-combined' } })
  })

  it('rejects a group where the bookings belong to different customers', async () => {
    const db = makeBaseMockDb()
    db.hotelBooking.findMany.mockResolvedValue([
      makeGroupBooking({ id: 'b1', customerId: 'cust-1' }),
      makeGroupBooking({ id: 'b2', customerId: 'cust-2' }),
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateGroupHotelInvoice(['b1', 'b2'])
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('HTL-058')
    // The claim must be rolled back, not left dangling on the sentinel value.
    expect(db.hotelBooking.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['b1', 'b2'] } }, data: { invoiceId: null } })
  })

  it('rejects a group where a booking is not yet checked out', async () => {
    const db = makeBaseMockDb()
    db.hotelBooking.findMany.mockResolvedValue([
      makeGroupBooking({ id: 'b1' }),
      makeGroupBooking({ id: 'b2', status: 'CHECKED_IN' }),
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateGroupHotelInvoice(['b1', 'b2'])
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('HTL-057')
  })

  it('rolls back the whole claim when one booking in the group is already invoiced', async () => {
    const db = makeBaseMockDb()
    db.hotelBooking.updateMany.mockImplementation(({ where }: { where: { id: string } }) =>
      Promise.resolve({ count: where.id === 'b2' ? 0 : 1 })
    )
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateGroupHotelInvoice(['b1', 'b2'])
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('HTL-056')
    // b1 was claimed before b2's claim failed — it must be rolled back too.
    expect(db.hotelBooking.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['b1'] } }, data: { invoiceId: null } })
  })
})

describe('hotel.service — getCustomerStayHistory', () => {
  it('reports zero stays for a customer with no prior bookings', async () => {
    const db = makeBaseMockDb()
    db.hotelBooking.findMany.mockResolvedValue([])
    db.hotelBooking.count.mockResolvedValue(0)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getCustomerStayHistory('cust-new')
    expect(res.success).toBe(true)
    expect((res as { data: { stayCount: number; lastStayCheckOut: string | null } }).data).toEqual({ stayCount: 0, lastStayCheckOut: null })
  })

  it('reports the stay count and most recent checkout for a returning guest', async () => {
    const db = makeBaseMockDb()
    db.hotelBooking.findMany.mockResolvedValue([{ checkOutDate: new Date('2026-06-15') }])
    db.hotelBooking.count.mockResolvedValue(3)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getCustomerStayHistory('cust-1')
    expect(res.success).toBe(true)
    expect((res as { data: { stayCount: number } }).data.stayCount).toBe(3)
    expect((res as { data: { lastStayCheckOut: string | null } }).data.lastStayCheckOut).toBe(new Date('2026-06-15').toISOString())
  })
})
