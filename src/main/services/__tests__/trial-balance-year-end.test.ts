// Gap 12.19: does the Trial Balance double count after a year-end close?
//
// yearEndCloseService posts ONE YEAR_END_OPENING entry (dated the day after the closing date) that
// re-states every balance-sheet balance and folds the year's profit into Owner's Capital, while the
// old year's lines stay in the ledger. A Trial Balance that simply sums every line up to the report
// date therefore counts each carried-forward balance twice (once from the old lines, once from the
// opening entry) and still "balances", so nothing looks wrong. Balance Sheet / General Ledger
// (financial-statements.service.ts) already start from the latest opening entry; the Trial Balance
// must do the same.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { reportService } from '../report.service'

const CASH = { id: 'coa-cash', accountCode: '1000', accountName: 'Cash & Bank', accountType: 'ASSET', isActive: true }
const CAPITAL = { id: 'coa-cap', accountCode: '3000', accountName: "Owner's Capital", accountType: 'EQUITY', isActive: true }
const REVENUE = { id: 'coa-rev', accountCode: '4000', accountName: 'Sales Revenue', accountType: 'INCOME', isActive: true }
const RENT = { id: 'coa-rent', accountCode: '6000', accountName: 'Operating Expenses', accountType: 'EXPENSE', isActive: true }

const line = (accountId: string, debitAmount: number, creditAmount: number, entryDate: string, sourceType: string) =>
  ({ accountId, debitAmount, creditAmount, journalEntry: { entryDate: new Date(entryDate), sourceType } })

// FY ending 2026-03-31: sale 1180 cash, rent 300 cash -> net profit 880, cash 880.
// Close posts opening entry on 2026-04-01: Cash Dr 880, Capital Cr 880 (P&L folded into capital).
// New year: sale of 100 cash on 2026-04-10.
const LEDGER = [
  line(CASH.id, 1180, 0, '2026-03-01T10:00:00', 'INVOICE'),
  line(REVENUE.id, 0, 1180, '2026-03-01T10:00:00', 'INVOICE'),
  line(RENT.id, 300, 0, '2026-03-05T10:00:00', 'EXPENSE'),
  line(CASH.id, 0, 300, '2026-03-05T10:00:00', 'EXPENSE'),
  line(CASH.id, 880, 0, '2026-04-01T00:00:00', 'YEAR_END_OPENING'),
  line(CAPITAL.id, 0, 880, '2026-04-01T00:00:00', 'YEAR_END_OPENING'),
  line(CASH.id, 100, 0, '2026-04-10T10:00:00', 'INVOICE'),
  line(REVENUE.id, 0, 100, '2026-04-10T10:00:00', 'INVOICE')
]

function useLedger(lines = LEDGER) {
  vi.mocked(getPrisma).mockReturnValue({
    chartOfAccounts: { findMany: vi.fn().mockResolvedValue([CASH, CAPITAL, REVENUE, RENT]) },
    // honours the real query's `entryDate <= to` filter, like the database would
    journalEntryLine: {
      findMany: vi.fn().mockImplementation(({ where }: { where: { journalEntry: { entryDate: { lte: Date } } } }) =>
        Promise.resolve(lines.filter(l => l.journalEntry.entryDate.getTime() <= where.journalEntry.entryDate.lte.getTime())))
    }
  } as never)
}

const byAccount = (rows: Array<{ account: string; debit: number; credit: number }>) => Object.fromEntries(rows.map(r => [r.account.slice(0, 4), r]))

beforeEach(() => vi.clearAllMocks())

describe('Trial Balance after year-end close (gap 12.19)', () => {
  it('as of a date before the close, the old year is reported exactly as posted', async () => {
    useLedger()
    const r = await reportService.generateTrialBalanceReport({ dateFrom: '2026-01-01', dateTo: '2026-03-31' })
    const a = byAccount(r.rows)
    expect(a['1000'].debit).toBe(880)
    expect(a['4000'].credit).toBe(1180)
    expect(a['6000'].debit).toBe(300)
    expect(a['3000']).toBeUndefined()
    expect(r.balanced).toBe(true)
  })

  it('as of a date after the close, carried-forward balances are counted once (cash 980, not 1860)', async () => {
    useLedger()
    const r = await reportService.generateTrialBalanceReport({ dateFrom: '2026-04-01', dateTo: '2026-04-30' })
    const a = byAccount(r.rows)
    expect(a['1000'].debit).toBe(980) // 880 carried forward + 100 new sale
    expect(a['3000'].credit).toBe(880) // capital carries the folded profit
    expect(a['4000'].credit).toBe(100) // only the new year's revenue
    expect(a['6000']).toBeUndefined() // last year's expense does not reappear
    expect(r.totalDebit).toBe(980)
    expect(r.totalCredit).toBe(980)
    expect(r.balanced).toBe(true)
  })

  it('agrees with the Balance Sheet basis: on the opening date itself the opening entry alone is the trial balance', async () => {
    useLedger()
    const r = await reportService.generateTrialBalanceReport({ dateFrom: '2026-04-01', dateTo: '2026-04-01' })
    const a = byAccount(r.rows)
    expect(a['1000'].debit).toBe(880)
    expect(a['3000'].credit).toBe(880)
    expect(r.rows).toHaveLength(2)
  })

  it('is unchanged for a business that never closed a year', async () => {
    useLedger(LEDGER.filter(l => l.journalEntry.sourceType !== 'YEAR_END_OPENING'))
    const r = await reportService.generateTrialBalanceReport({ dateFrom: '2026-01-01', dateTo: '2026-04-30' })
    const a = byAccount(r.rows)
    expect(a['1000'].debit).toBe(980)
    expect(a['4000'].credit).toBe(1280)
    expect(a['6000'].debit).toBe(300)
  })

  it('uses only the latest opening entry when several years were closed', async () => {
    const ledger = [
      ...LEDGER,
      line(CASH.id, 0, 200, '2026-05-01T09:00:00', 'EXPENSE'),
      line(RENT.id, 200, 0, '2026-05-01T09:00:00', 'EXPENSE'),
      // second close on 2027-03-31: cash 780 (880 + 100 - 200), capital 880 + profit(100 - 200) = 780
      line(CASH.id, 780, 0, '2027-04-01T00:00:00', 'YEAR_END_OPENING'),
      line(CAPITAL.id, 0, 780, '2027-04-01T00:00:00', 'YEAR_END_OPENING')
    ]
    useLedger(ledger)
    const r = await reportService.generateTrialBalanceReport({ dateFrom: '2027-04-01', dateTo: '2027-06-30' })
    const a = byAccount(r.rows)
    expect(a['1000'].debit).toBe(780)
    expect(a['3000'].credit).toBe(780)
    expect(r.rows).toHaveLength(2)
  })
})
