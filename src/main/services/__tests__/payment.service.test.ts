import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../customer-ledger.service', () => ({ customerLedgerService: { addEntry: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { paymentService } from '../payment.service'
import { parseLocalDateStart } from '../../utils/date.util'

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
    // Phase 58 §2 — recordPayment/recordSplitPayment release any restaurant
    // table(s) still pointing at the invoice once it reaches PAID.
    restaurantTable: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
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

  it('releases any restaurant table(s) once the balance reaches zero (PAID)', async () => {
    const db = makeMockDb({ balanceAmount: 100 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await paymentService.recordPayment({ invoiceId: 'inv-1', amount: 100, paymentMethod: 'CASH' })

    expect(res.success).toBe(true)
    expect(db.restaurantTable.updateMany).toHaveBeenCalledWith({
      where: { currentInvoiceId: 'inv-1' },
      data: { currentInvoiceId: null, status: 'AVAILABLE' }
    })
  })

  it('does NOT release a table on a partial payment (balance still owed)', async () => {
    const db = makeMockDb({ balanceAmount: 1000 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await paymentService.recordPayment({ invoiceId: 'inv-1', amount: 400, paymentMethod: 'CASH' })

    expect(res.success).toBe(true)
    expect(db.restaurantTable.updateMany).not.toHaveBeenCalled()
  })

  // Real bug found live (core-commerce audit): paidAmount/balanceAmount were
  // updated with plain `+`/`-` on floats — running-balance ledger arithmetic
  // on an invoice that can receive several partial payments over time, each
  // one compounding whatever float error the previous payment already left.
  it('rounds paidAmount to 2 decimals, closing a float-precision drift across partial payments', async () => {
    // 0.1 + 0.2 = 0.30000000000000004 in raw IEEE754 float math, not 0.3.
    expect(0.1 + 0.2).not.toBe(0.3)

    const db = makeMockDb({ paidAmount: 0.1, balanceAmount: 1000 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await paymentService.recordPayment({ invoiceId: 'inv-1', amount: 0.2, paymentMethod: 'CASH' })

    expect(res.success).toBe(true)
    const updateCall = db.invoice.update.mock.calls[0][0]
    expect(updateCall.data.paidAmount).toBe(0.3)
  })

  // Real bug found live (core-commerce audit): `new Date(payload.paymentDate)`
  // parsed a bare "YYYY-MM-DD" string as UTC midnight, not local midnight —
  // the same class of bug already fixed across ~15 other files in this app.
  // Not reachable from the shipped UI today (no screen sets paymentDate),
  // but the IPC payload schema accepts any string.
  it('parses a date-only paymentDate as LOCAL midnight, not UTC midnight', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await paymentService.recordPayment({ invoiceId: 'inv-1', amount: 100, paymentMethod: 'CASH', paymentDate: '2026-07-15' })

    const createCall = db.payment.create.mock.calls[0][0]
    expect(createCall.data.paymentDate).toEqual(parseLocalDateStart('2026-07-15'))
  })

  it('parses a full ISO timestamp paymentDate as-is (not reinterpreted as date-only)', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await paymentService.recordPayment({ invoiceId: 'inv-1', amount: 100, paymentMethod: 'CASH', paymentDate: '2026-07-15T10:30:00.000Z' })

    const createCall = db.payment.create.mock.calls[0][0]
    expect(createCall.data.paymentDate).toEqual(new Date('2026-07-15T10:30:00.000Z'))
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

  it('a split payment always settles the invoice in full, so it always releases the table', async () => {
    const db = makeMockDb({ balanceAmount: 1000 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await paymentService.recordSplitPayment({
      invoiceId: 'inv-1',
      legs: [{ paymentMethod: 'CASH', amount: 600 }, { paymentMethod: 'UPI', amount: 400 }],
    })

    expect(res.success).toBe(true)
    expect(db.restaurantTable.updateMany).toHaveBeenCalledWith({
      where: { currentInvoiceId: 'inv-1' },
      data: { currentInvoiceId: null, status: 'AVAILABLE' }
    })
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

  it('rounds the restored paidAmount/balanceAmount to 2 decimals on reversal', async () => {
    const db = makeMockDb()
    db.payment.findUnique = vi.fn().mockResolvedValue(makePayment({
      amount: 0.2,
      invoice: baseInvoice({ paidAmount: 0.3, balanceAmount: 999.7 })
    }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await paymentService.reversePayment({ paymentId: 'pmt-1', reason: 'Mistake' })

    expect(res.success).toBe(true)
    const updateCall = db.invoice.update.mock.calls[0][0]
    // 0.3 - 0.2 = 0.09999999999999998 in raw IEEE754 float math, not 0.1.
    expect(updateCall.data.paidAmount).toBe(0.1)
    expect(updateCall.data.balanceAmount).toBe(999.9)
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
    // Regression for a real bug found 2026-07-22: gte used to be
    // new Date('2026-01-01') (UTC midnight) — now local midnight
    // (parseLocalDateStart), matching the Y/M/D local constructor.
    expect(call.where.paymentDate.gte).toEqual(new Date(2026, 0, 1))
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
