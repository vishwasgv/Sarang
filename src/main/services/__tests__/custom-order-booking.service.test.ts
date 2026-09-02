import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))
vi.mock('../sequence.service', () => ({ generateSequenceNumber: vi.fn().mockResolvedValue('COB-00001') }))
vi.mock('../payment.service', () => ({ paymentService: { recordPayment: vi.fn().mockResolvedValue({ success: true }) } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { paymentService } from '../payment.service'
import { createCustomOrderBooking, generateCustomOrderInvoice } from '../custom-order-booking.service'

// 2026-09 §12 — Bakery item 2: Custom Order Booking with Advance. Direct
// structural mirror of furniture-booking.service.test.ts's own coverage.

function makeMockDb() {
  const db: Record<string, any> = {
    customer: { findUnique: vi.fn().mockResolvedValue({ id: 'cust-1', customerName: 'Priya' }) },
    customOrderBooking: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'cob-1', ...data, items: [], customer: null })),
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

describe('custom-order-booking.service.createCustomOrderBooking', () => {
  it('rejects an order with no items', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createCustomOrderBooking({ customerId: 'cust-1', items: [] })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('COB-001')
  })

  it('rejects an advance greater than the order total', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createCustomOrderBooking({
      customerId: 'cust-1', advanceAmount: 5000,
      items: [{ productId: 'prod-1', quantity: 1, unitPrice: 1000 }],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('COB-004')
  })

  it('creates an order with a sequence-numbered bookingNumber', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createCustomOrderBooking({
      customerId: 'cust-1', advanceAmount: 500,
      items: [{ productId: 'prod-1', quantity: 1, unitPrice: 2000, customFlavor: 'Chocolate' }],
    })

    expect(res.success).toBe(true)
    const data = (res as { data: { bookingNumber: string } }).data
    expect(data.bookingNumber).toBe('COB-00001')
  })
})

describe('custom-order-booking.service.generateCustomOrderInvoice', () => {
  it('rejects generating a second invoice for the same order (claim-sentinel already consumed)', async () => {
    const db = makeMockDb()
    db.customOrderBooking.updateMany.mockResolvedValue({ count: 0 })
    db.customOrderBooking.findUnique.mockResolvedValue({ id: 'cob-1', invoiceId: 'inv-real-1' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateCustomOrderInvoice('cob-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('COB-012')
  })

  it('builds invoice items directly from real order items and records the capped advance as a payment', async () => {
    const db = makeMockDb()
    db.customOrderBooking.findUnique.mockResolvedValue({
      id: 'cob-1', bookingNumber: 'COB-00001', customerId: 'cust-1', advanceAmount: 1000, advancePaymentMethod: 'CASH',
      items: [{ productId: 'prod-1', quantity: 2, unitPrice: 3000 }],
    })
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1', totalAmount: 6000 } } as never)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateCustomOrderInvoice('cob-1', 'user-1')

    expect(res.success).toBe(true)
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'cust-1',
      items: [{ productId: 'prod-1', quantity: 2, unitPrice: 3000 }],
    }))
    expect(paymentService.recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceId: 'inv-1', amount: 1000 }), 'user-1'
    )
    expect(db.customOrderBooking.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'cob-1' }, data: { invoiceId: 'inv-1', status: 'DELIVERED' },
    }))
  })

  it('caps the recorded advance payment at the invoice total', async () => {
    const db = makeMockDb()
    db.customOrderBooking.findUnique.mockResolvedValue({
      id: 'cob-1', bookingNumber: 'COB-00001', customerId: 'cust-1', advanceAmount: 5000, advancePaymentMethod: 'CASH',
      items: [{ productId: 'prod-1', quantity: 1, unitPrice: 1000 }],
    })
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-2', totalAmount: 1000 } } as never)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateCustomOrderInvoice('cob-1')

    expect(res.success).toBe(true)
    expect(paymentService.recordPayment).toHaveBeenCalledWith(expect.objectContaining({ amount: 1000 }), undefined)
  })
})
