import { getPrisma } from '../database/db'
import { getCurrencyDecimals, sumMoney, prorateAmount, roundMoney, storedLineTaxable } from '../../shared/utils/money'
import { parseTaxComponents, splitTaxByComponents, type TaxComponent } from '../../shared/utils/tax-components'
import { parseLocalDateStart, parseLocalDateEnd, toLocalISODate } from '../utils/date.util'
import { classifyAccount, YEAR_END_SOURCE, financialStatementsService } from './financial-statements.service'
import type { CellValue, GenericReport, GenericReportDefinition, GenericReportParams } from './generic-report.types'
import { loadSalesLines } from './sales-lines.query'

// Reports read from the books: fund flow, bank book and reconciliation summary, ratios, year over year, and the
// credit note, debit note and sales return registers.

type Row = Record<string, CellValue>

async function decimalsOf(): Promise<number> {
  const profile = await getPrisma().businessProfile.findFirst({ select: { currencyCode: true } })
  return getCurrencyDecimals(profile?.currencyCode)
}

const pct = (part: number, whole: number) => (whole !== 0 ? prorateAmount(100, part, whole, 1) : 0)
const ratio = (part: number, whole: number, places = 2): number | null => (whole !== 0 ? prorateAmount(1, part, whole, places) : null)

// ── Fund flow ────────────────────────────────────────────────────────────────────────────────────────────
async function fundFlow(p: GenericReportParams): Promise<GenericReport> {
  const db = getPrisma()
  const decimals = await decimalsOf()
  const lines = await db.journalEntryLine.findMany({
    where: { journalEntry: { entryDate: { gte: parseLocalDateStart(p.dateFrom), lte: parseLocalDateEnd(p.dateTo) }, sourceType: { not: YEAR_END_SOURCE } } },
    select: { debitAmount: true, creditAmount: true, account: { select: { id: true, accountCode: true, accountName: true, accountType: true } } }
  })
  const net = new Map<string, { name: string; type: string; parts: number[]; cash: boolean }>()
  for (const l of lines) {
    const cash = classifyAccount(l.account) === 'CASH'
    const g = net.get(l.account.id) ?? { name: `${l.account.accountCode} ${l.account.accountName}`, type: l.account.accountType, parts: [], cash }
    g.parts.push(roundMoney(l.debitAmount - l.creditAmount, decimals))
    net.set(l.account.id, g)
  }
  const rows: Row[] = []
  const profitParts: number[] = []
  let cashChange = 0
  for (const g of net.values()) {
    const n = sumMoney(g.parts, decimals)
    if (g.cash) { cashChange = roundMoney(cashChange + n, decimals); continue }
    if (g.type === 'INCOME' || g.type === 'EXPENSE') { profitParts.push(-n); continue }
    if (n === 0) continue
    // An asset that grew, or a liability or equity that shrank, used funds; the opposite provided funds.
    const uses = n > 0
    rows.push({ item: g.name, source: uses ? null : Math.abs(n), application: uses ? Math.abs(n) : null })
  }
  const profit = sumMoney(profitParts, decimals)
  if (profit !== 0) rows.unshift({ item: 'fundFlow.netProfit', source: profit > 0 ? profit : null, application: profit < 0 ? -profit : null })
  const sources = sumMoney(rows.map((r) => Number(r.source ?? 0)), decimals)
  const applications = sumMoney(rows.map((r) => Number(r.application ?? 0)), decimals)
  return {
    id: 'fundFlow', dateFrom: p.dateFrom, dateTo: p.dateTo, decimals,
    summary: [
      { labelKey: 'fundFlow.sources', type: 'money', value: sources },
      { labelKey: 'fundFlow.applications', type: 'money', value: applications },
      { labelKey: 'fundFlow.cashChange', type: 'money', value: cashChange }
    ],
    columns: [
      { key: 'item', labelKey: 'fundFlow.item', type: 'text' },
      { key: 'source', labelKey: 'fundFlow.sources', type: 'money' },
      { key: 'application', labelKey: 'fundFlow.applications', type: 'money' }
    ],
    rows,
    totals: { item: '', source: sources, application: applications },
    chart: { type: 'bar', titleKey: 'fundFlow.chart', xKey: 'item', series: [{ key: 'source', labelKey: 'fundFlow.sources', money: true }, { key: 'application', labelKey: 'fundFlow.applications', money: true }], limit: 10 },
    notes: ['fundFlow.method']
  }
}

// ── Bank book and reconciliation summary ────────────────────────────────────────────────────────────────
async function bankBook(p: GenericReportParams): Promise<GenericReport> {
  const db = getPrisma()
  const decimals = await decimalsOf()
  const from = parseLocalDateStart(p.dateFrom)
  const to = parseLocalDateEnd(p.dateTo)
  const banks = await db.bankAccount.findMany({ where: { isActive: true }, select: { id: true, accountName: true }, orderBy: { accountName: 'asc' } })
  const [before, inPeriod] = await Promise.all([
    db.journalEntryLine.groupBy({ by: ['bankAccountId'], where: { bankAccountId: { not: null }, journalEntry: { entryDate: { lt: from } } }, _sum: { debitAmount: true, creditAmount: true } }),
    db.journalEntryLine.findMany({
      where: { bankAccountId: { not: null }, journalEntry: { entryDate: { gte: from, lte: to } } },
      select: { bankAccountId: true, debitAmount: true, creditAmount: true, journalEntry: { select: { entryDate: true, narration: true, entryNumber: true } } },
      orderBy: { journalEntry: { entryDate: 'asc' } }
    })
  ])
  const opening = new Map(before.map((b) => [b.bankAccountId as string, roundMoney((b._sum.debitAmount ?? 0) - (b._sum.creditAmount ?? 0), decimals)]))
  const rows: Row[] = []
  const closing: Row[] = []
  let deposits = 0
  let withdrawals = 0
  for (const bank of banks) {
    const mine = inPeriod.filter((l) => l.bankAccountId === bank.id)
    let balance = opening.get(bank.id) ?? 0
    if (mine.length === 0 && balance === 0) continue
    rows.push({ date: null, bank: bank.accountName, particulars: 'bankBook.opening', deposit: null, withdrawal: null, balance })
    for (const l of mine) {
      balance = roundMoney(balance + l.debitAmount - l.creditAmount, decimals)
      deposits = roundMoney(deposits + l.debitAmount, decimals)
      withdrawals = roundMoney(withdrawals + l.creditAmount, decimals)
      rows.push({ date: toLocalISODate(l.journalEntry.entryDate), bank: bank.accountName, particulars: l.journalEntry.narration ?? l.journalEntry.entryNumber, deposit: l.debitAmount || null, withdrawal: l.creditAmount || null, balance })
    }
    closing.push({ bank: bank.accountName, balance })
  }
  return {
    id: 'bankBook', dateFrom: p.dateFrom, dateTo: p.dateTo, decimals,
    summary: [
      { labelKey: 'bankBook.deposits', type: 'money', value: deposits },
      { labelKey: 'bankBook.withdrawals', type: 'money', value: withdrawals },
      { labelKey: 'bankBook.closing', type: 'money', value: sumMoney(closing.map((c) => Number(c.balance)), decimals) }
    ],
    columns: [
      { key: 'bank', labelKey: 'bankBook.bank', type: 'text' },
      { key: 'date', labelKey: 'bankBook.date', type: 'date' },
      { key: 'particulars', labelKey: 'bankBook.particulars', type: 'text' },
      { key: 'deposit', labelKey: 'bankBook.deposits', type: 'money' },
      { key: 'withdrawal', labelKey: 'bankBook.withdrawals', type: 'money' },
      { key: 'balance', labelKey: 'bankBook.balance', type: 'money' }
    ],
    rows,
    chart: { type: 'bar', titleKey: 'bankBook.chart', xKey: 'bank', series: [{ key: 'balance', labelKey: 'bankBook.balance', money: true }] },
    chartRows: closing,
    notes: ['bankBook.fromLedger']
  }
}

async function bankReconciliationSummary(p: GenericReportParams): Promise<GenericReport> {
  const db = getPrisma()
  const decimals = await decimalsOf()
  const banks = await db.bankAccount.findMany({ where: { isActive: true }, select: { id: true, accountName: true }, orderBy: { accountName: 'asc' } })
  const lines = await db.bankStatementLine.findMany({
    where: { transactionDate: { lte: parseLocalDateEnd(p.asOf ?? p.dateTo) } },
    select: { bankAccountId: true, debitAmount: true, creditAmount: true, reconciled: true, reconciledAt: true }
  })
  const rows: Row[] = banks.map((b) => {
    const mine = lines.filter((l) => l.bankAccountId === b.id)
    const open = mine.filter((l) => !l.reconciled)
    const last = mine.filter((l) => l.reconciledAt).map((l) => (l.reconciledAt as Date).getTime()).sort((a, c) => c - a)[0]
    return {
      bank: b.accountName, lines: mine.length, matched: mine.length - open.length, unmatched: open.length,
      unmatchedAmount: sumMoney(open.map((l) => l.debitAmount + l.creditAmount), decimals), lastReconciled: last ? toLocalISODate(new Date(last)) : null
    }
  }).filter((r) => Number(r.lines) > 0)
  const matched = rows.reduce((s, r) => s + Number(r.matched), 0)
  const unmatched = rows.reduce((s, r) => s + Number(r.unmatched), 0)
  return {
    id: 'bankReconciliationSummary', dateTo: p.asOf ?? p.dateTo, decimals,
    summary: [
      { labelKey: 'recon.matched', type: 'number', value: matched },
      { labelKey: 'recon.unmatched', type: 'number', value: unmatched },
      { labelKey: 'recon.unmatchedAmount', type: 'money', value: sumMoney(rows.map((r) => Number(r.unmatchedAmount)), decimals) }
    ],
    columns: [
      { key: 'bank', labelKey: 'bankBook.bank', type: 'text' },
      { key: 'lines', labelKey: 'recon.lines', type: 'number' },
      { key: 'matched', labelKey: 'recon.matched', type: 'number' },
      { key: 'unmatched', labelKey: 'recon.unmatched', type: 'number' },
      { key: 'unmatchedAmount', labelKey: 'recon.unmatchedAmount', type: 'money' },
      { key: 'lastReconciled', labelKey: 'recon.last', type: 'date' }
    ],
    rows,
    chart: { type: 'bar', titleKey: 'recon.chart', xKey: 'bank', series: [{ key: 'matched', labelKey: 'recon.matched' }, { key: 'unmatched', labelKey: 'recon.unmatched' }] },
    notes: ['recon.statementOnly']
  }
}

// ── Ratio analysis ──────────────────────────────────────────────────────────────────────────────────────
async function ratioAnalysis(p: GenericReportParams): Promise<GenericReport> {
  const db = getPrisma()
  const decimals = await decimalsOf()
  const asOf = p.asOf ?? p.dateTo
  const from = parseLocalDateStart(p.dateFrom)
  const to = parseLocalDateEnd(p.dateTo)
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000))
  const [sheet, plLines, bills] = await Promise.all([
    financialStatementsService.generateBalanceSheet({ asOf }),
    db.journalEntryLine.findMany({
      where: { journalEntry: { entryDate: { gte: from, lte: to }, sourceType: { not: YEAR_END_SOURCE } }, account: { accountType: { in: ['INCOME', 'EXPENSE'] } } },
      select: { debitAmount: true, creditAmount: true, account: { select: { accountCode: true, accountType: true } } }
    }),
    db.bill.findMany({ where: { billDate: { gte: from, lte: to }, status: { not: 'VOID' } }, select: { totalAmount: true } })
  ])
  const group = (key: string) => sheet.groups.find((g) => g.key === key)
  const rowAmount = (code: string) => sheet.groups.flatMap((g) => g.rows).find((r) => r.accountCode === code)?.amount ?? 0
  const currentAssets = group('currentAssets')?.total ?? 0
  const currentLiabilities = group('currentLiabilities')?.total ?? 0
  const inventory = rowAmount('1200')
  const receivables = rowAmount('1100')
  const payables = rowAmount('2000')
  const income = sumMoney(plLines.filter((l) => l.account.accountType === 'INCOME').map((l) => l.creditAmount - l.debitAmount), decimals)
  const cogs = sumMoney(plLines.filter((l) => l.account.accountCode === '5000').map((l) => l.debitAmount - l.creditAmount), decimals)
  const expense = sumMoney(plLines.filter((l) => l.account.accountType === 'EXPENSE').map((l) => l.debitAmount - l.creditAmount), decimals)
  const profit = roundMoney(income - expense, decimals)
  const purchases = sumMoney(bills.map((b) => b.totalAmount), decimals)
  const equity = roundMoney(sheet.totals.equity + sheet.totals.currentProfit, decimals)

  const list: Array<{ id: string; value: number | null; unit: 'times' | 'percent' | 'days' }> = [
    { id: 'current', value: ratio(currentAssets, currentLiabilities), unit: 'times' },
    { id: 'quick', value: ratio(roundMoney(currentAssets - inventory, decimals), currentLiabilities), unit: 'times' },
    { id: 'debtToEquity', value: ratio(sheet.totals.liabilities, equity), unit: 'times' },
    { id: 'grossMargin', value: income !== 0 ? pct(roundMoney(income - cogs, decimals), income) : null, unit: 'percent' },
    { id: 'netMargin', value: income !== 0 ? pct(profit, income) : null, unit: 'percent' },
    { id: 'debtorDays', value: income !== 0 ? prorateAmount(days, receivables, income, 0) : null, unit: 'days' },
    { id: 'creditorDays', value: purchases !== 0 ? prorateAmount(days, payables, purchases, 0) : null, unit: 'days' },
    { id: 'stockDays', value: cogs !== 0 ? prorateAmount(days, inventory, cogs, 0) : null, unit: 'days' }
  ]
  const rows: Row[] = list.map((r) => ({ ratio: `ratios.name.${r.id}`, value: r.value, unit: `ratios.unit.${r.unit}`, meaning: `ratios.meaning.${r.id}` }))
  return {
    id: 'ratioAnalysis', dateFrom: p.dateFrom, dateTo: p.dateTo, decimals,
    summary: [
      { labelKey: 'ratios.name.current', type: 'number', value: list[0].value },
      { labelKey: 'ratios.name.grossMargin', type: 'percent', value: list[3].value },
      { labelKey: 'ratios.name.netMargin', type: 'percent', value: list[4].value },
      { labelKey: 'ratios.name.debtorDays', type: 'number', value: list[5].value }
    ],
    columns: [
      { key: 'ratio', labelKey: 'ratios.ratio', type: 'label' },
      { key: 'value', labelKey: 'ratios.value', type: 'number' },
      { key: 'unit', labelKey: 'ratios.unitLabel', type: 'label' },
      { key: 'meaning', labelKey: 'ratios.meaningLabel', type: 'label' }
    ],
    rows,
    chart: { type: 'bar', titleKey: 'ratios.chart', xKey: 'name', series: [{ key: 'value', labelKey: 'ratios.value' }], xIsLabelKey: true },
    chartRows: list.filter((r) => r.unit === 'percent' && r.value !== null).map((r) => ({ name: `ratios.name.${r.id}`, value: r.value })),
    notes: ['ratios.method']
  }
}

// ── Year over year ───────────────────────────────────────────────────────────────────────────────────────
async function yearOverYear(p: GenericReportParams): Promise<GenericReport> {
  const db = getPrisma()
  const decimals = await decimalsOf()
  const shift = (iso: string) => `${Number(iso.slice(0, 4)) - 1}${iso.slice(4)}`
  const prev = { dateFrom: shift(p.dateFrom), dateTo: shift(p.dateTo) }
  const [thisSales, lastSales, thisBills, lastBills] = await Promise.all([
    loadSalesLines(p), loadSalesLines(prev),
    db.bill.findMany({ where: { billDate: { gte: parseLocalDateStart(p.dateFrom), lte: parseLocalDateEnd(p.dateTo) }, status: { not: 'VOID' } }, select: { billDate: true, subtotal: true, discountAmount: true } }),
    db.bill.findMany({ where: { billDate: { gte: parseLocalDateStart(prev.dateFrom), lte: parseLocalDateEnd(prev.dateTo) }, status: { not: 'VOID' } }, select: { billDate: true, subtotal: true, discountAmount: true } })
  ])
  const month = (iso: string) => iso.slice(5, 7)
  const bucket = new Map<string, { salesThis: number[]; salesLast: number[]; buyThis: number[]; buyLast: number[] }>()
  const slot = (m: string) => bucket.get(m) ?? bucket.set(m, { salesThis: [], salesLast: [], buyThis: [], buyLast: [] }).get(m)!
  for (const l of thisSales.lines) slot(month(l.date)).salesThis.push(l.taxable)
  for (const l of lastSales.lines) slot(month(l.date)).salesLast.push(l.taxable)
  for (const b of thisBills) slot(month(toLocalISODate(b.billDate))).buyThis.push(roundMoney(b.subtotal - b.discountAmount, decimals))
  for (const b of lastBills) slot(month(toLocalISODate(b.billDate))).buyLast.push(roundMoney(b.subtotal - b.discountAmount, decimals))
  const order = Array.from(bucket.keys()).sort((a, c) => ((Number(a) - Number(p.dateFrom.slice(5, 7)) + 12) % 12) - ((Number(c) - Number(p.dateFrom.slice(5, 7)) + 12) % 12))
  const rows: Row[] = order.map((m) => {
    const b = bucket.get(m)!
    const st = sumMoney(b.salesThis, decimals), sl = sumMoney(b.salesLast, decimals)
    return { month: m, salesThis: st, salesLast: sl, salesChange: sl !== 0 ? pct(roundMoney(st - sl, decimals), sl) : null, purchasesThis: sumMoney(b.buyThis, decimals), purchasesLast: sumMoney(b.buyLast, decimals) }
  })
  const sum = (k: string) => sumMoney(rows.map((r) => Number(r[k])), decimals)
  return {
    id: 'yearOverYear', dateFrom: p.dateFrom, dateTo: p.dateTo, decimals,
    summary: [
      { labelKey: 'yoy.salesThis', type: 'money', value: sum('salesThis') },
      { labelKey: 'yoy.salesLast', type: 'money', value: sum('salesLast') },
      { labelKey: 'yoy.salesChange', type: 'percent', value: sum('salesLast') !== 0 ? pct(roundMoney(sum('salesThis') - sum('salesLast'), decimals), sum('salesLast')) : null },
      { labelKey: 'yoy.purchasesThis', type: 'money', value: sum('purchasesThis') }
    ],
    columns: [
      { key: 'month', labelKey: 'yoy.month', type: 'text' },
      { key: 'salesThis', labelKey: 'yoy.salesThis', type: 'money' },
      { key: 'salesLast', labelKey: 'yoy.salesLast', type: 'money' },
      { key: 'salesChange', labelKey: 'yoy.salesChange', type: 'percent' },
      { key: 'purchasesThis', labelKey: 'yoy.purchasesThis', type: 'money' },
      { key: 'purchasesLast', labelKey: 'yoy.purchasesLast', type: 'money' }
    ],
    rows,
    totals: { month: '', salesThis: sum('salesThis'), salesLast: sum('salesLast'), salesChange: sum('salesLast') !== 0 ? pct(roundMoney(sum('salesThis') - sum('salesLast'), decimals), sum('salesLast')) : null, purchasesThis: sum('purchasesThis'), purchasesLast: sum('purchasesLast') },
    chart: { type: 'line', titleKey: 'yoy.chart', xKey: 'month', series: [{ key: 'salesThis', labelKey: 'yoy.salesThis', money: true }, { key: 'salesLast', labelKey: 'yoy.salesLast', money: true }] },
    notes: ['yoy.method']
  }
}

// ── Note and return registers ──────────────────────────────────────────────────────────────────────────
function monthCounts(rows: Row[]): Row[] {
  const map = new Map<string, number>()
  for (const r of rows) map.set(String(r.date).slice(0, 7), (map.get(String(r.date).slice(0, 7)) ?? 0) + 1)
  return Array.from(map.entries()).map(([month, count]) => ({ month, count }))
}

function noteRegister(id: string, kind: 'credit' | 'debit') {
  return async (p: GenericReportParams): Promise<GenericReport> => {
    const db = getPrisma()
    const decimals = await decimalsOf()
    const range = { gte: parseLocalDateStart(p.dateFrom), lte: parseLocalDateEnd(p.dateTo) }
    const notes = kind === 'credit'
      ? (await db.creditNote.findMany({ where: { createdAt: range }, select: { creditNoteNumber: true, createdAt: true, amount: true, taxAmount: true, reason: true, customer: { select: { customerName: true } } }, orderBy: { createdAt: 'asc' } }))
          .map((n) => ({ number: n.creditNoteNumber, date: toLocalISODate(n.createdAt), party: n.customer?.customerName ?? '', reason: n.reason, tax: n.taxAmount, amount: n.amount }))
      : (await db.debitNote.findMany({ where: { createdAt: range }, select: { debitNoteNumber: true, createdAt: true, amount: true, taxAmount: true, reason: true, supplier: { select: { supplierName: true } } }, orderBy: { createdAt: 'asc' } }))
          .map((n) => ({ number: n.debitNoteNumber, date: toLocalISODate(n.createdAt), party: n.supplier?.supplierName ?? '', reason: n.reason, tax: n.taxAmount, amount: n.amount }))
    const rows: Row[] = notes
    return {
      id, dateFrom: p.dateFrom, dateTo: p.dateTo, decimals,
      summary: [
        { labelKey: 'notes.count', type: 'number', value: rows.length },
        { labelKey: 'notes.tax', type: 'money', value: sumMoney(rows.map((r) => Number(r.tax)), decimals) },
        { labelKey: 'notes.amount', type: 'money', value: sumMoney(rows.map((r) => Number(r.amount)), decimals) }
      ],
      columns: [
        { key: 'date', labelKey: 'notes.date', type: 'date' },
        { key: 'number', labelKey: `notes.number.${kind}`, type: 'text' },
        { key: 'party', labelKey: `notes.party.${kind}`, type: 'text' },
        { key: 'reason', labelKey: 'notes.reason', type: 'text' },
        { key: 'tax', labelKey: 'notes.tax', type: 'money' },
        { key: 'amount', labelKey: 'notes.amount', type: 'money' }
      ],
      rows,
      totals: { date: null, number: '', party: '', reason: '', tax: sumMoney(rows.map((r) => Number(r.tax)), decimals), amount: sumMoney(rows.map((r) => Number(r.amount)), decimals) },
      chart: { type: 'bar', titleKey: 'notes.chart', xKey: 'month', series: [{ key: 'count', labelKey: 'notes.count' }] },
      chartRows: monthCounts(rows),
      notes: []
    }
  }
}

async function salesReturnRegister(p: GenericReportParams): Promise<GenericReport> {
  const db = getPrisma()
  const decimals = await decimalsOf()
  const returns = await db.invoice.findMany({
    where: { invoiceType: 'RETURN', invoiceDate: { gte: parseLocalDateStart(p.dateFrom), lte: parseLocalDateEnd(p.dateTo) }, status: { notIn: ['CANCELLED', 'SPLIT'] } },
    select: { invoiceNumber: true, invoiceDate: true, taxAmount: true, totalAmount: true, customer: { select: { customerName: true } }, originalInvoice: { select: { invoiceNumber: true } } },
    orderBy: { invoiceDate: 'asc' }
  })
  const rows: Row[] = returns.map((r) => ({ date: toLocalISODate(r.invoiceDate), number: r.invoiceNumber, original: r.originalInvoice?.invoiceNumber ?? '', party: r.customer?.customerName ?? '', tax: Math.abs(r.taxAmount), amount: Math.abs(r.totalAmount) }))
  return {
    id: 'salesReturnRegister', dateFrom: p.dateFrom, dateTo: p.dateTo, decimals,
    summary: [
      { labelKey: 'notes.count', type: 'number', value: rows.length },
      { labelKey: 'notes.tax', type: 'money', value: sumMoney(rows.map((r) => Number(r.tax)), decimals) },
      { labelKey: 'notes.amount', type: 'money', value: sumMoney(rows.map((r) => Number(r.amount)), decimals) }
    ],
    columns: [
      { key: 'date', labelKey: 'notes.date', type: 'date' },
      { key: 'number', labelKey: 'notes.number.return', type: 'text' },
      { key: 'original', labelKey: 'notes.original', type: 'text' },
      { key: 'party', labelKey: 'notes.party.credit', type: 'text' },
      { key: 'tax', labelKey: 'notes.tax', type: 'money' },
      { key: 'amount', labelKey: 'notes.amount', type: 'money' }
    ],
    rows,
    totals: { date: null, number: '', original: '', party: '', tax: sumMoney(rows.map((r) => Number(r.tax)), decimals), amount: sumMoney(rows.map((r) => Number(r.amount)), decimals) },
    chart: { type: 'bar', titleKey: 'notes.chart', xKey: 'month', series: [{ key: 'count', labelKey: 'notes.count' }] },
    chartRows: monthCounts(rows),
    notes: []
  }
}

// ── Tax by part (for rates split into named parts, e.g. GST + PST) ───────────────────────────────────────
async function taxByPart(p: GenericReportParams): Promise<GenericReport> {
  const db = getPrisma()
  const decimals = await decimalsOf()
  const from = parseLocalDateStart(p.dateFrom)
  const to = parseLocalDateEnd(p.dateTo)
  const configs = await db.taxConfiguration.findMany({ where: { isActive: true, components: { not: null } }, select: { rate: true, components: true, isDefault: true } })
  const partsByRate = new Map<number, TaxComponent[]>()
  for (const c of [...configs].sort((a, b) => Number(b.isDefault) - Number(a.isDefault))) {
    const key = Math.round(c.rate * 10000) / 10000
    const parts = parseTaxComponents(c.components)
    if (parts.length >= 2 && !partsByRate.has(key)) partsByRate.set(key, parts)
  }
  const [invoices, bills] = await Promise.all([
    db.invoice.findMany({
      where: { invoiceDate: { gte: from, lte: to }, status: { notIn: ['CANCELLED', 'SPLIT'] } },
      select: { invoiceType: true, pricesIncludeTax: true, items: { select: { quantity: true, unitPrice: true, discountAmount: true, taxAmount: true, lineTotal: true, taxRate: true } } }
    }),
    db.bill.findMany({ where: { billDate: { gte: from, lte: to }, status: { not: 'VOID' } }, select: { items: { select: { taxRate: true, taxAmount: true, total: true } } } })
  ])
  // rate -> signed taxable values and tax amounts
  const sales = new Map<number, { taxable: number[]; tax: number[] }>()
  const purchases = new Map<number, { taxable: number[]; tax: number[] }>()
  const add = (m: Map<number, { taxable: number[]; tax: number[] }>, rate: number, taxable: number, tax: number) => {
    const key = Math.round(rate * 10000) / 10000
    const g = m.get(key) ?? { taxable: [], tax: [] }
    g.taxable.push(taxable); g.tax.push(tax)
    m.set(key, g)
  }
  for (const inv of invoices) {
    const isReturn = inv.invoiceType === 'RETURN'
    const sign = isReturn ? -1 : 1
    for (const it of inv.items) add(sales, it.taxRate, sign * storedLineTaxable(it, { pricesIncludeTax: inv.pricesIncludeTax, isReturn }), sign * Math.abs(it.taxAmount))
  }
  for (const bl of bills) for (const it of bl.items) add(purchases, it.taxRate, roundMoney(it.total - it.taxAmount, decimals), it.taxAmount)

  // part name + its rate -> totals
  const rows = new Map<string, { part: string; rate: number; salesTaxable: number[]; salesTax: number[]; purchaseTax: number[] }>()
  const bucket = (part: string, rate: number) => {
    const key = `${part}|${rate}`
    const r = rows.get(key) ?? { part, rate, salesTaxable: [], salesTax: [], purchaseTax: [] }
    rows.set(key, r)
    return r
  }
  for (const [rate, g] of sales) {
    const parts = partsByRate.get(rate)
    const tax = sumMoney(g.tax, decimals)
    const taxable = sumMoney(g.taxable, decimals)
    if (!parts) { const r = bucket('', rate); r.salesTaxable.push(taxable); r.salesTax.push(tax); continue }
    for (const x of splitTaxByComponents(tax, parts, decimals)) { const r = bucket(x.name, x.rate); r.salesTaxable.push(taxable); r.salesTax.push(x.amount) }
  }
  for (const [rate, g] of purchases) {
    const parts = partsByRate.get(rate)
    const tax = sumMoney(g.tax, decimals)
    if (!parts) { bucket('', rate).purchaseTax.push(tax); continue }
    for (const x of splitTaxByComponents(tax, parts, decimals)) bucket(x.name, x.rate).purchaseTax.push(x.amount)
  }
  const out: Row[] = [...rows.values()]
    .filter((r) => r.salesTax.length + r.purchaseTax.length > 0)
    .sort((a, b) => (a.part === '' ? 1 : b.part === '' ? -1 : a.part.localeCompare(b.part)) || a.rate - b.rate)
    .map((r) => {
      const st = sumMoney(r.salesTax, decimals)
      const pt = sumMoney(r.purchaseTax, decimals)
      return { part: r.part, rate: r.rate, salesTaxable: sumMoney(r.salesTaxable, decimals), salesTax: st, purchaseTax: pt, net: roundMoney(st - pt, decimals) }
    })
  const sum = (k: string) => sumMoney(out.map((r) => Number(r[k])), decimals)
  return {
    id: 'taxByPart', dateFrom: p.dateFrom, dateTo: p.dateTo, decimals,
    summary: [
      { labelKey: 'taxByPart.salesTax', type: 'money', value: sum('salesTax') },
      { labelKey: 'taxByPart.purchaseTax', type: 'money', value: sum('purchaseTax') },
      { labelKey: 'taxByPart.net', type: 'money', value: sum('net') }
    ],
    columns: [
      { key: 'part', labelKey: 'taxByPart.part', type: 'text' },
      { key: 'rate', labelKey: 'taxByPart.rate', type: 'percent' },
      { key: 'salesTaxable', labelKey: 'taxByPart.salesTaxable', type: 'money' },
      { key: 'salesTax', labelKey: 'taxByPart.salesTax', type: 'money' },
      { key: 'purchaseTax', labelKey: 'taxByPart.purchaseTax', type: 'money' },
      { key: 'net', labelKey: 'taxByPart.net', type: 'money' }
    ],
    rows: out,
    totals: { part: '', rate: null, salesTaxable: null, salesTax: sum('salesTax'), purchaseTax: sum('purchaseTax'), net: sum('net') },
    chart: { type: 'bar', titleKey: 'taxByPart.chart', xKey: 'part', series: [{ key: 'salesTax', labelKey: 'taxByPart.salesTax', money: true }, { key: 'purchaseTax', labelKey: 'taxByPart.purchaseTax', money: true }], limit: 12 },
    notes: ['taxByPart.note']
  }
}

// ── TDS receivable (tax customers kept back) ─────────────────────────────────────────────────────────────
async function tdsReceivable(p: GenericReportParams): Promise<GenericReport> {
  const db = getPrisma()
  const decimals = await decimalsOf()
  const payments = await db.payment.findMany({
    where: { paymentMethod: 'TDS', isReversed: false, paymentDate: { gte: parseLocalDateStart(p.dateFrom), lte: parseLocalDateEnd(p.dateTo) } },
    include: { invoice: { select: { invoiceNumber: true } }, customer: { select: { customerName: true, taxNumber: true } } },
    orderBy: { paymentDate: 'asc' }
  })
  const rows: Row[] = payments.map((x) => ({
    date: toLocalISODate(x.paymentDate), customer: x.customer?.customerName ?? '', taxNumber: x.customer?.taxNumber ?? '',
    invoice: x.invoice?.invoiceNumber ?? '', reference: x.referenceNumber ?? '', amount: x.amount
  }))
  const total = sumMoney(rows.map((r) => Number(r.amount)), decimals)
  const byCustomer = new Map<string, number[]>()
  for (const r of rows) { const k = String(r.customer); byCustomer.set(k, [...(byCustomer.get(k) ?? []), Number(r.amount)]) }
  const chartRows: Row[] = [...byCustomer.entries()].map(([customer, v]) => ({ customer, amount: sumMoney(v, decimals) })).sort((a, b) => Number(b.amount) - Number(a.amount))
  return {
    id: 'tdsReceivable', dateFrom: p.dateFrom, dateTo: p.dateTo, decimals,
    summary: [
      { labelKey: 'tdsReceivable.total', type: 'money', value: total },
      { labelKey: 'tdsReceivable.entries', type: 'number', value: rows.length },
      { labelKey: 'tdsReceivable.customers', type: 'number', value: byCustomer.size }
    ],
    columns: [
      { key: 'date', labelKey: 'tdsReceivable.date', type: 'date' },
      { key: 'customer', labelKey: 'tdsReceivable.customer', type: 'text' },
      { key: 'taxNumber', labelKey: 'tdsReceivable.taxNumber', type: 'text' },
      { key: 'invoice', labelKey: 'tdsReceivable.invoice', type: 'text' },
      { key: 'reference', labelKey: 'tdsReceivable.reference', type: 'text' },
      { key: 'amount', labelKey: 'tdsReceivable.amount', type: 'money' }
    ],
    rows,
    totals: { date: null, customer: '', taxNumber: '', invoice: '', reference: '', amount: total },
    chart: { type: 'bar', titleKey: 'tdsReceivable.chart', xKey: 'customer', series: [{ key: 'amount', labelKey: 'tdsReceivable.amount', money: true }], limit: 10 },
    chartRows,
    notes: ['tdsReceivable.note']
  }
}

// ── Profit by cost category ───────────────────────────────────────────────────────────────────────────
async function costCategoryProfit(p: GenericReportParams): Promise<GenericReport> {
  const db = getPrisma()
  const decimals = await decimalsOf()
  const [centres, lines] = await Promise.all([
    db.costCentre.findMany({ select: { id: true, category: true } }),
    db.journalEntryLine.findMany({
      where: { journalEntry: { entryDate: { gte: parseLocalDateStart(p.dateFrom), lte: parseLocalDateEnd(p.dateTo) } } },
      select: { costCentreId: true, debitAmount: true, creditAmount: true, account: { select: { accountType: true } } }
    })
  ])
  const categoryOf = new Map(centres.map((c) => [c.id, c.category?.trim() || '']))
  const revenue = new Map<string, number[]>()
  const expense = new Map<string, number[]>()
  const push = (m: Map<string, number[]>, k: string, v: number) => { const a = m.get(k) ?? []; a.push(v); m.set(k, a) }
  for (const l of lines) {
    const cat = l.costCentreId ? (categoryOf.get(l.costCentreId) ?? '') : ''
    if (l.account.accountType === 'INCOME') push(revenue, cat, l.creditAmount - l.debitAmount)
    else if (l.account.accountType === 'EXPENSE') push(expense, cat, l.debitAmount - l.creditAmount)
  }
  const names = Array.from(new Set([...revenue.keys(), ...expense.keys()])).sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)))
  const rows: Row[] = names.map((n) => {
    const rev = sumMoney(revenue.get(n) ?? [], decimals)
    const exp = sumMoney(expense.get(n) ?? [], decimals)
    return { category: n, revenue: rev, expense: exp, profit: roundMoney(rev - exp, decimals) }
  })
  const sum = (k: string) => sumMoney(rows.map((r) => Number(r[k])), decimals)
  return {
    id: 'costCategoryProfit', dateFrom: p.dateFrom, dateTo: p.dateTo, decimals,
    summary: [
      { labelKey: 'costCategory.revenue', type: 'money', value: sum('revenue') },
      { labelKey: 'costCategory.expense', type: 'money', value: sum('expense') },
      { labelKey: 'costCategory.profit', type: 'money', value: sum('profit') }
    ],
    columns: [
      { key: 'category', labelKey: 'costCategory.category', type: 'text' },
      { key: 'revenue', labelKey: 'costCategory.revenue', type: 'money' },
      { key: 'expense', labelKey: 'costCategory.expense', type: 'money' },
      { key: 'profit', labelKey: 'costCategory.profit', type: 'money' }
    ],
    rows,
    totals: { category: '', revenue: sum('revenue'), expense: sum('expense'), profit: sum('profit') },
    chart: { type: 'bar', titleKey: 'costCategory.chart', xKey: 'category', series: [{ key: 'revenue', labelKey: 'costCategory.revenue', money: true }, { key: 'expense', labelKey: 'costCategory.expense', money: true }], limit: 12 },
    notes: ['costCategory.note']
  }
}

export const BOOKS_REPORTS: Record<string, GenericReportDefinition> = {
  taxByPart: { permission: 'reports.financial', run: taxByPart },
  tdsReceivable: { permission: 'reports.financial', run: tdsReceivable },
  costCategoryProfit: { permission: 'analytics.viewProfit', run: costCategoryProfit },
  fundFlow: { permission: 'analytics.viewProfit', run: fundFlow },
  bankBook: { permission: 'reports.financial', run: bankBook },
  bankReconciliationSummary: { permission: 'reports.financial', run: bankReconciliationSummary },
  ratioAnalysis: { permission: 'analytics.viewProfit', run: ratioAnalysis },
  yearOverYear: { permission: 'reports.sales', run: yearOverYear },
  creditNoteRegister: { permission: 'reports.invoices', run: noteRegister('creditNoteRegister', 'credit') },
  debitNoteRegister: { permission: 'reports.financial', run: noteRegister('debitNoteRegister', 'debit') },
  salesReturnRegister: { permission: 'reports.invoices', run: salesReturnRegister }
}

