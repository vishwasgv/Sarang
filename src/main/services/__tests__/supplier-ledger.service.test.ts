import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { supplierLedgerService } from '../supplier-ledger.service'

function makeDb(overrides: Record<string, unknown> = {}) {
  const txClient = {
    supplierLedger: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { debitAmount: 500, creditAmount: 200 } }),
      create: vi.fn().mockResolvedValue({ id: 'entry-1', balance: 300 })
    }
  }

  const db: Record<string, any> = {
    supplierLedger: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { debitAmount: 500, creditAmount: 200 } }),
      create: vi.fn().mockResolvedValue({ id: 'entry-1', balance: 300 }),
      findMany: vi.fn().mockResolvedValue([])
    },
    supplier: {
      findUnique: vi.fn().mockResolvedValue({ id: 'sup-1', supplierName: 'ACME' })
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(txClient)),
    __txClient: txClient,
    ...overrides
  }
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('supplierLedgerService.calculateBalance', () => {
  it('computes net outstanding as debit minus credit', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const balance = await supplierLedgerService.calculateBalance('sup-1')

    expect(balance).toBe(300)
  })
})

describe('supplierLedgerService.addEntry', () => {
  it('works inside a transaction when tx is provided', async () => {
    const mockTx = {
      supplierLedger: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { debitAmount: 100, creditAmount: 0 } }),
        create: vi.fn().mockResolvedValue({ id: 'tx-entry' })
      }
    }
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    await supplierLedgerService.addEntry({
      supplierId: 'sup-1', referenceType: 'PURCHASE_ORDER', debitAmount: 200, creditAmount: 0
    }, mockTx as never)

    expect(mockTx.supplierLedger.aggregate).toHaveBeenCalled()
    expect(mockTx.supplierLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ balance: 300 }) }) // 100 + 200
    )
  })
})

describe('supplierLedgerService.recordPayment', () => {
  it('runs the balance read and ledger write inside one transaction, not two separate round-trips', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await supplierLedgerService.recordPayment({
      supplierId: 'sup-1', amount: 500, paymentMethod: 'CASH'
    })

    expect(result.success).toBe(true)
    expect(db.$transaction).toHaveBeenCalledTimes(1)
    // The aggregate (balance read) and create (ledger write) must both go
    // through the SAME tx client the $transaction callback receives — not
    // the bare db client — or this reverts to the two-non-transactional-
    // round-trips bug (concurrent payments can silently corrupt the stored
    // running balance).
    expect(db.__txClient.supplierLedger.aggregate).toHaveBeenCalled()
    expect(db.__txClient.supplierLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ creditAmount: 500, balance: -200 }) }) // prior (500-200=300) + 0 debit - 500 credit
    )
    expect(db.supplierLedger.create).not.toHaveBeenCalled() // never the untransacted path
  })

  it('rejects a zero or negative amount before opening a transaction', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await supplierLedgerService.recordPayment({ supplierId: 'sup-1', amount: 0, paymentMethod: 'CASH' })

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('SUP-011')
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('returns SUP-012 when the supplier does not exist', async () => {
    const db = makeDb()
    db.supplier.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await supplierLedgerService.recordPayment({ supplierId: 'ghost', amount: 100, paymentMethod: 'CASH' })

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('SUP-012')
  })
})
