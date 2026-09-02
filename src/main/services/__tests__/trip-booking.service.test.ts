import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn(), getOrCreateServiceProduct: vi.fn().mockResolvedValue({ success: true, data: { id: 'svc-prod-1' } }) } }))
vi.mock('../sequence.service', () => ({ generateSequenceNumber: vi.fn().mockResolvedValue('TRP-00001') }))
vi.mock('../payment.service', () => ({ paymentService: { recordPayment: vi.fn().mockResolvedValue({ success: true }) } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { paymentService } from '../payment.service'
import { createCharterBooking, createSeatBooking, generateTripInvoice, updateTripBookingStatus } from '../trip-booking.service'

beforeEach(() => vi.clearAllMocks())

describe('trip-booking.service.createCharterBooking', () => {
  it('rejects an advance greater than the package rate', async () => {
    const db = {
      customer: { findUnique: vi.fn().mockResolvedValue({ id: 'cust-1' }) },
      tourVehicle: { findUnique: vi.fn().mockResolvedValue({ id: 'v-1', status: 'ACTIVE' }) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createCharterBooking({ customerId: 'cust-1', vehicleId: 'v-1', tripStartDate: '2024-06-01', packageRate: 5000, advanceAmount: 6000 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TRB-006')
  })

  it('rejects booking a vehicle that is not ACTIVE', async () => {
    const db = {
      customer: { findUnique: vi.fn().mockResolvedValue({ id: 'cust-1' }) },
      tourVehicle: { findUnique: vi.fn().mockResolvedValue({ id: 'v-1', status: 'IN_SERVICE' }) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createCharterBooking({ customerId: 'cust-1', vehicleId: 'v-1', tripStartDate: '2024-06-01', packageRate: 5000 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TRB-003')
  })

  it('creates a charter booking with a sequence-numbered bookingNumber', async () => {
    const db: Record<string, any> = {
      customer: { findUnique: vi.fn().mockResolvedValue({ id: 'cust-1' }) },
      tourVehicle: { findUnique: vi.fn().mockResolvedValue({ id: 'v-1', status: 'ACTIVE' }) },
      tripBooking: {
        create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'trp-1', ...data })),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    }
    db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createCharterBooking({ customerId: 'cust-1', vehicleId: 'v-1', tripStartDate: '2024-06-01', packageRate: 5000, includedKmPerDay: 300 })

    expect(res.success).toBe(true)
    expect((res as { data: { bookingNumber: string } }).data.bookingNumber).toBe('TRP-00001')
  })
})

describe('trip-booking.service.createSeatBooking', () => {
  function makeDb(departure: Record<string, unknown>) {
    const tx: Record<string, any> = {
      tourDeparture: { findUnique: vi.fn().mockResolvedValue(departure), update: vi.fn().mockResolvedValue({}) },
      tripBooking: {
        create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'trp-1', ...data })),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    }
    const db: Record<string, any> = {
      customer: { findUnique: vi.fn().mockResolvedValue({ id: 'cust-1' }) },
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
    }
    return { db, tx }
  }

  it('rejects booking more seats than remain on the departure', async () => {
    const { db } = makeDb({ id: 'dep-1', status: 'SCHEDULED', totalSeats: 20, seatsBooked: 18, tourPackage: { farePerSeat: 1000 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createSeatBooking({ customerId: 'cust-1', tourDepartureId: 'dep-1', seatsBooked: 5 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TRB-010')
  })

  it('rejects booking on a departure that is not SCHEDULED', async () => {
    const { db } = makeDb({ id: 'dep-1', status: 'CANCELLED', totalSeats: 20, seatsBooked: 0, tourPackage: { farePerSeat: 1000 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createSeatBooking({ customerId: 'cust-1', tourDepartureId: 'dep-1', seatsBooked: 2 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TRB-009')
  })

  it('computes packageRate as seats × farePerSeat and atomically increments seatsBooked', async () => {
    const { db, tx } = makeDb({ id: 'dep-1', status: 'SCHEDULED', totalSeats: 20, seatsBooked: 10, tourPackage: { farePerSeat: 1500 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createSeatBooking({ customerId: 'cust-1', tourDepartureId: 'dep-1', seatsBooked: 3 })

    expect(res.success).toBe(true)
    expect((res as { data: { packageRate: number } }).data.packageRate).toBe(4500)
    expect(tx.tourDeparture.update).toHaveBeenCalledWith({ where: { id: 'dep-1' }, data: { seatsBooked: { increment: 3 } } })
  })

  it('rejects an advance greater than the computed seat-booking package rate', async () => {
    const { db } = makeDb({ id: 'dep-1', status: 'SCHEDULED', totalSeats: 20, seatsBooked: 0, tourPackage: { farePerSeat: 1000 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createSeatBooking({ customerId: 'cust-1', tourDepartureId: 'dep-1', seatsBooked: 2, advanceAmount: 5000 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TRB-006')
  })
})

describe('trip-booking.service.updateTripBookingStatus', () => {
  // 2026-09-02 — real bug found via manual audit: cancelling a SEAT booking
  // must release its held seats back to the departure, or they stay
  // phantom-held forever, permanently shrinking real capacity.
  it('releases seats back to the departure when cancelling a still-active SEAT booking', async () => {
    const tx: Record<string, any> = {
      tripBooking: { update: vi.fn().mockResolvedValue({ id: 'trp-1', status: 'CANCELLED' }) },
      tourDeparture: { update: vi.fn().mockResolvedValue({}) },
    }
    const db: Record<string, any> = {
      tripBooking: { findUnique: vi.fn().mockResolvedValue({ id: 'trp-1', status: 'BOOKED', bookingType: 'SEAT', tourDepartureId: 'dep-1', seatsBooked: 3 }) },
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateTripBookingStatus('trp-1', 'CANCELLED')

    expect(res.success).toBe(true)
    expect(tx.tourDeparture.update).toHaveBeenCalledWith({ where: { id: 'dep-1' }, data: { seatsBooked: { decrement: 3 } } })
  })

  it('does not touch the departure when cancelling a CHARTER booking', async () => {
    const tx: Record<string, any> = {
      tripBooking: { update: vi.fn().mockResolvedValue({ id: 'trp-2', status: 'CANCELLED' }) },
      tourDeparture: { update: vi.fn().mockResolvedValue({}) },
    }
    const db: Record<string, any> = {
      tripBooking: { findUnique: vi.fn().mockResolvedValue({ id: 'trp-2', status: 'BOOKED', bookingType: 'CHARTER', tourDepartureId: null, seatsBooked: null }) },
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateTripBookingStatus('trp-2', 'CANCELLED')

    expect(tx.tourDeparture.update).not.toHaveBeenCalled()
  })

  it('does not double-decrement when a SEAT booking is already cancelled', async () => {
    const tx: Record<string, any> = {
      tripBooking: { update: vi.fn().mockResolvedValue({ id: 'trp-3', status: 'CANCELLED' }) },
      tourDeparture: { update: vi.fn().mockResolvedValue({}) },
    }
    const db: Record<string, any> = {
      tripBooking: { findUnique: vi.fn().mockResolvedValue({ id: 'trp-3', status: 'CANCELLED', bookingType: 'SEAT', tourDepartureId: 'dep-1', seatsBooked: 2 }) },
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateTripBookingStatus('trp-3', 'CANCELLED')

    expect(tx.tourDeparture.update).not.toHaveBeenCalled()
  })
})

describe('trip-booking.service.generateTripInvoice', () => {
  it('rejects generating a second invoice for the same booking', async () => {
    const db: Record<string, any> = {
      tripBooking: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue({ id: 'trp-1', invoiceId: 'inv-real-1' }),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateTripInvoice('trp-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TRB-013')
  })

  it('bills packageRate plus settled excess-km/hour charges from closed duty logs, and records the capped advance', async () => {
    const db: Record<string, any> = {
      tripBooking: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'trp-1', bookingNumber: 'TRP-00001', bookingType: 'CHARTER', customerId: 'cust-1',
          packageRate: 5000, advanceAmount: 1000, advancePaymentMethod: 'CASH',
          dutyLogs: [{ excessKmCharge: 600, excessHourCharge: 200 }],
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    }
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1', totalAmount: 5800 } } as never)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateTripInvoice('trp-1', 'user-1')

    expect(res.success).toBe(true)
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'cust-1',
      items: [{ productId: 'svc-prod-1', quantity: 1, unitPrice: 5800 }],
    }))
    expect(paymentService.recordPayment).toHaveBeenCalledWith(expect.objectContaining({ invoiceId: 'inv-1', amount: 1000 }), 'user-1')
    expect(db.tripBooking.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'trp-1' }, data: { invoiceId: 'inv-1', status: 'COMPLETED' } }))
  })

  it('bills only the package rate when there are no closed duty logs yet', async () => {
    const db: Record<string, any> = {
      tripBooking: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'trp-2', bookingNumber: 'TRP-00002', bookingType: 'SEAT', customerId: 'cust-1',
          packageRate: 3000, advanceAmount: 0, advancePaymentMethod: 'CASH', dutyLogs: [],
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    }
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-2', totalAmount: 3000 } } as never)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateTripInvoice('trp-2')

    expect(res.success).toBe(true)
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({ items: [{ productId: 'svc-prod-1', quantity: 1, unitPrice: 3000 }] }))
  })
})
