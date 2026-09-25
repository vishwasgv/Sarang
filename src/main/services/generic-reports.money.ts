import { getPrisma } from '../database/db'
import { getCurrencyDecimals, sumMoney, prorateAmount, roundMoney } from '../../shared/utils/money'
import { parseLocalDateStart, parseLocalDateEnd, toLocalISODate, addLocalDays, startOfLocalDay } from '../utils/date.util'
import { getProductCostsBatch } from './valuation.service'
import type { CellValue, GenericReport, GenericReportDefinition, GenericReportParams } from './generic-report.types'
import { loadSalesLines } from './sales-lines.query'

// Profit, receivables, payables, registers, expenses and the fixed asset register.

type Row = Record<string, CellValue>

async function decimalsOf(): Promise<number> {
  const profile = await getPrisma().businessProfile.findFirst({ select: { currencyCode: true } })
  return getCurrencyDecimals(profile?.currencyCode)
}

const pct = (part: number, whole: number) => (whole !== 0 ? prorateAmount(100, part, whole, 1) : 0)
const dayStart = (iso: string) => parseLocalDateStart(iso)

// ── Profit by item / customer ──────────────────────────────────────────────────────────────────────
function profitBy(id: string, dimension: 'item' | 'customer') {
  return async (p: GenericReportParams): Promise<GenericReport> => {
    const { lines, decimals } = await loadSalesLines(p)
    const costs = await getProductCostsBatch(lines.map((l) => l.productId))
    const map = new Map<string, { name: string; qty: number[]; revenue: number[]; cost: number[] }>()
    for (const l of lines) {
      const key = dimension === 'item' ? l.productId : l.customerId ?? ''
      const g = map.get(key) ?? { name: dimension === 'item' ? l.productName : l.customerName, qty: [], revenue: [], cost: [] }
      g.qty.push(l.quantity)
      g.revenue.push(l.taxable)
      // Stock is costed at today's cost; the sale-time cost is not stored on the invoice line.
      g.cost.push(prorateAmount(costs.get(l.productId) ?? 0, l.quantity, 1, decimals))
      map.set(key, g)
    }
    const rows: Row[] = Array.from(map.values()).map((g) => {
      const revenue = sumMoney(g.revenue, decimals)
      const cost = sumMoney(g.cost, decimals)
      const profit = roundMoney(revenue - cost, decimals)
      return { name: g.name, quantity: sumMoney(g.qty, 3), revenue, cost, profit, margin: pct(profit, revenue) }
    }).sort((a, b) => Number(b.profit) - Number(a.profit))
    const revenue = sumMoney(rows.map((r) => Number(r.revenue)), decimals)
    const cost = sumMoney(rows.map((r) => Number(r.cost)), decimals)
    const profit = roundMoney(revenue - cost, decimals)
    return {
      id, dateFrom: p.dateFrom, dateTo: p.dateTo, decimals,
      summary: [
        { labelKey: 'profit.revenue', type: 'money', value: revenue },
        { labelKey: 'profit.cost', type: 'money', value: cost },
        { labelKey: 'profit.profit', type: 'money', value: profit },
        { labelKey: 'profit.margin', type: 'percent', value: pct(profit, revenue) }
      ],
      columns: [
        { key: 'name', labelKey: `profit.name.${dimension}`, type: 'text' },
        { key: 'quantity', labelKey: 'profit.quantity', type: 'number' },
        { key: 'revenue', labelKey: 'profit.revenue', type: 'money' },
        { key: 'cost', labelKey: 'profit.cost', type: 'money' },
        { key: 'profit', labelKey: 'profit.profit', type: 'money' },
        { key: 'margin', labelKey: 'profit.margin', type: 'percent' }
      ],
      rows,
      totals: { name: '', quantity: sumMoney(rows.map((r) => Number(r.quantity)), 3), revenue, cost, profit, margin: pct(profit, revenue) },
      chart: { type: 'bar', titleKey: `profit.chart.${dimension}`, xKey: 'name', series: [{ key: 'profit', labelKey: 'profit.profit', money: true }], limit: 10 },
      notes: ['profit.currentCost', 'profit.returnsNetted']
    }
  }
}

// ── Receivables / payables summaries ───────────────────────────────────────────────────────────────────
function openBalances(id: string, side: 'receivable' | 'payable') {
  return async (p: GenericReportParams): Promise<GenericReport> => {
    const db = getPrisma()
    const decimals = await decimalsOf()
    const asOf = p.asOf ?? p.dateTo
    const today = dayStart(asOf)
    const weekEnd = addLocalDays(today, 7)
    const raw = side === 'receivable'
      ? (await db.invoice.findMany({
          where: { balanceAmount: { gt: 0 }, status: { notIn: ['CANCELLED', 'SPLIT'] }, invoiceDate: { lte: parseLocalDateEnd(asOf) } },
          select: { id: true, customerId: true, customer: { select: { customerName: true } }, balanceAmount: true, dueDate: true, invoiceDate: true }
        })).map((i) => ({ key: i.customerId ?? '', name: i.customer?.customerName ?? '', balance: i.balanceAmount, due: i.dueDate ?? i.invoiceDate }))
      : (await db.bill.findMany({
          where: { balanceAmount: { gt: 0 }, status: { not: 'VOID' }, billDate: { lte: parseLocalDateEnd(asOf) } },
          select: { id: true, supplierId: true, supplier: { select: { supplierName: true } }, balanceAmount: true, dueDate: true, billDate: true }
        })).map((b) => ({ key: b.supplierId, name: b.supplier.supplierName, balance: b.balanceAmount, due: b.dueDate ?? b.billDate }))

    const map = new Map<string, { name: string; count: number; balance: number[]; overdue: number[]; week: number[]; oldest: number }>()
    for (const r of raw) {
      const g = map.get(r.key) ?? { name: r.name, count: 0, balance: [], overdue: [], week: [], oldest: 0 }
      g.count += 1
      g.balance.push(r.balance)
      const due = startOfLocalDay(r.due)
      const daysLate = Math.round((today.getTime() - due.getTime()) / 86400000)
      if (due < today) g.overdue.push(r.balance)
      else if (due < weekEnd) g.week.push(r.balance)
      if (daysLate > g.oldest) g.oldest = daysLate
      map.set(r.key, g)
    }
    const rows: Row[] = Array.from(map.values()).map((g) => ({
      name: g.name, documents: g.count, balance: sumMoney(g.balance, decimals), overdue: sumMoney(g.overdue, decimals),
      dueThisWeek: sumMoney(g.week, decimals), oldestDays: g.oldest
    })).sort((a, b) => Number(b.balance) - Number(a.balance))
    const total = sumMoney(rows.map((r) => Number(r.balance)), decimals)
    const overdue = sumMoney(rows.map((r) => Number(r.overdue)), decimals)
    const week = sumMoney(rows.map((r) => Number(r.dueThisWeek)), decimals)
    return {
      id, dateTo: asOf, decimals,
      summary: [
        { labelKey: `open.total.${side}`, type: 'money', value: total },
        { labelKey: 'open.overdue', type: 'money', value: overdue },
        { labelKey: 'open.dueThisWeek', type: 'money', value: week },
        { labelKey: `open.parties.${side}`, type: 'number', value: rows.length }
      ],
      columns: [
        { key: 'name', labelKey: `open.name.${side}`, type: 'text' },
        { key: 'documents', labelKey: `open.documents.${side}`, type: 'number' },
        { key: 'balance', labelKey: 'open.balance', type: 'money' },
        { key: 'overdue', labelKey: 'open.overdue', type: 'money' },
        { key: 'dueThisWeek', labelKey: 'open.dueThisWeek', type: 'money' },
        { key: 'oldestDays', labelKey: 'open.oldestDays', type: 'number' }
      ],
      rows,
      totals: { name: '', documents: rows.reduce((s, r) => s + Number(r.documents), 0), balance: total, overdue, dueThisWeek: week, oldestDays: null },
      chart: { type: 'bar', titleKey: `open.chart.${side}`, xKey: 'name', series: [{ key: 'balance', labelKey: 'open.balance', money: true }, { key: 'overdue', labelKey: 'open.overdue', money: true }], limit: 10 },
      notes: ['open.dueDateNote']
    }
  }
}

// ── Registers ───────────────────────────────────────────────────────────────────────────────────────────
async function salesRegister(p: GenericReportParams): Promise<GenericReport> {
  const db = getPrisma()
  const decimals = await decimalsOf()
  const invoices = await db.invoice.findMany({
    where: { invoiceDate: { gte: dayStart(p.dateFrom), lte: parseLocalDateEnd(p.dateTo) }, status: { notIn: ['CANCELLED', 'SPLIT'] } },
    select: { invoiceNumber: true, invoiceDate: true, invoiceType: true, subtotal: true, taxAmount: true, totalAmount: true, paidAmount: true, paymentStatus: true, customer: { select: { customerName: true, taxNumber: true } } },
    orderBy: [{ invoiceDate: 'asc' }, { invoiceNumber: 'asc' }]
  })
  const rows: Row[] = invoices.map((i) => {
    const sign = i.invoiceType === 'RETURN' ? -1 : 1
    return {
      date: toLocalISODate(i.invoiceDate), number: i.invoiceNumber, customer: i.customer?.customerName ?? '', gstin: i.customer?.taxNumber ?? '',
      subtotal: sign * Math.abs(i.subtotal), tax: sign * Math.abs(i.taxAmount), total: sign * Math.abs(i.totalAmount), paymentStatus: i.paymentStatus
    }
  })
  const total = sumMoney(rows.map((r) => Number(r.total)), decimals)
  return {
    id: 'salesRegister', dateFrom: p.dateFrom, dateTo: p.dateTo, decimals,
    summary: [
      { labelKey: 'register.documents', type: 'number', value: rows.length },
      { labelKey: 'register.subtotal', type: 'money', value: sumMoney(rows.map((r) => Number(r.subtotal)), decimals) },
      { labelKey: 'register.tax', type: 'money', value: sumMoney(rows.map((r) => Number(r.tax)), decimals) },
      { labelKey: 'register.total', type: 'money', value: total }
    ],
    columns: [
      { key: 'date', labelKey: 'register.date', type: 'date' },
      { key: 'number', labelKey: 'register.number', type: 'text' },
      { key: 'customer', labelKey: 'register.customer', type: 'text' },
      { key: 'gstin', labelKey: 'register.taxNumber', type: 'text' },
      { key: 'subtotal', labelKey: 'register.subtotal', type: 'money' },
      { key: 'tax', labelKey: 'register.tax', type: 'money' },
      { key: 'total', labelKey: 'register.total', type: 'money' },
      { key: 'paymentStatus', labelKey: 'register.paymentStatus', type: 'text' }
    ],
    rows,
    totals: { date: null, number: '', customer: '', gstin: '', subtotal: sumMoney(rows.map((r) => Number(r.subtotal)), decimals), tax: sumMoney(rows.map((r) => Number(r.tax)), decimals), total, paymentStatus: '' },
    chart: { type: 'line', titleKey: 'register.chart.sales', xKey: 'date', series: [{ key: 'total', labelKey: 'register.total', money: true }] },
    notes: ['register.returnsNegative']
  }
}

// ── Expenses ────────────────────────────────────────────────────────────────────────────────────────────
function expensesBy(id: string, dimension: 'category' | 'vendor') {
  return async (p: GenericReportParams): Promise<GenericReport> => {
    const db = getPrisma()
    const decimals = await decimalsOf()
    const expenses = await db.expense.findMany({
      where: { expenseDate: { gte: dayStart(p.dateFrom), lte: parseLocalDateEnd(p.dateTo) } },
      select: { amount: true, categoryId: true, category: { select: { categoryName: true } }, supplierId: true, supplier: { select: { supplierName: true } } }
    })
    const map = new Map<string, { name: string; count: number; amounts: number[] }>()
    for (const e of expenses) {
      const key = dimension === 'category' ? e.categoryId : e.supplierId ?? ''
      const g = map.get(key) ?? { name: dimension === 'category' ? e.category.categoryName : e.supplier?.supplierName ?? '', count: 0, amounts: [] }
      g.count += 1
      g.amounts.push(e.amount)
      map.set(key, g)
    }
    const total = sumMoney(expenses.map((e) => e.amount), decimals)
    const rows: Row[] = Array.from(map.values())
      .map((g) => ({ name: g.name, count: g.count, amount: sumMoney(g.amounts, decimals) }))
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .map((r) => ({ ...r, share: pct(Number(r.amount), total) }))
    return {
      id, dateFrom: p.dateFrom, dateTo: p.dateTo, decimals,
      summary: [
        { labelKey: 'expenses.total', type: 'money', value: total },
        { labelKey: `expenses.count.${dimension}`, type: 'number', value: rows.length },
        { labelKey: 'expenses.entries', type: 'number', value: expenses.length }
      ],
      columns: [
        { key: 'name', labelKey: `expenses.name.${dimension}`, type: 'text' },
        { key: 'count', labelKey: 'expenses.entries', type: 'number' },
        { key: 'amount', labelKey: 'expenses.amount', type: 'money' },
        { key: 'share', labelKey: 'expenses.share', type: 'percent' }
      ],
      rows,
      totals: { name: '', count: expenses.length, amount: total, share: rows.length > 0 ? 100 : 0 },
      chart: { type: dimension === 'category' ? 'pie' : 'bar', titleKey: `expenses.chart.${dimension}`, xKey: 'name', series: [{ key: 'amount', labelKey: 'expenses.amount', money: true }], limit: 10 },
      notes: dimension === 'vendor' ? ['expenses.vendorNote'] : []
    }
  }
}

// ── Fixed asset register ───────────────────────────────────────────────────────────────────────────────
async function fixedAssetRegister(p: GenericReportParams): Promise<GenericReport> {
  const db = getPrisma()
  const decimals = await decimalsOf()
  const assets = await db.fixedAsset.findMany({ orderBy: [{ category: 'asc' }, { purchaseDate: 'asc' }] })
  const rows: Row[] = assets.map((a) => ({
    code: a.assetCode, name: a.assetName, category: a.category ?? '', purchaseDate: toLocalISODate(a.purchaseDate), status: a.status,
    cost: a.purchaseCost, depreciation: a.accumulatedDepreciation, bookValue: roundMoney(a.purchaseCost - a.accumulatedDepreciation, decimals)
  }))
  const sum = (k: string) => sumMoney(rows.map((r) => Number(r[k])), decimals)
  return {
    id: 'fixedAssetRegister', dateTo: p.asOf ?? p.dateTo, decimals,
    summary: [
      { labelKey: 'assets.count', type: 'number', value: rows.length },
      { labelKey: 'assets.cost', type: 'money', value: sum('cost') },
      { labelKey: 'assets.depreciation', type: 'money', value: sum('depreciation') },
      { labelKey: 'assets.bookValue', type: 'money', value: sum('bookValue') }
    ],
    columns: [
      { key: 'code', labelKey: 'assets.code', type: 'text' },
      { key: 'name', labelKey: 'assets.name', type: 'text' },
      { key: 'category', labelKey: 'assets.category', type: 'text' },
      { key: 'purchaseDate', labelKey: 'assets.purchaseDate', type: 'date' },
      { key: 'status', labelKey: 'assets.status', type: 'text' },
      { key: 'cost', labelKey: 'assets.cost', type: 'money' },
      { key: 'depreciation', labelKey: 'assets.depreciation', type: 'money' },
      { key: 'bookValue', labelKey: 'assets.bookValue', type: 'money' }
    ],
    rows,
    totals: { code: '', name: '', category: '', purchaseDate: null, status: '', cost: sum('cost'), depreciation: sum('depreciation'), bookValue: sum('bookValue') },
    chart: { type: 'bar', titleKey: 'assets.chart', xKey: 'name', series: [{ key: 'cost', labelKey: 'assets.cost', money: true }, { key: 'bookValue', labelKey: 'assets.bookValue', money: true }], limit: 12 },
    notes: ['assets.asOfToday']
  }
}

export const MONEY_REPORTS: Record<string, GenericReportDefinition> = {
  profitByItem: { permission: 'analytics.viewProfit', run: profitBy('profitByItem', 'item') },
  profitByCustomer: { permission: 'analytics.viewProfit', run: profitBy('profitByCustomer', 'customer') },
  receivablesSummary: { permission: 'reports.outstanding', run: openBalances('receivablesSummary', 'receivable') },
  payablesSummary: { permission: 'reports.financial', run: openBalances('payablesSummary', 'payable') },
  salesRegister: { permission: 'reports.sales', run: salesRegister },
  expenseByCategory: { permission: 'reports.financial', run: expensesBy('expenseByCategory', 'category') },
  expenseByVendor: { permission: 'reports.financial', run: expensesBy('expenseByVendor', 'vendor') },
  fixedAssetRegister: { permission: 'reports.financial', run: fixedAssetRegister }
}

