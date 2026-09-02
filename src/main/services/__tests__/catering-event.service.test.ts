import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../billing.service', () => ({
  billingService: {
    createInvoice: vi.fn(),
    getOrCreateServiceProduct: vi.fn().mockResolvedValue({ success: true, data: { id: 'svc-catering-1' } }),
  },
}))
vi.mock('../sequence.service', () => ({ generateSequenceNumber: vi.fn().mockResolvedValue('CAT-00001') }))
vi.mock('../payment.service', () => ({ paymentService: { recordPayment: vi.fn().mockResolvedValue({ success: true }) } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { paymentService } from '../payment.service'
import { createCateringEvent, recordFinalNegotiatedPrice, generateCateringEventInvoice } from '../catering-event.service'

// 2026-09-02 — Catering event booking. Direct structural mirror of
// custom-order-booking.service.test.ts's own coverage, plus tests for the
// two pieces custom-order-booking has no equivalent of: per-role staffing
// cost math and the distinct "final negotiated price" action.

function makeMockDb() {
  const db: Record<string, any> = {
    customer: { findUnique: vi.fn().mockResolvedValue({ id: 'cust-1', customerName: 'Priya' }) },
    cateringEvent: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'cat-1', ...data, menuItems: [], days: [], staff: [], customer: null })),
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

describe('catering-event.service.createCateringEvent', () => {
  it('rejects a zero attendee count', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createCateringEvent({ customerId: 'cust-1', eventStartDate: '2026-10-01', attendeeCount: 0, pricePerPlate: 500 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CAT-001')
  })

  it('rejects an advance greater than the estimated total (price per plate × attendees)', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createCateringEvent({
      customerId: 'cust-1', eventStartDate: '2026-10-01', attendeeCount: 100, pricePerPlate: 500, advanceAmount: 100000,
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CAT-008')
  })

  it('rejects an invalid staff role', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createCateringEvent({
      customerId: 'cust-1', eventStartDate: '2026-10-01', attendeeCount: 50, pricePerPlate: 400,
      staff: [{ role: 'MANAGER' as never, workerCount: 2, ratePerWorker: 500 }],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CAT-004')
  })

  it('creates an event with a sequence-numbered eventNumber and snapshots per-role staffing cost (workerCount × ratePerWorker)', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createCateringEvent({
      customerId: 'cust-1', eventStartDate: '2026-10-01', attendeeCount: 100, pricePerPlate: 500, advanceAmount: 5000,
      menuItems: [{ productId: 'prod-1', quantity: 100, unitPrice: 50 }],
      days: [{ serviceDate: '2026-10-01', mealsCount: 2, snacksCount: 1 }],
      staff: [
        { role: 'COOK', workerCount: 2, ratePerWorker: 1500 },
        { role: 'SERVER', workerCount: 5, ratePerWorker: 800 },
        { role: 'CLEANER', workerCount: 1, ratePerWorker: 600 },
      ],
    })

    expect(res.success).toBe(true)
    const data = (res as { data: { eventNumber: string } }).data
    expect(data.eventNumber).toBe('CAT-00001')

    const createCall = db.cateringEvent.create.mock.calls[0][0]
    expect(createCall.data.staff.create).toEqual([
      { role: 'COOK', workerCount: 2, ratePerWorker: 1500, serviceDate: null, amount: 3000 },
      { role: 'SERVER', workerCount: 5, ratePerWorker: 800, serviceDate: null, amount: 4000 },
      { role: 'CLEANER', workerCount: 1, ratePerWorker: 600, serviceDate: null, amount: 600 },
    ])
  })
})

describe('catering-event.service.recordFinalNegotiatedPrice', () => {
  it('rejects a negative price', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await recordFinalNegotiatedPrice('cat-1', -500)

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CAT-013')
  })

  it('rejects changing the price once the event has already been invoiced', async () => {
    const db = makeMockDb()
    db.cateringEvent.findUnique.mockResolvedValue({ id: 'cat-1', invoiceId: 'inv-1', advanceAmount: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await recordFinalNegotiatedPrice('cat-1', 40000)

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CAT-014')
  })

  it('rejects a final price below the advance already recorded', async () => {
    const db = makeMockDb()
    db.cateringEvent.findUnique.mockResolvedValue({ id: 'cat-1', invoiceId: null, advanceAmount: 5000 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await recordFinalNegotiatedPrice('cat-1', 3000)

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CAT-015')
  })

  it('records the negotiated price when valid', async () => {
    const db = makeMockDb()
    db.cateringEvent.findUnique.mockResolvedValue({ id: 'cat-1', invoiceId: null, advanceAmount: 5000 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await recordFinalNegotiatedPrice('cat-1', 45000, 'user-1')

    expect(res.success).toBe(true)
    expect(db.cateringEvent.update).toHaveBeenCalledWith({ where: { id: 'cat-1' }, data: { finalNegotiatedPrice: 45000 } })
  })
})

describe('catering-event.service.generateCateringEventInvoice', () => {
  it('rejects generating a second invoice for the same event (claim-sentinel already consumed)', async () => {
    const db = makeMockDb()
    db.cateringEvent.updateMany.mockResolvedValue({ count: 0 })
    db.cateringEvent.findUnique.mockResolvedValue({ id: 'cat-1', invoiceId: 'inv-real-1' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateCateringEventInvoice('cat-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CAT-022')
  })

  it('bills at the final negotiated price (not the original quote) as one Catering Service line, and records the capped advance', async () => {
    const db = makeMockDb()
    db.cateringEvent.findUnique.mockResolvedValue({
      id: 'cat-1', eventNumber: 'CAT-00001', customerId: 'cust-1',
      pricePerPlate: 500, attendeeCount: 100, finalNegotiatedPrice: 42000,
      advanceAmount: 5000, advancePaymentMethod: 'CASH',
    })
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1', totalAmount: 42000 } } as never)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateCateringEventInvoice('cat-1', 'user-1')

    expect(res.success).toBe(true)
    expect(billingService.getOrCreateServiceProduct).toHaveBeenCalledWith({ name: 'Catering Service' })
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'cust-1',
      items: [{ productId: 'svc-catering-1', quantity: 1, unitPrice: 42000 }],
    }))
    expect(paymentService.recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceId: 'inv-1', amount: 5000 }), 'user-1'
    )
    expect(db.cateringEvent.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'cat-1' }, data: { invoiceId: 'inv-1', status: 'COMPLETED' },
    }))
  })

  it('falls back to pricePerPlate × attendeeCount when no final negotiated price was ever recorded', async () => {
    const db = makeMockDb()
    db.cateringEvent.findUnique.mockResolvedValue({
      id: 'cat-1', eventNumber: 'CAT-00001', customerId: 'cust-1',
      pricePerPlate: 500, attendeeCount: 100, finalNegotiatedPrice: null,
      advanceAmount: 0, advancePaymentMethod: 'CASH',
    })
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-2', totalAmount: 50000 } } as never)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateCateringEventInvoice('cat-1')

    expect(res.success).toBe(true)
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      items: [{ productId: 'svc-catering-1', quantity: 1, unitPrice: 50000 }],
    }))
  })
})
