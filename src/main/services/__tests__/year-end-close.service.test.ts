import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { yearEndCloseService } from '../year-end-close.service'

// A minimal, real accounting scenario: Cash (ASSET) has 80,000 debit-heavy;
// Capital (EQUITY) has 50,000 credit-heavy (balance -50000) from an opening
// balance; Sales Revenue (INCOME) credited 100,000 (balance -100000);
// Operating Expenses (EXPENSE) debited 70,000 (balance +70000).
// Net income = -(-100000 + 70000) = 30000 (a 30,000 profit).
// Balance-sheet total before adjustment: 80000 (cash) + (-50000) (capital) = 30000
// (matches netIncome exactly, confirming the accounting identity holds).
const ACCOUNTS = [
  { id: 'coa-cash', accountCode: '1000', accountName: 'Cash & Bank', accountType: 'ASSET', isActive: true },
  { id: 'coa-capital', accountCode: '3000', accountName: "Owner's Capital", accountType: 'EQUITY', isActive: true },
  { id: 'coa-sales', accountCode: '4000', accountName: 'Sales Revenue', accountType: 'INCOME', isActive: true },
  { id: 'coa-opex', accountCode: '6000', accountName: 'Operating Expenses', accountType: 'EXPENSE', isActive: true },
]

const BALANCES: Record<string, { debitAmount: number; creditAmount: number }> = {
  'coa-cash': { debitAmount: 80000, creditAmount: 0 },
  'coa-capital': { debitAmount: 0, creditAmount: 50000 },
  'coa-sales': { debitAmount: 0, creditAmount: 100000 },
  'coa-opex': { debitAmount: 70000, creditAmount: 0 },
}

function makeDb(overrides: Record<string, unknown> = {}) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    businessProfile: {
      findFirst: vi.fn().mockResolvedValue({ id: 'bp-1', lockDate: null }),
      update: vi.fn().mockResolvedValue({}),
    },
    chartOfAccounts: {
      count: vi.fn().mockResolvedValue(13),
      createMany: vi.fn().mockResolvedValue({ count: 13 }),
      findMany: vi.fn().mockResolvedValue(ACCOUNTS),
      findUnique: vi.fn().mockResolvedValue(ACCOUNTS[1]),
    },
    journalEntryLine: {
      aggregate: vi.fn(({ where }: { where: { accountId: string } }) => Promise.resolve({ _sum: BALANCES[where.accountId] ?? { debitAmount: 0, creditAmount: 0 } })),
    },
    journalEntry: {
      create: vi.fn().mockResolvedValue({ id: 'je-1', entryNumber: 'JE-00001' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
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

beforeEach(() => vi.clearAllMocks())

describe('yearEndCloseService.closeFinancialYear', () => {
  it('rejects closing a date already covered by an existing lock', async () => {
    const db = makeDb({ businessProfile: { findFirst: vi.fn().mockResolvedValue({ id: 'bp-1', lockDate: new Date(2026, 6, 31) }), update: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await yearEndCloseService.closeFinancialYear({ closingDate: '2026-06-30' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('YE-002')
  })

  it('rejects when there is nothing to carry forward (a fresh business with zero activity)', async () => {
    const db = makeDb({
      journalEntryLine: { aggregate: vi.fn().mockResolvedValue({ _sum: { debitAmount: 0, creditAmount: 0 } }) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await yearEndCloseService.closeFinancialYear({ closingDate: '2026-03-31' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('YE-001')
  })

  it('computes net income correctly, folds it into Capital, and posts a balanced opening JournalEntry', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await yearEndCloseService.closeFinancialYear({ closingDate: '2026-03-31' })

    expect(res.success).toBe(true)
    const data = res.data as { netIncome: number; accountsCarriedForward: number }
    expect(data.netIncome).toBe(30000)

    const jeArgs = db.journalEntry.create.mock.calls[0][0]
    expect(jeArgs.data.sourceType).toBe('YEAR_END_OPENING')
    const lines = jeArgs.data.lines.create as Array<{ accountId: string; debitAmount: number; creditAmount: number }>
    // Only balance-sheet accounts (Cash, Capital) carry a line — Sales/Opex don't.
    expect(lines.map((l) => l.accountId).sort()).toEqual(['coa-cash', 'coa-capital'].sort())
    // Cash carries forward as-is: 80000 debit.
    expect(lines.find((l) => l.accountId === 'coa-cash')).toMatchObject({ debitAmount: 80000, creditAmount: 0 })
    // Capital's own -50000 balance adjusted by -netIncome (30000) => -80000 => credit 80000.
    expect(lines.find((l) => l.accountId === 'coa-capital')).toMatchObject({ debitAmount: 0, creditAmount: 80000 })
    // The whole entry balances (proves the accounting identity held).
    const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0)
    const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0)
    expect(totalDebit).toBe(totalCredit)
  })

  it('locks the business at the closing date', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await yearEndCloseService.closeFinancialYear({ closingDate: '2026-03-31' })

    expect(db.businessProfile.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'bp-1' },
      data: expect.objectContaining({ lockDate: expect.any(Date) })
    }))
    const lockDateArg = db.businessProfile.update.mock.calls[0][0].data.lockDate as Date
    expect(lockDateArg.getFullYear()).toBe(2026)
    expect(lockDateArg.getMonth()).toBe(2) // March, 0-indexed
    expect(lockDateArg.getDate()).toBe(31)
  })
})
