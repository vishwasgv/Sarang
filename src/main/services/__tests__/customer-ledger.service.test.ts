import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { customerLedgerService } from '../customer-ledger.service'

function makeDb(overrides: Record<string, unknown> = {}) {
  const txClient = {
    customerLedger: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { debitAmount: 500, creditAmount: 200 } }),
      create: vi.fn().mockResolvedValue({ id: 'entry-1', balance: 300 }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0)
    },
    customer: {
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue({ outstandingBalance: 300 })
    }
  }

  return {
    customerLedger: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { debitAmount: 500, creditAmount: 200 } }),
      create: vi.fn().mockResolvedValue({ id: 'entry-1', balance: 300 }),
      findMany: vi.fn().mockResolvedValue([{ id: 'entry-1', createdAt: new Date() }]),
      count: vi.fn().mockResolvedValue(5)
    },
    customer: {
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue({ outstandingBalance: 300 })
    },
    $transaction: vi.fn(async (cb: ((tx: unknown) => unknown) | unknown[]) => {
      if (Array.isArray(cb)) {
        return [
          [{ id: 'entry-1', createdAt: new Date() }],
          5
        ]
      }
      return (cb as (tx: unknown) => unknown)(txClient)
    }),
    ...overrides
  }
}

beforeEach(() => vi.clearAllMocks())

describe('customerLedgerService.calculateBalance', () => {
  it('computes net outstanding as debit minus credit', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const balance = await customerLedgerService.calculateBalance('cust-1')

    expect(balance).toBe(300) // 500 - 200
  })

  it('returns zero when customer has no ledger entries', async () => {
    const db = makeDb()
    db.customerLedger.aggregate = vi.fn().mockResolvedValue({ _sum: { debitAmount: null, creditAmount: null } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const balance = await customerLedgerService.calculateBalance('new-cust')

    expect(balance).toBe(0)
  })

  it('handles partial ledger (only debits)', async () => {
    const db = makeDb()
    db.customerLedger.aggregate = vi.fn().mockResolvedValue({ _sum: { debitAmount: 1000, creditAmount: null } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const balance = await customerLedgerService.calculateBalance('cust-2')

    expect(balance).toBe(1000)
  })

  // Real bug found live (core-commerce audit): unlike supplier-ledger.service.ts's
  // own calculateBalance (already routed through roundCurrency), this one
  // returned the raw SUM(debit)-SUM(credit) float unrounded — a real boundary
  // bug because addEntry() persists this value verbatim as the denormalised
  // Customer.outstandingBalance field that billing.service.ts's credit-limit
  // enforcement compares directly against Customer.creditLimit.
  it('rounds the computed balance to 2 decimals, closing a float-precision drift', async () => {
    // Classic IEEE754 artifact: 0.3 - 0.2 === 0.09999999999999998 in raw JS
    // float math, not 0.1 — proof this actually exercises the rounding fix,
    // not just an already-clean value.
    expect(0.3 - 0.2).not.toBe(0.1)

    const db = makeDb()
    db.customerLedger.aggregate = vi.fn().mockResolvedValue({ _sum: { debitAmount: 0.3, creditAmount: 0.2 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const balance = await customerLedgerService.calculateBalance('cust-3')

    expect(balance).toBe(0.1)
  })
})

describe('customerLedgerService.addEntry', () => {
  it('rounds the new balance it persists (both CustomerLedger.balance and Customer.outstandingBalance)', async () => {
    const db = makeDb()
    // Base 0.1 (already the rounded result of a prior 0.3 - 0.2 aggregate)
    // plus a further 0.2 debit — 0.1 + 0.2 is the other canonical IEEE754
    // artifact (0.30000000000000004 in raw float math).
    db.customerLedger.aggregate = vi.fn().mockResolvedValue({ _sum: { debitAmount: 0.3, creditAmount: 0.2 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await customerLedgerService.addEntry({
      customerId: 'cust-1',
      referenceType: 'INVOICE',
      referenceId: 'inv-2',
      debitAmount: 0.2,
      creditAmount: 0,
    })

    expect(db.customerLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ balance: 0.3 }) })
    )
    expect(db.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ outstandingBalance: 0.3 }) })
    )
  })

  it('creates a ledger entry with correct running balance', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    await customerLedgerService.addEntry({
      customerId: 'cust-1',
      referenceType: 'INVOICE',
      referenceId: 'inv-1',
      debitAmount: 500,
      creditAmount: 0,
      remarks: 'Invoice sale'
    })

    const db = vi.mocked(getPrisma)()
    expect(db.customerLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          customerId: 'cust-1',
          debitAmount: 500,
          creditAmount: 0,
          balance: 800  // prior balance 300 + 500 debit
        })
      })
    )
  })

  it('updates customer.outstandingBalance after entry', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    await customerLedgerService.addEntry({
      customerId: 'cust-1',
      referenceType: 'PAYMENT',
      debitAmount: 0,
      creditAmount: 200,
    })

    const db = vi.mocked(getPrisma)()
    expect(db.customer.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cust-1' },
        data: expect.objectContaining({ outstandingBalance: 100 })  // 300 - 200
      })
    )
  })

  it('works inside a transaction when tx is provided', async () => {
    const mockTx = {
      customerLedger: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { debitAmount: 100, creditAmount: 0 } }),
        create: vi.fn().mockResolvedValue({ id: 'tx-entry' })
      },
      customer: { update: vi.fn() }
    }
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    await customerLedgerService.addEntry({
      customerId: 'cust-1',
      referenceType: 'INVOICE',
      debitAmount: 200,
      creditAmount: 0
    }, mockTx as never)

    expect(mockTx.customerLedger.create).toHaveBeenCalled()
    expect(mockTx.customer.update).toHaveBeenCalled()
  })
})

describe('customerLedgerService.getLedger', () => {
  it('returns paginated ledger with outstanding balance', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const result = await customerLedgerService.getLedger('cust-1', { page: 1, limit: 20 })

    expect(result.success).toBe(true)
    const data = result.data as { ledger: unknown[]; outstanding: number; total: number; page: number }
    expect(data.outstanding).toBe(300)
    expect(data.total).toBe(5)
    expect(data.page).toBe(1)
  })

  it('defaults to page 1 and limit 50', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const result = await customerLedgerService.getLedger('cust-1')

    expect(result.success).toBe(true)
    const data = result.data as { page: number; limit: number }
    expect(data.page).toBe(1)
    expect(data.limit).toBe(50)
  })

  it('caps limit at 200', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const result = await customerLedgerService.getLedger('cust-1', { limit: 9999 })

    expect(result.success).toBe(true)
    const data = result.data as { limit: number }
    expect(data.limit).toBe(200)
  })

  it('uses denormalized outstandingBalance when available', async () => {
    const db = makeDb()
    db.customer.findUnique = vi.fn().mockResolvedValue({ outstandingBalance: 750 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await customerLedgerService.getLedger('cust-1')
    const data = result.data as { outstanding: number }

    expect(data.outstanding).toBe(750)
  })
})
