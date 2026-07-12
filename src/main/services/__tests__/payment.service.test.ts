import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../customer-ledger.service', () => ({ customerLedgerService: { addEntry: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { paymentService } from '../payment.service'

function baseInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-1', invoiceNumber: 'INV-2024-000001',
    status: 'ACTIVE', paymentStatus: 'UNPAID',
    paidAmount: 0, balanceAmount: 1000,
    customerId: null,
    ...overrides,
  }
}

function makeMockDb(invoiceOverrides: Record<string, unknown> = {}) {
  // tx === db: recordPayment/recordSplitPayment/reversePayment now look up the
  // invoice/payment INSIDE the transaction (fixing a read-before-tx race), so
  // the callback must see the same mocked invoice/payment the tests assert against.
  const db: Record<string, any> = {
    invoice: {
      findUnique: vi.fn().mockResolvedValue(baseInvoice(invoiceOverrides)),
      update: vi.fn().mockResolvedValue({}),
    },
    payment: {
      create: vi.fn().mockResolvedValue({ id: 'pmt-1', amount: 1000 }),
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
  }
  // getPayments uses the array form db.$transaction([...]) instead of the
  // callback form — support both.
  db.$transaction = vi.fn((arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(db)
  )
  return db
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('paymentService.recordPayment', () => {
  it('returns error for non-existent invoice', async () => {
    const db = makeMockDb()
    db.invoice.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await paymentService.recordPayment({ invoiceId: 'bad', amount: 100, paymentMethod: 'CASH' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('INVOC-005')
  })

  it('rejects payment on cancelled invoice', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb({ status: 'CANCELLED' }) as never)

    const res = await paymentService.recordPayment({ invoiceId: 'inv-1', amount: 100, paymentMethod: 'CASH' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PM-001')
  })

  it('rejects payment when invoice already fully paid', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb({ balanceAmount: 0 }) as never)

    const res = await paymentService.recordPayment({ invoiceId: 'inv-1', amount: 100, paymentMethod: 'CASH' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PM-002')
  })

  it('rejects payment exceeding outstanding balance', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb({ balanceAmount: 200 }) as never)

    const res = await paymentService.recordPayment({ invoiceId: 'inv-1', amount: 500, paymentMethod: 'CASH' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PM-003')
  })

  it('reads the invoice inside the transaction (no double-payment race)', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await paymentService.recordPayment({ invoiceId: 'inv-1', amount: 100, paymentMethod: 'CASH' })

    const txCallOrder = vi.mocked(db.$transaction).mock.invocationCallOrder[0]
    const findCallOrder = vi.mocked(db.invoice.findUnique).mock.invocationCallOrder[0]
    expect(txCallOrder).toBeLessThan(findCallOrder)
  })
})

describe('paymentService.recordSplitPayment', () => {
  it('rejects split on cancelled invoice', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb({ status: 'CANCELLED' }) as never)

    const res = await paymentService.recordSplitPayment({
      invoiceId: 'inv-1',
      legs: [{ paymentMethod: 'CASH', amount: 500 }, { paymentMethod: 'UPI', amount: 500 }],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PM-001')
  })

  it('rejects when split total does not match balance', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb({ balanceAmount: 1000 }) as never)

    const res = await paymentService.recordSplitPayment({
      invoiceId: 'inv-1',
      legs: [{ paymentMethod: 'CASH', amount: 400 }, { paymentMethod: 'UPI', amount: 400 }],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PM-007')
  })

  it('rejects split on already-paid invoice', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb({ balanceAmount: 0 }) as never)

    const res = await paymentService.recordSplitPayment({
      invoiceId: 'inv-1',
      legs: [{ paymentMethod: 'CASH', amount: 0 }],
    })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PM-002')
  })

  it('accepts split when totals match balance (within tolerance)', async () => {
    const db = makeMockDb({ balanceAmount: 1000 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await paymentService.recordSplitPayment({
      invoiceId: 'inv-1',
      legs: [{ paymentMethod: 'CASH', amount: 600 }, { paymentMethod: 'UPI', amount: 400 }],
    })

    expect(res.success).toBe(true)
  })
})

describe('paymentService.reversePayment', () => {
  function makePayment(overrides: Record<string, unknown> = {}) {
    return {
      id: 'pmt-1', invoiceId: 'inv-1', amount: 200, isReversed: false, customerId: null,
      invoice: baseInvoice({ paidAmount: 200, balanceAmount: 800 }),
      ...overrides
    }
  }

  it('returns PM-004 for a non-existent payment', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await paymentService.reversePayment({ paymentId: 'ghost', reason: 'Mistake' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PM-004')
  })

  it('returns PM-005 when already reversed', async () => {
    const db = makeMockDb()
    db.payment.findUnique = vi.fn().mockResolvedValue(makePayment({ isReversed: true }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await paymentService.reversePayment({ paymentId: 'pmt-1', reason: 'Mistake' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PM-005')
  })

  it('returns PM-006 when the invoice is cancelled', async () => {
    const db = makeMockDb()
    db.payment.findUnique = vi.fn().mockResolvedValue(makePayment({ invoice: baseInvoice({ status: 'CANCELLED' }) }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await paymentService.reversePayment({ paymentId: 'pmt-1', reason: 'Mistake' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PM-006')
  })

  it('reads the payment inside the transaction (no double-reversal race)', async () => {
    const db = makeMockDb()
    db.payment.findUnique = vi.fn().mockResolvedValue(makePayment())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await paymentService.reversePayment({ paymentId: 'pmt-1', reason: 'Mistake' })

    expect(res.success).toBe(true)
    const txCallOrder = vi.mocked(db.$transaction).mock.invocationCallOrder[0]
    const findCallOrder = vi.mocked(db.payment.findUnique).mock.invocationCallOrder[0]
    expect(txCallOrder).toBeLessThan(findCallOrder)
  })
})

describe('paymentService.getPayments', () => {
  it('filters by payment method', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await paymentService.getPayments({ method: 'UPI' })

    expect(db.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ paymentMethod: 'UPI' }) })
    )
  })

  it('filters by date range', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await paymentService.getPayments({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })

    const call = vi.mocked(db.payment.findMany).mock.calls[0][0] as { where: { paymentDate: { gte: Date; lte: Date } } }
    expect(call.where.paymentDate.gte).toEqual(new Date('2026-01-01'))
    expect(call.where.paymentDate.lte).toEqual(new Date('2026-01-31T23:59:59.999'))
  })

  it('searches invoice number, customer name, and reference number', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await paymentService.getPayments({ search: 'INV-2024' })

    const call = vi.mocked(db.payment.findMany).mock.calls[0][0] as { where: { OR: unknown[] } }
    expect(call.where.OR).toEqual([
      { referenceNumber: { contains: 'INV-2024' } },
      { invoice: { invoiceNumber: { contains: 'INV-2024' } } },
      { customer: { customerName: { contains: 'INV-2024' } } }
    ])
  })

  it('applies no filters by default', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await paymentService.getPayments()

    expect(db.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }))
  })

  it('orders by paymentDate, not record-entry createdAt', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await paymentService.getPayments()

    expect(db.payment.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { paymentDate: 'desc' } }))
  })
})
