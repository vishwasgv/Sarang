import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { bankStatementService } from '../bank-statement.service'

function makeDb(overrides: Record<string, unknown> = {}) {
  const db: Record<string, any> = {
    bankAccount: {
      findUnique: vi.fn().mockResolvedValue({ id: 'bank-1', accountName: 'HDFC Current', currentBalance: 5000 }),
    },
    bankStatementLine: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    payment: { findMany: vi.fn().mockResolvedValue([]) },
    expense: { findMany: vi.fn().mockResolvedValue([]) },
    supplierPayment: { findMany: vi.fn().mockResolvedValue([]) },
    journalEntryLine: { findMany: vi.fn().mockResolvedValue([]) },
    ...overrides,
  }
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('bankStatementService.importLines', () => {
  it('returns error for a non-existent bank account', async () => {
    const db = makeDb()
    db.bankAccount.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await bankStatementService.importLines({ bankAccountId: 'ghost', lines: [{ transactionDate: '2026-08-01', description: 'Deposit', debitAmount: 0, creditAmount: 500 }] })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BANK-001')
  })

  it('imports all lines under one shared importBatchId', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await bankStatementService.importLines({
      bankAccountId: 'bank-1',
      lines: [
        { transactionDate: '2026-08-01', description: 'Deposit', debitAmount: 0, creditAmount: 500 },
        { transactionDate: '2026-08-02', description: 'Bank charges', debitAmount: 20, creditAmount: 0 },
      ]
    })

    expect(res.success).toBe(true)
    const createArgs = db.bankStatementLine.createMany.mock.calls[0][0]
    expect(createArgs.data).toHaveLength(2)
    expect(createArgs.data[0].importBatchId).toBe(createArgs.data[1].importBatchId)
  })
})

describe('bankStatementService.autoMatch', () => {
  it('reconciles a credit line to exactly one matching Payment', async () => {
    const db = makeDb({
      bankStatementLine: {
        findMany: vi.fn().mockResolvedValue([{ id: 'line-1', creditAmount: 500, debitAmount: 0, transactionDate: new Date(2026, 7, 1) }]),
        update: vi.fn().mockResolvedValue({}),
      },
      payment: { findMany: vi.fn().mockResolvedValue([{ id: 'pmt-1', amount: 500, paymentDate: new Date(2026, 7, 2), isReversed: false }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await bankStatementService.autoMatch('bank-1')

    expect(res.success).toBe(true)
    expect((res.data as { matchedCount: number }).matchedCount).toBe(1)
    expect(db.bankStatementLine.update).toHaveBeenCalledWith({
      where: { id: 'line-1' },
      data: expect.objectContaining({ reconciled: true, matchedType: 'PAYMENT', matchedId: 'pmt-1' })
    })
  })

  it('leaves a line unreconciled when two candidates match equally (ambiguous, never guessed)', async () => {
    const db = makeDb({
      bankStatementLine: {
        findMany: vi.fn().mockResolvedValue([{ id: 'line-1', creditAmount: 500, debitAmount: 0, transactionDate: new Date(2026, 7, 1) }]),
        update: vi.fn().mockResolvedValue({}),
      },
      payment: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'pmt-1', amount: 500, paymentDate: new Date(2026, 7, 1), isReversed: false },
          { id: 'pmt-2', amount: 500, paymentDate: new Date(2026, 7, 2), isReversed: false },
        ])
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await bankStatementService.autoMatch('bank-1')

    expect(res.success).toBe(true)
    expect((res.data as { matchedCount: number }).matchedCount).toBe(0)
    expect(db.bankStatementLine.update).not.toHaveBeenCalled()
  })

  it('leaves a line unreconciled when the only candidate is outside the date proximity window', async () => {
    const db = makeDb({
      bankStatementLine: {
        findMany: vi.fn().mockResolvedValue([{ id: 'line-1', creditAmount: 500, debitAmount: 0, transactionDate: new Date(2026, 7, 1) }]),
        update: vi.fn().mockResolvedValue({}),
      },
      payment: { findMany: vi.fn().mockResolvedValue([{ id: 'pmt-1', amount: 500, paymentDate: new Date(2026, 6, 1), isReversed: false }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await bankStatementService.autoMatch('bank-1')

    expect((res.data as { matchedCount: number }).matchedCount).toBe(0)
  })

  it('reconciles a debit line to exactly one matching Expense', async () => {
    const db = makeDb({
      bankStatementLine: {
        findMany: vi.fn().mockResolvedValue([{ id: 'line-2', creditAmount: 0, debitAmount: 20, transactionDate: new Date(2026, 7, 1) }]),
        update: vi.fn().mockResolvedValue({}),
      },
      expense: { findMany: vi.fn().mockResolvedValue([{ id: 'exp-1', amount: 20, expenseDate: new Date(2026, 7, 1) }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await bankStatementService.autoMatch('bank-1')

    expect((res.data as { matchedCount: number }).matchedCount).toBe(1)
    expect(db.bankStatementLine.update).toHaveBeenCalledWith({
      where: { id: 'line-2' },
      data: expect.objectContaining({ matchedType: 'EXPENSE', matchedId: 'exp-1' })
    })
  })
})

describe('bankStatementService.reconcileLine / unreconcileLine', () => {
  it('reconcileLine returns error for a non-existent line', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await bankStatementService.reconcileLine({ lineId: 'ghost', matchedType: 'PAYMENT', matchedId: 'pmt-1' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BANK-002')
  })

  it('reconcileLine marks a line reconciled with the given match', async () => {
    const db = makeDb({ bankStatementLine: { findUnique: vi.fn().mockResolvedValue({ id: 'line-1' }), update: vi.fn().mockResolvedValue({}) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await bankStatementService.reconcileLine({ lineId: 'line-1', matchedType: 'PAYMENT', matchedId: 'pmt-1' })

    expect(res.success).toBe(true)
    expect(db.bankStatementLine.update).toHaveBeenCalledWith({
      where: { id: 'line-1' },
      data: expect.objectContaining({ reconciled: true, matchedType: 'PAYMENT', matchedId: 'pmt-1' })
    })
  })

  it('unreconcileLine clears the match', async () => {
    const db = makeDb({ bankStatementLine: { findUnique: vi.fn().mockResolvedValue({ id: 'line-1' }), update: vi.fn().mockResolvedValue({}) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await bankStatementService.unreconcileLine('line-1')

    expect(res.success).toBe(true)
    expect(db.bankStatementLine.update).toHaveBeenCalledWith({
      where: { id: 'line-1' },
      data: expect.objectContaining({ reconciled: false, matchedType: null, matchedId: null })
    })
  })
})

describe('bankStatementService.getReconciliationSummary', () => {
  it('returns error for a non-existent bank account', async () => {
    const db = makeDb()
    db.bankAccount.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await bankStatementService.getReconciliationSummary('ghost')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BANK-001')
  })

  it('computes totals and reconciled/unreconciled counts correctly', async () => {
    const db = makeDb({
      bankStatementLine: {
        findMany: vi.fn().mockResolvedValue([
          { debitAmount: 0, creditAmount: 500, reconciled: true },
          { debitAmount: 20, creditAmount: 0, reconciled: false },
          { debitAmount: 100, creditAmount: 0, reconciled: true },
        ])
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await bankStatementService.getReconciliationSummary('bank-1')

    expect(res.success).toBe(true)
    const data = res.data as { totalDebits: number; totalCredits: number; reconciledCount: number; unreconciledCount: number; statementNetMovement: number }
    expect(data.totalDebits).toBe(120)
    expect(data.totalCredits).toBe(500)
    expect(data.statementNetMovement).toBe(380)
    expect(data.reconciledCount).toBe(2)
    expect(data.unreconciledCount).toBe(1)
  })
})
