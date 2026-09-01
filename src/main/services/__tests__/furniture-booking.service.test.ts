import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))
vi.mock('../sequence.service', () => ({ generateSequenceNumber: vi.fn().mockResolvedValue('FBK-00001') }))
vi.mock('../payment.service', () => ({ paymentService: { recordPayment: vi.fn().mockResolvedValue({ success: true }) } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { paymentService } from '../payment.service'
import { createFurnitureBooking, generateFurnitureInvoice, getBookedOrderCashFlowForecast } from '../furniture-booking.service'

function makeMockDb() {
  const db: Record<string, any> = {
    customer: { findUnique: vi.fn().mockResolvedValue({ id: 'cust-1', customerName: 'Ramesh' }) },
    furnitureBooking: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'fbk-1', ...data, items: [], customer: null })),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  }
  db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('furniture-booking.service.createFurnitureBooking', () => {
  it('rejects a booking with no items', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createFurnitureBooking({ customerId: 'cust-1', items: [] })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('FBK-001')
  })

  it('rejects an advance greater than the booking total', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createFurnitureBooking({
      customerId: 'cust-1', advanceAmount: 5000,
      items: [{ productId: 'prod-1', quantity: 1, unitPrice: 1000 }],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('FBK-004')
  })

  it('creates a booking with a sequence-numbered bookingNumber', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createFurnitureBooking({
      customerId: 'cust-1', advanceAmount: 500,
      items: [{ productId: 'prod-1', quantity: 1, unitPrice: 2000, customFabric: 'Velvet' }],
    })

    expect(res.success).toBe(true)
    const data = (res as { data: { bookingNumber: string } }).data
    expect(data.bookingNumber).toBe('FBK-00001')
  })
})

describe('furniture-booking.service.generateFurnitureInvoice', () => {
  it('rejects generating a second invoice for the same booking (claim-sentinel already consumed)', async () => {
    const db = makeMockDb()
    db.furnitureBooking.updateMany.mockResolvedValue({ count: 0 })
    db.furnitureBooking.findUnique.mockResolvedValue({ id: 'fbk-1', invoiceId: 'inv-real-1' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateFurnitureInvoice('fbk-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('FBK-012')
  })

  it('builds invoice items directly from real booking items (no placeholder products) and records the capped advance as a payment', async () => {
    const db = makeMockDb()
    db.furnitureBooking.findUnique.mockResolvedValue({
      id: 'fbk-1', bookingNumber: 'FBK-00001', customerId: 'cust-1', advanceAmount: 1000, advancePaymentMethod: 'CASH',
      items: [{ productId: 'prod-1', quantity: 2, unitPrice: 3000 }],
    })
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1', totalAmount: 6000 } } as never)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateFurnitureInvoice('fbk-1', 'user-1')

    expect(res.success).toBe(true)
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 2, unitPrice: 3000 }],
    }))
    expect(paymentService.recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceId: 'inv-1', amount: 1000 }), 'user-1'
    )
    expect(db.furnitureBooking.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'fbk-1' }, data: { invoiceId: 'inv-1', status: 'DELIVERED' },
    }))
  })

  it('caps the recorded advance payment at the invoice total', async () => {
    const db = makeMockDb()
    db.furnitureBooking.findUnique.mockResolvedValue({
      id: 'fbk-1', bookingNumber: 'FBK-00001', customerId: 'cust-1', advanceAmount: 5000, advancePaymentMethod: 'CASH',
      items: [{ productId: 'prod-1', quantity: 1, unitPrice: 1000 }],
    })
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-2', totalAmount: 1000 } } as never)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateFurnitureInvoice('fbk-1')

    expect(res.success).toBe(true)
    expect(paymentService.recordPayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 1000 }), undefined)
  })
})

describe('furniture-booking.service.getBookedOrderCashFlowForecast', () => {
  it('buckets balance-due (total minus advance) by delivery month, and unscheduled bookings separately', async () => {
    const db = makeMockDb()
    db.furnitureBooking.findMany = vi.fn().mockResolvedValue([
      { id: 'fbk-1', advanceAmount: 1000, deliveryDate: new Date('2026-10-15'), items: [{ quantity: 1, unitPrice: 5000 }] },
      { id: 'fbk-2', advanceAmount: 0, deliveryDate: new Date('2026-10-20'), items: [{ quantity: 2, unitPrice: 1000 }] },
      { id: 'fbk-3', advanceAmount: 500, deliveryDate: null, items: [{ quantity: 1, unitPrice: 500 }] },
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getBookedOrderCashFlowForecast()

    expect(res.success).toBe(true)
    const data = (res as { data: { rows: Array<{ month: string; bookingCount: number; expectedBalanceDue: number }>; summary: { totalExpectedBalanceDue: number } } }).data
    const octRow = data.rows.find(r => r.month === '2026-10')
    expect(octRow).toEqual({ month: '2026-10', bookingCount: 2, expectedBalanceDue: 4000 + 2000 })
    const unscheduledRow = data.rows.find(r => r.month === 'Unscheduled')
    expect(unscheduledRow?.expectedBalanceDue).toBe(0) // 500 total - 500 advance
    expect(data.summary.totalExpectedBalanceDue).toBe(6000)
  })

  it('never reports a negative balance due when the advance exceeds the booking total', async () => {
    const db = makeMockDb()
    db.furnitureBooking.findMany = vi.fn().mockResolvedValue([
      { id: 'fbk-1', advanceAmount: 9000, deliveryDate: new Date('2026-11-01'), items: [{ quantity: 1, unitPrice: 1000 }] },
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getBookedOrderCashFlowForecast()

    const data = (res as { data: { rows: Array<{ expectedBalanceDue: number }> } }).data
    expect(data.rows[0].expectedBalanceDue).toBe(0)
  })
})
