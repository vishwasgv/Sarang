import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import {
  financialStatementsService, buildBalanceSheet, buildGeneralLedger, buildDayBook, buildCashFlowStatement,
  classifyAccount, voucherTypeOf,
  type AccountRef, type LedgerLine, type RawLedgerLine, type RawEntry
} from '../financial-statements.service'
import { parseLocalDateEnd } from '../../utils/date.util'

const acct = (id: string, accountCode: string, accountName: string, accountType: string): AccountRef => ({ id, accountCode, accountName, accountType })

const CASH = acct('cash', '1000', 'Cash & Bank', 'ASSET')
const AR = acct('ar', '1100', 'Accounts Receivable', 'ASSET')
const INV = acct('inv', '1200', 'Inventory', 'ASSET')
const FA = acct('fa', '1500', 'Fixed Assets', 'ASSET')
const AP = acct('ap', '2000', 'Accounts Payable', 'LIABILITY')
const LOAN = acct('loan', '2500', 'Bank Loan', 'LIABILITY')
const CAP = acct('cap', '3000', 'Owner Capital', 'EQUITY')
const SALES = acct('sales', '4000', 'Sales Revenue', 'INCOME')
const COGS = acct('cogs', '5000', 'Cost of Goods Sold', 'EXPENSE')
const OPEX = acct('opex', '6000', 'Operating Expenses', 'EXPENSE')
const DEP = acct('dep', '6100', 'Depreciation Expense', 'EXPENSE')
const ACCOUNTS = [CASH, AR, INV, FA, AP, LOAN, CAP, SALES, COGS, OPEX, DEP]

const d = (m: number, day: number, y = 2026) => new Date(y, m - 1, day, 10, 0, 0)

interface Entry { id: string; no: string; date: Date; src: string; srcId?: string; narration?: string; lines: [AccountRef, number, number][] }

// A small business's January 2026, all entries balanced.
const JAN: Entry[] = [
  { id: 'e1', no: 'JE-00001', date: d(1, 2), src: 'MANUAL', narration: 'Capital introduced', lines: [[CASH, 100000, 0], [CAP, 0, 100000]] },
  { id: 'e2', no: 'JE-00002', date: d(1, 3), src: 'MANUAL', narration: 'Bank loan received', lines: [[CASH, 50000, 0], [LOAN, 0, 50000]] },
  { id: 'e3', no: 'JE-00003', date: d(1, 4), src: 'MANUAL', narration: 'Bought equipment', lines: [[FA, 60000, 0], [CASH, 0, 60000]] },
  { id: 'e4', no: 'JE-00004', date: d(1, 5), src: 'BILL', srcId: 'bill-1', narration: 'Stock purchase', lines: [[INV, 20000, 0], [AP, 0, 20000]] },
  { id: 'e5', no: 'JE-00005', date: d(1, 10), src: 'INVOICE', srcId: 'inv-1', narration: 'Sale', lines: [[AR, 30000, 0], [SALES, 0, 30000]] },
  { id: 'e6', no: 'JE-00006', date: d(1, 12), src: 'INVOICE', srcId: 'inv-1', narration: 'Cost of sale', lines: [[COGS, 12000, 0], [INV, 0, 12000]] },
  { id: 'e7', no: 'JE-00007', date: d(1, 15), src: 'PAYMENT', srcId: 'pay-1', narration: 'Payment for Invoice INV-1', lines: [[CASH, 10000, 0], [AR, 0, 10000]] },
  { id: 'e8', no: 'JE-00008', date: d(1, 20), src: 'EXPENSE', srcId: 'exp-1', narration: 'Rent', lines: [[OPEX, 5000, 0], [CASH, 0, 5000]] },
  { id: 'e9', no: 'JE-00009', date: d(1, 31), src: 'ASSET_DEPRECIATION', srcId: 'dep-1', narration: 'Depreciation', lines: [[DEP, 1000, 0], [FA, 0, 1000]] }
]

// Year-end close on 31 Jan: every balance-sheet balance restated on 1 Feb,
// profit of 12000 folded into capital.
const YEAR_END: Entry = {
  id: 'ye1', no: 'JE-00010', date: new Date(2026, 1, 1), src: 'YEAR_END_OPENING', narration: 'Opening balances',
  lines: [[CASH, 95000, 0], [AR, 20000, 0], [INV, 8000, 0], [FA, 59000, 0], [AP, 0, 20000], [LOAN, 0, 50000], [CAP, 0, 112000]]
}

function toLines(entries: Entry[]): LedgerLine[] {
  return entries.flatMap((e) => e.lines.map(([a, dr, cr]) => ({ accountId: a.id, debitAmount: dr, creditAmount: cr, entryDate: e.date, sourceType: e.src })))
}
function toRaw(entries: Entry[], account: AccountRef): RawLedgerLine[] {
  return entries.flatMap((e) => e.lines.filter(([a]) => a.id === account.id).map(([, dr, cr]) => ({
    debitAmount: dr, creditAmount: cr, remarks: null,
    journalEntry: { id: e.id, entryNumber: e.no, entryDate: e.date, narration: e.narration ?? null, sourceType: e.src, sourceId: e.srcId ?? null, isReversed: false }
  })))
}
function toRawEntries(entries: Entry[]): RawEntry[] {
  return entries.map((e) => ({
    id: e.id, entryNumber: e.no, entryDate: e.date, narration: e.narration ?? null, sourceType: e.src, sourceId: e.srcId ?? null, isReversed: false,
    lines: e.lines.map(([a, dr, cr]) => ({ debitAmount: dr, creditAmount: cr, account: { accountCode: a.accountCode, accountName: a.accountName } }))
  }))
}

const row = (r: { groups: { rows: { accountId: string | null; amount: number; compareAmount: number | null }[] }[] }, id: string) =>
  r.groups.flatMap((g) => g.rows).find((x) => x.accountId === id)

describe('classifyAccount', () => {
  it('classifies system and user-created accounts', () => {
    expect(classifyAccount(CASH)).toBe('CASH')
    expect(classifyAccount(AR)).toBe('CURRENT_ASSET')
    expect(classifyAccount(FA)).toBe('FIXED_ASSET')
    expect(classifyAccount(LOAN)).toBe('LONG_TERM_LIABILITY')
    expect(classifyAccount(acct('x', '2100', 'Tax Payable', 'LIABILITY'))).toBe('CURRENT_LIABILITY')
    expect(classifyAccount(acct('y', '1800', 'HDFC Bank Account', 'ASSET'))).toBe('CASH')
    expect(classifyAccount(acct('z', '1600', 'Delivery Vehicles', 'ASSET'))).toBe('FIXED_ASSET')
  })
})

describe('buildBalanceSheet', () => {
  it('balances: assets = liabilities + equity with current-period profit in equity', () => {
    const bs = buildBalanceSheet(ACCOUNTS, toLines(JAN), parseLocalDateEnd('2026-01-31'), null, { asOf: '2026-01-31', compareAsOf: null })
    expect(bs.totals.assets).toBe(182000)
    expect(bs.totals.liabilities).toBe(70000)
    expect(bs.totals.currentProfit).toBe(12000)
    expect(bs.totals.equity).toBe(112000)
    expect(bs.totals.liabilitiesAndEquity).toBe(182000)
    expect(bs.balanced).toBe(true)
    expect(bs.difference).toBe(0)
    expect(row(bs, 'fa')!.amount).toBe(59000)
    expect(bs.groups.find((g) => g.key === 'fixedAssets')!.total).toBe(59000)
    expect(bs.groups.find((g) => g.key === 'longTermLiabilities')!.total).toBe(50000)
    expect(bs.groups.find((g) => g.key === 'equity')!.rows.some((r) => r.kind === 'currentProfit' && r.amount === 12000)).toBe(true)
  })

  it('is an as-of snapshot: excludes later postings and omits zero rows', () => {
    const bs = buildBalanceSheet(ACCOUNTS, toLines(JAN), parseLocalDateEnd('2026-01-04'), null, { asOf: '2026-01-04', compareAsOf: null })
    expect(bs.totals.assets).toBe(150000)
    expect(bs.totals.currentProfit).toBe(0)
    expect(row(bs, 'ar')).toBeUndefined()
    expect(bs.balanced).toBe(true)
  })

  it('carries a comparison column and balances on both dates', () => {
    const bs = buildBalanceSheet(ACCOUNTS, toLines(JAN), parseLocalDateEnd('2026-01-31'), parseLocalDateEnd('2026-01-10'), { asOf: '2026-01-31', compareAsOf: '2026-01-10' })
    expect(row(bs, 'cash')!.amount).toBe(95000)
    expect(row(bs, 'cash')!.compareAmount).toBe(90000)
    expect(bs.compareTotals!.assets).toBe(bs.compareTotals!.liabilitiesAndEquity)
    expect(bs.compareTotals!.currentProfit).toBe(30000)
  })

  it('does not double count balances after a year-end close', () => {
    const lines = toLines([...JAN, YEAR_END])
    const bs = buildBalanceSheet(ACCOUNTS, lines, parseLocalDateEnd('2026-02-15'), parseLocalDateEnd('2026-01-31'), { asOf: '2026-02-15', compareAsOf: '2026-01-31' })
    expect(bs.totals.assets).toBe(182000)
    expect(bs.totals.currentProfit).toBe(0)
    expect(row(bs, 'cap')!.amount).toBe(112000)
    expect(bs.balanced).toBe(true)
    expect(bs.compareTotals!.assets).toBe(182000)
    expect(bs.compareTotals!.currentProfit).toBe(12000)
  })

  it('counts post-close activity as new current-period profit', () => {
    const feb: Entry = { id: 'f1', no: 'JE-00011', date: d(2, 10), src: 'INVOICE', srcId: 'inv-2', lines: [[CASH, 5000, 0], [SALES, 0, 5000]] }
    const bs = buildBalanceSheet(ACCOUNTS, toLines([...JAN, YEAR_END, feb]), parseLocalDateEnd('2026-02-28'), null, { asOf: '2026-02-28', compareAsOf: null })
    expect(bs.totals.currentProfit).toBe(5000)
    expect(bs.totals.assets).toBe(187000)
    expect(bs.balanced).toBe(true)
  })

  it('sums float-imprecise postings without breaking the balance check', () => {
    const lines: LedgerLine[] = []
    for (let i = 0; i < 500; i++) {
      lines.push({ accountId: 'cash', debitAmount: 0.1, creditAmount: 0, entryDate: d(1, 5), sourceType: 'MANUAL' })
      lines.push({ accountId: 'sales', debitAmount: 0, creditAmount: 0.1, entryDate: d(1, 5), sourceType: 'MANUAL' })
    }
    const bs = buildBalanceSheet(ACCOUNTS, lines, parseLocalDateEnd('2026-01-31'), null, { asOf: '2026-01-31', compareAsOf: null })
    expect(bs.totals.assets).toBe(50)
    expect(bs.balanced).toBe(true)
  })
})

describe('buildGeneralLedger', () => {
  it('computes opening balance, running balance and closing balance for an asset', () => {
    const gl = buildGeneralLedger(CASH, toRaw(JAN, CASH), [], '2026-01-10', '2026-01-31')
    expect(gl.normalSide).toBe('DEBIT')
    expect(gl.openingBalance).toBe(90000)
    expect(gl.lines.map((l) => l.balance)).toEqual([100000, 95000])
    expect(gl.totalDebit).toBe(10000)
    expect(gl.totalCredit).toBe(5000)
    expect(gl.closingBalance).toBe(95000)
    expect(gl.openingBalance + gl.totalDebit - gl.totalCredit).toBe(gl.closingBalance)
  })

  it('shows credit-normal accounts as positive on the credit side', () => {
    const gl = buildGeneralLedger(AP, toRaw(JAN, AP), [], '2026-01-01', '2026-01-31')
    expect(gl.normalSide).toBe('CREDIT')
    expect(gl.openingBalance).toBe(0)
    expect(gl.closingBalance).toBe(20000)
    expect(gl.lines[0].balance).toBe(20000)
  })

  it('identifies the source document and resolved reference', () => {
    const refs = new Map([['INVOICE:inv-1', 'INV-2026-0001']])
    const gl = buildGeneralLedger(AR, toRaw(JAN, AR), [], '2026-01-01', '2026-01-31', refs)
    expect(gl.lines[0]).toMatchObject({ entryNumber: 'JE-00005', sourceType: 'INVOICE', sourceId: 'inv-1', sourceRef: 'INV-2026-0001' })
    expect(gl.lines[1]).toMatchObject({ sourceType: 'PAYMENT', sourceRef: null })
    expect(gl.closingBalance).toBe(20000)
  })

  it('returns an empty statement with the carried opening balance when nothing posts in range', () => {
    const gl = buildGeneralLedger(CASH, toRaw(JAN, CASH), [], '2026-02-01', '2026-02-28')
    expect(gl.lines).toHaveLength(0)
    expect(gl.openingBalance).toBe(95000)
    expect(gl.closingBalance).toBe(95000)
  })

  it('does not double count the year-end carry-forward line', () => {
    const all = [...JAN, YEAR_END]
    const ye = [YEAR_END.date]
    const across = buildGeneralLedger(CASH, toRaw(all, CASH), ye, '2026-01-01', '2026-02-28')
    expect(across.closingBalance).toBe(95000)
    expect(across.lines.at(-1)).toMatchObject({ isCarryForward: true, balance: 95000 })
    expect(across.totalDebit).toBe(160000)
    const after = buildGeneralLedger(CASH, toRaw(all, CASH), ye, '2026-02-05', '2026-02-28')
    expect(after.openingBalance).toBe(95000)
    const pnl = buildGeneralLedger(SALES, toRaw(all, SALES), ye, '2026-01-01', '2026-02-28')
    expect(pnl.closingBalance).toBe(0)
    const pnlAfter = buildGeneralLedger(SALES, toRaw(all, SALES), ye, '2026-02-05', '2026-02-28')
    expect(pnlAfter.openingBalance).toBe(0)
  })
})

describe('buildDayBook', () => {
  it('totals debit and credit per day and per voucher type', () => {
    const extra: Entry = { id: 'e10', no: 'JE-00010', date: d(1, 10), src: 'INVOICE', srcId: 'inv-3', lines: [[AR, 500, 0], [SALES, 0, 500]] }
    const book = buildDayBook(toRawEntries([...JAN, extra]), '2026-01-01', '2026-01-31', 'ALL')
    expect(book.totalVouchers).toBe(10)
    const day10 = book.days.find((x) => x.date === '2026-01-10')!
    expect(day10).toMatchObject({ voucherCount: 2, totalDebit: 30500, totalCredit: 30500 })
    expect(book.totalDebit).toBe(book.totalCredit)
    expect(book.days.map((x) => x.date)).toEqual([...book.days.map((x) => x.date)].sort())
    expect(book.byType.find((t) => t.voucherType === 'SALES')).toMatchObject({ voucherCount: 3, total: 30000 + 12000 + 500 })
    expect(book.vouchers[0].lines).toHaveLength(2)
  })

  it('filters by voucher type', () => {
    const sales = buildDayBook(toRawEntries(JAN), '2026-01-01', '2026-01-31', 'SALES')
    expect(sales.vouchers.every((v) => v.voucherType === 'SALES')).toBe(true)
    expect(sales.totalVouchers).toBe(2)
    const other = buildDayBook(toRawEntries(JAN), '2026-01-01', '2026-01-31', 'OTHER')
    expect(other.vouchers.map((v) => v.sourceType)).toEqual(['ASSET_DEPRECIATION'])
    const journal = buildDayBook(toRawEntries(JAN), '2026-01-01', '2026-01-31', 'JOURNAL')
    expect(journal.totalVouchers).toBe(3)
  })

  it('maps source types to voucher types', () => {
    expect(voucherTypeOf('INVOICE')).toBe('SALES')
    expect(voucherTypeOf('BILL')).toBe('PURCHASE')
    expect(voucherTypeOf('PAYMENT')).toBe('RECEIPT')
    expect(voucherTypeOf('SUPPLIER_PAYMENT')).toBe('PAYMENT')
    expect(voucherTypeOf('EXPENSE')).toBe('EXPENSE')
    expect(voucherTypeOf('MANUAL')).toBe('JOURNAL')
    expect(voucherTypeOf('YEAR_END_OPENING')).toBe('OTHER')
  })

  it('returns an empty book for a range with no entries', () => {
    const book = buildDayBook([], '2026-03-01', '2026-03-31', 'ALL')
    expect(book).toMatchObject({ totalVouchers: 0, totalDebit: 0, totalCredit: 0, truncated: false })
    expect(book.days).toEqual([])
  })
})

describe('buildCashFlowStatement', () => {
  it('splits operating, investing and financing and reconciles to the cash account', () => {
    const cf = buildCashFlowStatement(ACCOUNTS, toLines(JAN), '2026-01-01', '2026-01-31')
    expect(cf.operating.items.find((i) => i.kind === 'netProfit')!.amount).toBe(12000)
    expect(cf.operating.items.find((i) => i.kind === 'depreciation')!.amount).toBe(1000)
    expect(cf.operating.total).toBe(5000)
    expect(cf.investing.total).toBe(-60000)
    expect(cf.financing.total).toBe(150000)
    expect(cf.financing.items.map((i) => i.name).sort()).toEqual(['Bank Loan', 'Owner Capital'])
    expect(cf.netChange).toBe(95000)
    expect(cf.openingCash).toBe(0)
    expect(cf.closingCash).toBe(95000)
    expect(cf.ledgerClosingCash).toBe(95000)
    expect(cf.reconciled).toBe(true)
  })

  it('uses the cash balance before the range as opening cash', () => {
    const cf = buildCashFlowStatement(ACCOUNTS, toLines(JAN), '2026-01-10', '2026-01-31')
    expect(cf.openingCash).toBe(90000)
    expect(cf.netChange).toBe(5000)
    expect(cf.closingCash).toBe(95000)
    expect(cf.investing.total).toBe(-1000 + 1000)
    expect(cf.reconciled).toBe(true)
    expect(cf.cashAccounts[0]).toMatchObject({ accountCode: '1000', opening: 90000, closing: 95000 })
  })

  it('still reconciles when a year-end close falls inside the range', () => {
    const feb: Entry = { id: 'f1', no: 'JE-00011', date: d(2, 10), src: 'INVOICE', srcId: 'inv-2', lines: [[CASH, 5000, 0], [SALES, 0, 5000]] }
    const cf = buildCashFlowStatement(ACCOUNTS, toLines([...JAN, YEAR_END, feb]), '2026-01-01', '2026-02-28')
    expect(cf.netChange).toBe(100000)
    expect(cf.closingCash).toBe(100000)
    expect(cf.ledgerClosingCash).toBe(100000)
    expect(cf.reconciled).toBe(true)
  })

  it('reports a zero statement for a quiet period', () => {
    const cf = buildCashFlowStatement(ACCOUNTS, toLines(JAN), '2026-03-01', '2026-03-31')
    expect(cf.netChange).toBe(0)
    expect(cf.openingCash).toBe(95000)
    expect(cf.closingCash).toBe(95000)
    expect(cf.reconciled).toBe(true)
  })
})

describe('financialStatementsService (db-backed)', () => {
  beforeEach(() => vi.clearAllMocks())

  function dbWith(overrides: Record<string, unknown> = {}) {
    const lines = JAN.flatMap((e) => e.lines.map(([a, dr, cr]) => ({
      accountId: a.id, debitAmount: dr, creditAmount: cr, journalEntry: { entryDate: e.date, sourceType: e.src }
    })))
    return {
      chartOfAccounts: { findMany: vi.fn().mockResolvedValue(ACCOUNTS), findUnique: vi.fn().mockResolvedValue(AR) },
      journalEntryLine: { findMany: vi.fn().mockResolvedValue(lines) },
      journalEntry: { findMany: vi.fn().mockResolvedValue([]) },
      invoice: { findMany: vi.fn().mockResolvedValue([{ id: 'inv-1', invoiceNumber: 'INV-2026-0001' }]) },
      bill: { findMany: vi.fn().mockResolvedValue([]) },
      ...overrides
    }
  }

  it('generateBalanceSheet balances', async () => {
    vi.mocked(getPrisma).mockReturnValue(dbWith() as never)
    const bs = await financialStatementsService.generateBalanceSheet({ asOf: '2026-01-31' })
    expect(bs.balanced).toBe(true)
    expect(bs.totals.assets).toBe(182000)
  })

  it('generateCashFlowStatement reconciles', async () => {
    vi.mocked(getPrisma).mockReturnValue(dbWith() as never)
    const cf = await financialStatementsService.generateCashFlowStatement({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })
    expect(cf.reconciled).toBe(true)
    expect(cf.closingCash).toBe(95000)
  })

  it('generateGeneralLedger resolves invoice numbers and returns null for an unknown account', async () => {
    const arLines = toRaw(JAN, AR)
    vi.mocked(getPrisma).mockReturnValue(dbWith({ journalEntryLine: { findMany: vi.fn().mockResolvedValue(arLines) } }) as never)
    const gl = await financialStatementsService.generateGeneralLedger({ accountId: 'ar', dateFrom: '2026-01-01', dateTo: '2026-01-31' })
    expect(gl!.lines[0].sourceRef).toBe('INV-2026-0001')
    expect(gl!.closingBalance).toBe(20000)

    vi.mocked(getPrisma).mockReturnValue(dbWith({ chartOfAccounts: { findMany: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) } }) as never)
    expect(await financialStatementsService.generateGeneralLedger({ accountId: 'nope', dateFrom: '2026-01-01', dateTo: '2026-01-31' })).toBeNull()
  })

  it('generateDayBook filters by source type in the query', async () => {
    const findMany = vi.fn().mockResolvedValue(toRawEntries(JAN.filter((e) => e.src === 'BILL')))
    vi.mocked(getPrisma).mockReturnValue(dbWith({ journalEntry: { findMany } }) as never)
    const book = await financialStatementsService.generateDayBook({ dateFrom: '2026-01-01', dateTo: '2026-01-31', voucherType: 'PURCHASE' })
    expect(findMany.mock.calls[0][0].where.sourceType).toEqual({ in: ['BILL', 'GOODS_RECEIPT_NOTE', 'PURCHASE_ORDER', 'DEBIT_NOTE'] })
    expect(book.totalVouchers).toBe(1)
    expect(book.totalDebit).toBe(20000)
  })
})
