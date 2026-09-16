import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../customer-ledger.service', () => ({ customerLedgerService: { addEntry: vi.fn().mockResolvedValue(undefined) } }))

import { getPrisma } from '../../database/db'
import { creditInterestService } from '../credit-interest.service'
import { customerLedgerService } from '../customer-ledger.service'

const NOW = new Date(2026, 7, 11) // 2026-08-11, matches this session's "today"

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 86400000)
}

function makeDb(overrides: Record<string, unknown> = {}) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ creditInterestEnabled: true, creditInterestRatePercent: 12, creditInterestType: 'SIMPLE' }) },
    customer: { findUnique: vi.fn().mockResolvedValue({ id: 'cust-1', customerName: 'Ramesh Traders' }) },
    customerLedger: { findFirst: vi.fn().mockResolvedValue(null) },
    invoice: { findMany: vi.fn().mockResolvedValue([]) },
    chartOfAccounts: { findUnique: vi.fn().mockResolvedValue({ id: 'coa-1', accountCode: '1100', accountName: 'Accounts Receivable', accountType: 'ASSET', isActive: true }) },
    journalEntry: { create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-00001' }), findMany: vi.fn().mockResolvedValue([]) },
    setting: {
      findUnique: vi.fn(async () => settingRow),
      update: vi.fn(async ({ data }: { data: { settingValue: string } }) => { settingRow = settingRow ? { ...settingRow, settingValue: data.settingValue } : null; return settingRow }),
      create: vi.fn(async ({ data }: { data: { settingKey: string; settingValue: string } }) => { settingRow = { settingKey: data.settingKey, settingValue: data.settingValue }; return settingRow }),
      updateMany: vi.fn(async ({ data }: { data: { settingValue: string } }) => {
        if (!settingRow) return { count: 0 }
        settingRow = { ...settingRow, settingValue: data.settingValue }
        return { count: 1 }
      }),
    },
    ...overrides,
  }
  db.$transaction = vi.fn((arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(db)
  )
  return db
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

describe('creditInterestService.calculateInterest', () => {
  it('returns error when credit interest is not enabled', async () => {
    const db = makeDb({ businessProfile: { findFirst: vi.fn().mockResolvedValue({ creditInterestEnabled: false }) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditInterestService.calculateInterest('cust-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CI-001')
  })

  it('returns error for a non-existent customer', async () => {
    const db = makeDb({ customer: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditInterestService.calculateInterest('ghost')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CUS-001')
  })

  it('computes correct SIMPLE interest for one overdue invoice: 10000 * 12% * (60/365)', async () => {
    const db = makeDb({
      invoice: { findMany: vi.fn().mockResolvedValue([{ id: 'inv-1', invoiceNumber: 'INV-1', balanceAmount: 10000, dueDate: daysAgo(60) }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditInterestService.calculateInterest('cust-1')

    expect(res.success).toBe(true)
    const data = res.data as { totalInterest: number; lines: Array<{ daysOverdue: number }> }
    // 10000 * 0.12 * (60/365) = 197.26...
    expect(data.totalInterest).toBeCloseTo(197.26, 1)
    expect(data.lines[0].daysOverdue).toBe(60)
  })

  it('excludes an invoice that is not yet overdue', async () => {
    const db = makeDb({
      invoice: { findMany: vi.fn().mockResolvedValue([]) }, // dueDate: { lt: now } filter excludes it at the query level
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditInterestService.calculateInterest('cust-1')

    expect(res.success).toBe(true)
    expect((res.data as { totalInterest: number }).totalInterest).toBe(0)
  })

  it('computes COMPOUND interest via monthly compounding', async () => {
    const db = makeDb({
      businessProfile: { findFirst: vi.fn().mockResolvedValue({ creditInterestEnabled: true, creditInterestRatePercent: 12, creditInterestType: 'COMPOUND' }) },
      invoice: { findMany: vi.fn().mockResolvedValue([{ id: 'inv-1', invoiceNumber: 'INV-1', balanceAmount: 10000, dueDate: daysAgo(90) }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditInterestService.calculateInterest('cust-1')

    // 3 months elapsed, monthlyRate = 1%, 10000 * (1.01^3 - 1) = 303.01
    const data = res.data as { totalInterest: number }
    expect(data.totalInterest).toBeCloseTo(303.01, 1)
  })
})

describe('creditInterestService.postInterestCharge', () => {
  it('returns error when no interest is currently due', async () => {
    const db = makeDb({ invoice: { findMany: vi.fn().mockResolvedValue([]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditInterestService.postInterestCharge('cust-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CI-002')
  })

  it('posts a real balanced JournalEntry (Debit Accounts Receivable, Credit Interest Income) and a CustomerLedger debit', async () => {
    const db = makeDb({
      invoice: { findMany: vi.fn().mockResolvedValue([{ id: 'inv-1', invoiceNumber: 'INV-1', balanceAmount: 10000, dueDate: daysAgo(60) }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditInterestService.postInterestCharge('cust-1')

    expect(res.success).toBe(true)
    expect(customerLedgerService.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({ referenceType: 'INTEREST_CHARGE', creditAmount: 0 }),
      expect.anything()
    )
    expect(db.journalEntry.create).toHaveBeenCalledTimes(1)
    const jeArgs = db.journalEntry.create.mock.calls[0][0]
    expect(jeArgs.data.sourceType).toBe('INTEREST_CHARGE')
    const lines = jeArgs.data.lines.create as Array<{ debitAmount: number; creditAmount: number }>
    const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0)
    const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0)
    expect(totalDebit).toBe(totalCredit)
    expect(totalDebit).toBeGreaterThan(0)
  })

  it('refuses a same-day double-post instead of charging interest twice (double-click guard)', async () => {
    const db = makeDb({
      invoice: { findMany: vi.fn().mockResolvedValue([{ id: 'inv-1', invoiceNumber: 'INV-1', balanceAmount: 10000, dueDate: daysAgo(60) }]) },
      customerLedger: { findFirst: vi.fn().mockResolvedValue({ id: 'led-already-posted' }) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditInterestService.postInterestCharge('cust-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CI-003')
    expect(customerLedgerService.addEntry).not.toHaveBeenCalled()
    expect(db.journalEntry.create).not.toHaveBeenCalled()
  })
})

// Real bug found+fixed 2026-09-16: postInterestCharge had no matching
// reversal path at all — every other charge type in this codebase has a
// matching void/reverse function; this one didn't. A generic manual GL
// reversal would have fixed the books but left CustomerLedger permanently
// showing the customer owing interest the real books no longer reflect.
describe('creditInterestService.reverseInterestCharge', () => {
  function makeOriginalLedgerRow(overrides: Record<string, unknown> = {}) {
    return { id: 'led-1', customerId: 'cust-1', referenceType: 'INTEREST_CHARGE', referenceId: 'charge-1', debitAmount: 500, creditAmount: 0, ...overrides }
  }

  function makeReversalDb(overrides: Record<string, unknown> = {}) {
    return makeDb({
      customerLedger: {
        findFirst: vi.fn(async ({ where }: { where: { referenceType: string } }) => {
          if (where.referenceType === 'INTEREST_REVERSAL') return null // not yet reversed, the common case
          if (where.referenceType === 'INTEREST_CHARGE') return makeOriginalLedgerRow()
          return null
        })
      },
      journalEntry: {
        create: vi.fn().mockResolvedValue({ id: 'je-2', entryNumber: 'JE-00002' }),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue({
          id: 'je-1', entryNumber: 'JE-00001', sourceType: 'INTEREST_CHARGE', sourceId: 'charge-1', isReversed: false,
          lines: [
            { accountId: 'coa-ar', bankAccountId: null, costCentreId: null, debitAmount: 500, creditAmount: 0 },
            { accountId: 'coa-interest', bankAccountId: null, costCentreId: null, debitAmount: 0, creditAmount: 500 }
          ]
        }),
        update: vi.fn().mockResolvedValue({})
      },
      ...overrides
    })
  }

  it('credits back the CustomerLedger and reverses the linked JournalEntry', async () => {
    const db = makeReversalDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditInterestService.reverseInterestCharge('charge-1', 'Entered in error')

    expect(res.success).toBe(true)
    expect(customerLedgerService.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({ referenceType: 'INTEREST_REVERSAL', referenceId: 'charge-1', debitAmount: 0, creditAmount: 500 }),
      expect.anything()
    )
    // reverseEntryBySourceTx marks the ORIGINAL entry reversed and creates a new offsetting one.
    expect(db.journalEntry.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'je-1' },
      data: expect.objectContaining({ isReversed: true })
    }))
    expect(db.journalEntry.create).toHaveBeenCalledTimes(1)
  })

  it('refuses to reverse a charge that was already reversed', async () => {
    const db = makeReversalDb({
      customerLedger: {
        findFirst: vi.fn(async ({ where }: { where: { referenceType: string } }) => {
          if (where.referenceType === 'INTEREST_REVERSAL') return { id: 'led-2' } // already reversed
          return makeOriginalLedgerRow()
        })
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditInterestService.reverseInterestCharge('charge-1', 'Duplicate reversal attempt')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CI-004')
    expect(customerLedgerService.addEntry).not.toHaveBeenCalled()
  })

  it('returns an error for a charge id that was never posted', async () => {
    const db = makeReversalDb({
      customerLedger: { findFirst: vi.fn().mockResolvedValue(null) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await creditInterestService.reverseInterestCharge('ghost-charge', 'Entered in error')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CI-005')
  })
})
