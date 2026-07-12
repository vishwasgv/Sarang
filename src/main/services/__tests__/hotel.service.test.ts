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
    },
    hotelGuestId: { createMany: vi.fn().mockResolvedValue({}) },
    hotelExtraCharge: {
      create: vi.fn(), delete: vi.fn(), findUnique: vi.fn(),
    },
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
