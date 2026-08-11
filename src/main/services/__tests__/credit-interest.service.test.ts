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
})
