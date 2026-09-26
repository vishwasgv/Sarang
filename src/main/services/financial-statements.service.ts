import { getPrisma } from '../database/db'
import { roundCurrency, sumCurrency, moneyEpsilon } from './currency.service'
import { toLocalISODate, parseLocalDateStart, parseLocalDateEnd } from '../utils/date.util'

// Balance Sheet, General Ledger, Day Book and Cash Flow Statement. All four
// read posted JournalEntryLine rows only (same source as Trial Balance).
//
// Year-end close posts one YEAR_END_OPENING entry that re-states every
// balance-sheet balance on the first day of the new year, while the prior
// year's lines stay in the ledger. So "balance as of D" here starts from the
// latest YEAR_END_OPENING entry on or before D (its own lines included, older
// lines excluded), otherwise it would count carried-forward balances twice.
// Profit-and-loss accounts are folded into Owner's Capital by that entry, so
// current-period profit likewise counts only lines from that point.

export interface AccountRef { id: string; accountCode: string; accountName: string; accountType: string; parentId?: string | null }
export interface LedgerLine { accountId: string; debitAmount: number; creditAmount: number; entryDate: Date; sourceType: string }

export const YEAR_END_SOURCE = 'YEAR_END_OPENING'

export type AccountClass =
  | 'CASH' | 'CURRENT_ASSET' | 'FIXED_ASSET'
  | 'CURRENT_LIABILITY' | 'LONG_TERM_LIABILITY' | 'EQUITY' | 'INCOME' | 'EXPENSE'

const FIXED_ASSET_RE = /fixed asset|equipment|machinery|vehicle|furniture|building|land\b|plant|computer|intangible|investment/i
const LOAN_RE = /loan|borrowing|debenture|overdraft|mortgage|finance lease/i
const CASH_RE = /\b(cash|bank)\b/i
const DEPRECIATION_RE = /depreciation|amortis|amortiz/i

export function classifyAccount(acc: Pick<AccountRef, 'accountCode' | 'accountName' | 'accountType'>): AccountClass {
  switch (acc.accountType) {
    case 'ASSET':
      if (acc.accountCode === '1000' || CASH_RE.test(acc.accountName)) return 'CASH'
      if (acc.accountCode.startsWith('15') || FIXED_ASSET_RE.test(acc.accountName)) return 'FIXED_ASSET'
      return 'CURRENT_ASSET'
    case 'LIABILITY':
      return LOAN_RE.test(acc.accountName) ? 'LONG_TERM_LIABILITY' : 'CURRENT_LIABILITY'
    case 'EQUITY': return 'EQUITY'
    case 'INCOME': return 'INCOME'
    default: return 'EXPENSE'
  }
}

function isDepreciationExpense(acc: AccountRef): boolean {
  return acc.accountType === 'EXPENSE' && (acc.accountCode === '6100' || DEPRECIATION_RE.test(acc.accountName))
}

const flip = (n: number): number => (n === 0 ? 0 : -n)

// Net = debit - credit per account, summed with the Decimal-safe helper.
function netByAccount(lines: LedgerLine[]): Map<string, number> {
  const parts = new Map<string, number[]>()
  for (const l of lines) {
    const net = roundCurrency(l.debitAmount - l.creditAmount)
    if (net === 0) continue
    const arr = parts.get(l.accountId) ?? []
    arr.push(net)
    parts.set(l.accountId, arr)
  }
  const out = new Map<string, number>()
  for (const [id, arr] of parts) out.set(id, sumCurrency(arr))
  return out
}

export function balancesAsOf(lines: LedgerLine[], asOf: Date): Map<string, number> {
  let start = -Infinity
  for (const l of lines) {
    if (l.sourceType === YEAR_END_SOURCE) {
      const t = l.entryDate.getTime()
      if (t <= asOf.getTime() && t > start) start = t
    }
  }
  return netByAccount(lines.filter((l) => l.entryDate.getTime() <= asOf.getTime() && l.entryDate.getTime() >= start))
}

// ─── Balance Sheet ───────────────────────────────────────────────────────────

export type BalanceSheetGroupKey = 'currentAssets' | 'fixedAssets' | 'currentLiabilities' | 'longTermLiabilities' | 'equity'

export interface BalanceSheetRow { accountId: string | null; accountCode: string; accountName: string; kind: 'account' | 'currentProfit'; amount: number; compareAmount: number | null }
export interface BalanceSheetGroup { key: BalanceSheetGroupKey; side: 'ASSET' | 'LIABILITY' | 'EQUITY'; rows: BalanceSheetRow[]; total: number; compareTotal: number | null }
export interface BalanceSheetTotals { assets: number; liabilities: number; equity: number; liabilitiesAndEquity: number; currentProfit: number }
export interface BalanceSheetReport {
  asOf: string; compareAsOf: string | null
  groups: BalanceSheetGroup[]
  totals: BalanceSheetTotals
  compareTotals: BalanceSheetTotals | null
  balanced: boolean
  difference: number
}

const GROUP_ORDER: { key: BalanceSheetGroupKey; side: BalanceSheetGroup['side']; classes: AccountClass[] }[] = [
  { key: 'currentAssets', side: 'ASSET', classes: ['CASH', 'CURRENT_ASSET'] },
  { key: 'fixedAssets', side: 'ASSET', classes: ['FIXED_ASSET'] },
  { key: 'currentLiabilities', side: 'LIABILITY', classes: ['CURRENT_LIABILITY'] },
  { key: 'longTermLiabilities', side: 'LIABILITY', classes: ['LONG_TERM_LIABILITY'] },
  { key: 'equity', side: 'EQUITY', classes: ['EQUITY'] }
]

interface SheetSnapshot { amountByAccount: Map<string, number>; currentProfit: number }

// Asset amounts are debit-positive; liability/equity amounts are credit-positive.
function snapshotAt(accounts: AccountRef[], lines: LedgerLine[], asOf: Date): SheetSnapshot {
  const net = balancesAsOf(lines, asOf)
  const amountByAccount = new Map<string, number>()
  const profitParts: number[] = []
  for (const acc of accounts) {
    const n = net.get(acc.id) ?? 0
    if (acc.accountType === 'ASSET') amountByAccount.set(acc.id, n)
    else if (acc.accountType === 'LIABILITY' || acc.accountType === 'EQUITY') amountByAccount.set(acc.id, flip(n))
    else profitParts.push(flip(n))
  }
  return { amountByAccount, currentProfit: sumCurrency(profitParts) }
}

function totalsOf(groups: BalanceSheetGroup[], pick: (g: BalanceSheetGroup) => number, currentProfit: number): BalanceSheetTotals {
  const side = (s: BalanceSheetGroup['side']) => sumCurrency(groups.filter((g) => g.side === s).map(pick))
  const assets = side('ASSET')
  const liabilities = side('LIABILITY')
  const equity = side('EQUITY')
  return { assets, liabilities, equity, liabilitiesAndEquity: roundCurrency(liabilities + equity), currentProfit }
}

export function buildBalanceSheet(accounts: AccountRef[], lines: LedgerLine[], asOf: Date, compareAsOf: Date | null, labels: { asOf: string; compareAsOf: string | null }): BalanceSheetReport {
  const cur = snapshotAt(accounts, lines, asOf)
  const cmp = compareAsOf ? snapshotAt(accounts, lines, compareAsOf) : null

  const groups: BalanceSheetGroup[] = GROUP_ORDER.map((g) => {
    const rows: BalanceSheetRow[] = []
    for (const acc of accounts) {
      if (!g.classes.includes(classifyAccount(acc))) continue
      const amount = cur.amountByAccount.get(acc.id) ?? 0
      const compareAmount = cmp ? (cmp.amountByAccount.get(acc.id) ?? 0) : null
      if (amount === 0 && (compareAmount ?? 0) === 0) continue
      rows.push({ accountId: acc.id, accountCode: acc.accountCode, accountName: acc.accountName, kind: 'account', amount, compareAmount })
    }
    if (g.key === 'equity') {
      rows.push({ accountId: null, accountCode: '', accountName: '', kind: 'currentProfit', amount: cur.currentProfit, compareAmount: cmp ? cmp.currentProfit : null })
    }
    return {
      key: g.key, side: g.side, rows,
      total: sumCurrency(rows.map((r) => r.amount)),
      compareTotal: cmp ? sumCurrency(rows.map((r) => r.compareAmount ?? 0)) : null
    }
  })

  const totals = totalsOf(groups, (g) => g.total, cur.currentProfit)
  const compareTotals = cmp ? totalsOf(groups, (g) => g.compareTotal ?? 0, cmp.currentProfit) : null
  const difference = roundCurrency(totals.assets - totals.liabilitiesAndEquity)
  return {
    asOf: labels.asOf, compareAsOf: labels.compareAsOf,
    groups, totals, compareTotals,
    balanced: Math.abs(difference) < moneyEpsilon(), difference
  }
}

// ─── General Ledger ──────────────────────────────────────────────────────────

export interface GeneralLedgerLine {
  date: string; entryNumber: string; narration: string | null; remarks: string | null
  sourceType: string; sourceId: string | null; sourceRef: string | null
  isReversed: boolean; isCarryForward: boolean
  debit: number; credit: number; balance: number
}
export interface GeneralLedgerReport {
  dateFrom: string; dateTo: string
  account: { id: string; accountCode: string; accountName: string; accountType: string }
  // Balances are shown on the account's natural side: debit-positive for
  // assets/expenses, credit-positive for liabilities/equity/income.
  normalSide: 'DEBIT' | 'CREDIT'
  openingBalance: number
  totalDebit: number; totalCredit: number
  closingBalance: number
  lines: GeneralLedgerLine[]
}

export interface RawLedgerLine {
  debitAmount: number; creditAmount: number; remarks: string | null
  journalEntry: { id: string; entryNumber: string; entryDate: Date; narration: string | null; sourceType: string; sourceId: string | null; isReversed: boolean }
}

export function buildGeneralLedger(
  account: AccountRef, rawLines: RawLedgerLine[], yearEndDates: Date[], dateFrom: string, dateTo: string,
  refs: Map<string, string> = new Map()
): GeneralLedgerReport {
  const from = parseLocalDateStart(dateFrom).getTime()
  const to = parseLocalDateEnd(dateTo).getTime()
  const sign = account.accountType === 'ASSET' || account.accountType === 'EXPENSE' ? 1 : -1
  const ye = yearEndDates.map((d) => d.getTime()).sort((a, b) => a - b)
  const lastYeBeforeFrom = ye.filter((t) => t < from).pop() ?? -Infinity

  const sorted = [...rawLines].sort((a, b) => a.journalEntry.entryDate.getTime() - b.journalEntry.entryDate.getTime())
  const openingNet = sumCurrency(
    sorted.filter((l) => { const t = l.journalEntry.entryDate.getTime(); return t < from && t >= lastYeBeforeFrom })
      .map((l) => roundCurrency(l.debitAmount - l.creditAmount))
  )

  const resets = ye.filter((t) => t >= from && t <= to)
  let resetIdx = 0
  let running = openingNet
  const out: GeneralLedgerLine[] = []
  const debits: number[] = []
  const credits: number[] = []
  for (const l of sorted) {
    const t = l.journalEntry.entryDate.getTime()
    if (t < from || t > to) continue
    while (resetIdx < resets.length && resets[resetIdx] <= t) { running = 0; resetIdx++ }
    const isCarryForward = l.journalEntry.sourceType === YEAR_END_SOURCE
    running = roundCurrency(running + l.debitAmount - l.creditAmount)
    if (!isCarryForward) { debits.push(l.debitAmount); credits.push(l.creditAmount) }
    const refKey = l.journalEntry.sourceId ? `${l.journalEntry.sourceType}:${l.journalEntry.sourceId}` : ''
    out.push({
      date: toLocalISODate(l.journalEntry.entryDate), entryNumber: l.journalEntry.entryNumber,
      narration: l.journalEntry.narration, remarks: l.remarks,
      sourceType: l.journalEntry.sourceType, sourceId: l.journalEntry.sourceId, sourceRef: refs.get(refKey) ?? null,
      isReversed: l.journalEntry.isReversed, isCarryForward,
      debit: l.debitAmount, credit: l.creditAmount, balance: roundCurrency(sign * running) + 0
    })
  }
  if (resetIdx < resets.length) running = 0

  return {
    dateFrom, dateTo,
    account: { id: account.id, accountCode: account.accountCode, accountName: account.accountName, accountType: account.accountType },
    normalSide: sign === 1 ? 'DEBIT' : 'CREDIT',
    openingBalance: roundCurrency(sign * openingNet) + 0,
    totalDebit: sumCurrency(debits), totalCredit: sumCurrency(credits),
    closingBalance: roundCurrency(sign * running) + 0,
    lines: out
  }
}

// ─── Day Book ────────────────────────────────────────────────────────────────

export type VoucherType = 'SALES' | 'PURCHASE' | 'RECEIPT' | 'PAYMENT' | 'EXPENSE' | 'JOURNAL' | 'OTHER'
export const VOUCHER_TYPES: VoucherType[] = ['SALES', 'PURCHASE', 'RECEIPT', 'PAYMENT', 'EXPENSE', 'JOURNAL', 'OTHER']

const VOUCHER_SOURCES: Record<Exclude<VoucherType, 'OTHER'>, string[]> = {
  SALES: ['INVOICE', 'SALES_RETURN', 'CREDIT_NOTE', 'INVOICE_COGS', 'SALES_RETURN_COGS'],
  PURCHASE: ['BILL', 'GOODS_RECEIPT_NOTE', 'PURCHASE_ORDER', 'DEBIT_NOTE'],
  RECEIPT: ['PAYMENT', 'CASH_SALE_PAYMENT_REVERSAL', 'PAYMENT_ROUNDING'],
  PAYMENT: ['SUPPLIER_PAYMENT', 'GST_PAYMENT'],
  EXPENSE: ['EXPENSE'],
  JOURNAL: ['MANUAL', 'STOCK_IN', 'STOCK_ADJUSTMENT', 'STOCK_OPENING']
}
const ALL_MAPPED_SOURCES = Object.values(VOUCHER_SOURCES).flat()

export function voucherTypeOf(sourceType: string): VoucherType {
  for (const [type, sources] of Object.entries(VOUCHER_SOURCES)) if (sources.includes(sourceType)) return type as VoucherType
  return 'OTHER'
}

export interface DayBookVoucher {
  id: string; date: string; entryNumber: string; voucherType: VoucherType; sourceType: string; sourceId: string | null
  narration: string | null; isReversed: boolean
  debit: number; credit: number
  lines: { account: string; debit: number; credit: number }[]
}
export interface DayBookDay { date: string; voucherCount: number; totalDebit: number; totalCredit: number }
export interface DayBookReport {
  dateFrom: string; dateTo: string; voucherType: VoucherType | 'ALL'
  days: DayBookDay[]
  byType: { voucherType: VoucherType; voucherCount: number; total: number }[]
  vouchers: DayBookVoucher[]
  totalVouchers: number; totalDebit: number; totalCredit: number
  truncated: boolean
}

export const DAY_BOOK_ROW_CAP = 5000

export interface RawEntry {
  id: string; entryNumber: string; entryDate: Date; narration: string | null; sourceType: string; sourceId: string | null; isReversed: boolean
  lines: { debitAmount: number; creditAmount: number; account: { accountCode: string; accountName: string } }[]
}

export function buildDayBook(entries: RawEntry[], dateFrom: string, dateTo: string, voucherType: VoucherType | 'ALL'): DayBookReport {
  const vouchers: DayBookVoucher[] = entries
    .map((e) => ({
      id: e.id, date: toLocalISODate(e.entryDate), entryNumber: e.entryNumber, voucherType: voucherTypeOf(e.sourceType),
      sourceType: e.sourceType, sourceId: e.sourceId, narration: e.narration, isReversed: e.isReversed,
      debit: sumCurrency(e.lines.map((l) => l.debitAmount)), credit: sumCurrency(e.lines.map((l) => l.creditAmount)),
      lines: e.lines.map((l) => ({ account: `${l.account.accountCode} — ${l.account.accountName}`, debit: l.debitAmount, credit: l.creditAmount })),
      time: e.entryDate.getTime()
    }))
    .filter((v) => voucherType === 'ALL' || v.voucherType === voucherType)
    .sort((a, b) => a.time - b.time || a.entryNumber.localeCompare(b.entryNumber))
    .map(({ time: _time, ...v }) => v)

  const dayParts = new Map<string, { count: number; debits: number[]; credits: number[] }>()
  const typeParts = new Map<VoucherType, { count: number; totals: number[] }>()
  for (const v of vouchers) {
    const d = dayParts.get(v.date) ?? { count: 0, debits: [], credits: [] }
    d.count++; d.debits.push(v.debit); d.credits.push(v.credit)
    dayParts.set(v.date, d)
    const t = typeParts.get(v.voucherType) ?? { count: 0, totals: [] }
    t.count++; t.totals.push(v.debit)
    typeParts.set(v.voucherType, t)
  }
  const days: DayBookDay[] = [...dayParts.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, d]) => ({ date, voucherCount: d.count, totalDebit: sumCurrency(d.debits), totalCredit: sumCurrency(d.credits) }))
  const byType = VOUCHER_TYPES.filter((t) => typeParts.has(t))
    .map((t) => ({ voucherType: t, voucherCount: typeParts.get(t)!.count, total: sumCurrency(typeParts.get(t)!.totals) }))

  return {
    dateFrom, dateTo, voucherType, days, byType,
    vouchers: vouchers.slice(0, DAY_BOOK_ROW_CAP),
    totalVouchers: vouchers.length,
    totalDebit: sumCurrency(days.map((d) => d.totalDebit)),
    totalCredit: sumCurrency(days.map((d) => d.totalCredit)),
    truncated: vouchers.length > DAY_BOOK_ROW_CAP
  }
}

// ─── Cash Flow Statement (indirect) ──────────────────────────────────────────

export interface CashFlowItem { kind: 'netProfit' | 'depreciation' | 'account'; accountCode: string; name: string; amount: number }
export interface CashFlowSection { items: CashFlowItem[]; total: number }
export interface CashFlowStatementReport {
  dateFrom: string; dateTo: string
  operating: CashFlowSection; investing: CashFlowSection; financing: CashFlowSection
  netChange: number
  openingCash: number; closingCash: number
  ledgerClosingCash: number
  reconciled: boolean
  cashAccounts: { accountCode: string; name: string; opening: number; closing: number }[]
}

export function buildCashFlowStatement(accounts: AccountRef[], lines: LedgerLine[], dateFrom: string, dateTo: string): CashFlowStatementReport {
  const from = parseLocalDateStart(dateFrom)
  const to = parseLocalDateEnd(dateTo)
  const dayBefore = new Date(from.getTime() - 1)

  // The carried-forward entry only restates balances already in the ledger,
  // so real movements are every other line dated inside the range.
  const movement = netByAccount(lines.filter((l) =>
    l.sourceType !== YEAR_END_SOURCE && l.entryDate.getTime() >= from.getTime() && l.entryDate.getTime() <= to.getTime()))
  const openingNet = balancesAsOf(lines, dayBefore)
  const closingNet = balancesAsOf(lines, to)

  const operatingItems: CashFlowItem[] = []
  const investingItems: CashFlowItem[] = []
  const financingItems: CashFlowItem[] = []
  const profitParts: number[] = []
  const depreciationParts: number[] = []
  const cashAccounts: CashFlowStatementReport['cashAccounts'] = []
  const opening: number[] = []
  const ledgerClosing: number[] = []
  const cashMovement: number[] = []

  for (const acc of accounts) {
    const mov = movement.get(acc.id) ?? 0
    const cls = classifyAccount(acc)
    if (cls === 'INCOME' || cls === 'EXPENSE') {
      profitParts.push(flip(mov))
      if (isDepreciationExpense(acc)) depreciationParts.push(mov)
      continue
    }
    if (cls === 'CASH') {
      const o = openingNet.get(acc.id) ?? 0
      const c = closingNet.get(acc.id) ?? 0
      opening.push(o); ledgerClosing.push(c); cashMovement.push(mov)
      if (o !== 0 || c !== 0 || mov !== 0) cashAccounts.push({ accountCode: acc.accountCode, name: acc.accountName, opening: o, closing: c })
      continue
    }
    if (mov === 0) continue
    const item: CashFlowItem = { kind: 'account', accountCode: acc.accountCode, name: acc.accountName, amount: flip(roundCurrency(mov)) }
    if (cls === 'FIXED_ASSET') investingItems.push(item)
    else if (cls === 'EQUITY' || cls === 'LONG_TERM_LIABILITY') financingItems.push(item)
    else operatingItems.push(item)
  }

  const netProfit = sumCurrency(profitParts)
  const depreciation = sumCurrency(depreciationParts)

  // Depreciation is credited straight to the asset account, so the asset's
  // movement already contains it; adding it back to operating means taking
  // it out of investing so nothing is counted twice.
  if (depreciation !== 0) investingItems.push({ kind: 'depreciation', accountCode: '', name: '', amount: flip(depreciation) })

  const operatingAll: CashFlowItem[] = [
    { kind: 'netProfit', accountCode: '', name: '', amount: netProfit },
    ...(depreciation !== 0 ? [{ kind: 'depreciation' as const, accountCode: '', name: '', amount: depreciation }] : []),
    ...operatingItems
  ]

  const section = (items: CashFlowItem[]): CashFlowSection => ({ items, total: sumCurrency(items.map((i) => i.amount)) })
  const operating = section(operatingAll)
  const investing = section(investingItems)
  const financing = section(financingItems)

  const netChange = roundCurrency(operating.total + investing.total + financing.total)
  const openingCash = sumCurrency(opening)
  const closingCash = roundCurrency(openingCash + netChange)
  const ledgerClosingCash = sumCurrency(ledgerClosing)

  return {
    dateFrom, dateTo, operating, investing, financing,
    netChange, openingCash, closingCash, ledgerClosingCash,
    reconciled: Math.abs(closingCash - ledgerClosingCash) < moneyEpsilon(),
    cashAccounts
  }
}

// ─── DB-backed entry points ──────────────────────────────────────────────────

async function loadAccounts(): Promise<AccountRef[]> {
  const db = getPrisma()
  return db.chartOfAccounts.findMany({
    orderBy: { accountCode: 'asc' },
    select: { id: true, accountCode: true, accountName: true, accountType: true, parentId: true }
  })
}

async function loadLedgerLines(upTo: Date): Promise<LedgerLine[]> {
  const db = getPrisma()
  const rows = await db.journalEntryLine.findMany({
    where: { journalEntry: { entryDate: { lte: upTo } } },
    select: { accountId: true, debitAmount: true, creditAmount: true, journalEntry: { select: { entryDate: true, sourceType: true } } }
  })
  return rows.map((r: { accountId: string; debitAmount: number; creditAmount: number; journalEntry: { entryDate: Date; sourceType: string } }) => ({
    accountId: r.accountId, debitAmount: r.debitAmount, creditAmount: r.creditAmount,
    entryDate: r.journalEntry.entryDate, sourceType: r.journalEntry.sourceType
  }))
}

async function generateBalanceSheet(params: { asOf: string; compareAsOf?: string }): Promise<BalanceSheetReport> {
  const asOf = parseLocalDateEnd(params.asOf)
  const compare = params.compareAsOf ? parseLocalDateEnd(params.compareAsOf) : null
  const latest = compare && compare.getTime() > asOf.getTime() ? compare : asOf
  const [accounts, lines] = await Promise.all([loadAccounts(), loadLedgerLines(latest)])
  return buildBalanceSheet(accounts, lines, asOf, compare, { asOf: params.asOf, compareAsOf: params.compareAsOf ?? null })
}

async function generateCashFlowStatement(params: { dateFrom: string; dateTo: string }): Promise<CashFlowStatementReport> {
  const [accounts, lines] = await Promise.all([loadAccounts(), loadLedgerLines(parseLocalDateEnd(params.dateTo))])
  return buildCashFlowStatement(accounts, lines, params.dateFrom, params.dateTo)
}

async function generateGeneralLedger(params: { accountId: string; dateFrom: string; dateTo: string }): Promise<GeneralLedgerReport | null> {
  const db = getPrisma()
  const to = parseLocalDateEnd(params.dateTo)
  const account = await db.chartOfAccounts.findUnique({ where: { id: params.accountId } })
  if (!account) return null
  const [rawLines, yeEntries] = await Promise.all([
    db.journalEntryLine.findMany({
      where: { accountId: params.accountId, journalEntry: { entryDate: { lte: to } } },
      select: {
        debitAmount: true, creditAmount: true, remarks: true,
        journalEntry: { select: { id: true, entryNumber: true, entryDate: true, narration: true, sourceType: true, sourceId: true, isReversed: true } }
      },
      orderBy: [{ journalEntry: { entryDate: 'asc' } }, { id: 'asc' }]
    }),
    db.journalEntry.findMany({ where: { sourceType: YEAR_END_SOURCE, entryDate: { lte: to } }, select: { entryDate: true } })
  ])

  const from = parseLocalDateStart(params.dateFrom).getTime()
  const inRange = (rawLines as RawLedgerLine[]).filter((l) => l.journalEntry.entryDate.getTime() >= from && l.journalEntry.sourceId)
  const refs = new Map<string, string>()
  const idsOf = (type: string) => [...new Set(inRange.filter((l) => l.journalEntry.sourceType === type).map((l) => l.journalEntry.sourceId as string))]
  const invoiceIds = idsOf('INVOICE')
  const billIds = idsOf('BILL')
  if (invoiceIds.length > 0) {
    const rows = await db.invoice.findMany({ where: { id: { in: invoiceIds } }, select: { id: true, invoiceNumber: true } })
    for (const r of rows as { id: string; invoiceNumber: string }[]) refs.set(`INVOICE:${r.id}`, r.invoiceNumber)
  }
  if (billIds.length > 0) {
    const rows = await db.bill.findMany({ where: { id: { in: billIds } }, select: { id: true, billNumber: true } })
    for (const r of rows as { id: string; billNumber: string }[]) refs.set(`BILL:${r.id}`, r.billNumber)
  }

  return buildGeneralLedger(account, rawLines as RawLedgerLine[], (yeEntries as { entryDate: Date }[]).map((e) => e.entryDate), params.dateFrom, params.dateTo, refs)
}

async function generateDayBook(params: { dateFrom: string; dateTo: string; voucherType?: VoucherType | 'ALL' }): Promise<DayBookReport> {
  const db = getPrisma()
  const type = params.voucherType ?? 'ALL'
  const where: Record<string, unknown> = { entryDate: { gte: parseLocalDateStart(params.dateFrom), lte: parseLocalDateEnd(params.dateTo) } }
  if (type === 'OTHER') where.sourceType = { notIn: ALL_MAPPED_SOURCES }
  else if (type !== 'ALL') where.sourceType = { in: VOUCHER_SOURCES[type] }
  const entries = await db.journalEntry.findMany({
    where,
    select: {
      id: true, entryNumber: true, entryDate: true, narration: true, sourceType: true, sourceId: true, isReversed: true,
      lines: { select: { debitAmount: true, creditAmount: true, account: { select: { accountCode: true, accountName: true } } } }
    },
    orderBy: { entryDate: 'asc' }
  })
  return buildDayBook(entries as RawEntry[], params.dateFrom, params.dateTo, type)
}

export const financialStatementsService = {
  generateBalanceSheet, generateGeneralLedger, generateDayBook, generateCashFlowStatement
}
