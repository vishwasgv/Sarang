import { getPrisma } from '../database/db'
import { INGREDIENT_DEDUCTION_REMARKS_PREFIX } from './restaurant.service'
import { roundCurrency, sumCurrency } from './currency.service'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SalesReportRow {
  invoiceNumber: string; date: string; customer: string | null
  itemCount: number; subtotal: number; discountAmount: number
  taxAmount: number; totalAmount: number; paymentMethod: string; paymentStatus: string
}

export interface SalesReportGroup { label: string; revenue: number; invoiceCount: number; taxAmount: number }
export interface SalesReportHourRow { hour: string; revenue: number; invoiceCount: number }

export interface SalesReport {
  dateFrom: string; dateTo: string; groupBy: string
  summary: { totalRevenue: number; totalDiscount: number; totalTax: number; totalInvoices: number; cancelledInvoices: number; averageOrderValue: number }
  groups: SalesReportGroup[]
  byHour: SalesReportHourRow[]
  rows: SalesReportRow[]
  total: number
}

export interface InventoryReportRow {
  sku: string | null; productName: string; category: string; productType: string
  currentStock: number; unit: string; costPrice: number; sellingPrice: number; stockValue: number; lowStockAlert: boolean
}

export interface InventoryReport {
  generatedAt: string
  summary: { totalProducts: number; totalStockValue: number; lowStockItems: number; outOfStockItems: number }
  rows: InventoryReportRow[]
}

export interface TaxReportRow { taxName: string; taxType: string; rate: number; taxableAmount: number; taxCollected: number; invoiceCount: number }

export interface TaxReport {
  dateFrom: string; dateTo: string
  summary: { totalTaxableAmount: number; totalTaxCollected: number }
  rows: TaxReportRow[]
  total: number
}

export interface AgingBuckets { current: number; days1to30: number; days31to60: number; days61to90: number; days90plus: number }
export interface OutstandingCustomer { id: string; customerName: string; phone: string | null; outstanding: number; aging: AgingBuckets }
export interface OutstandingSupplier { id: string; supplierName: string; phone: string | null; outstanding: number; aging: AgingBuckets }

export interface OutstandingReport {
  generatedAt: string
  customers: { totalOutstanding: number; count: number; rows: OutstandingCustomer[]; agingTotals: AgingBuckets }
  suppliers: { totalOutstanding: number; count: number; rows: OutstandingSupplier[]; agingTotals: AgingBuckets }
}

export interface LedgerRow {
  date: string; referenceType: string; referenceId: string | null
  debitAmount: number; creditAmount: number; balance: number; remarks: string | null
}

export interface CustomerLedgerReport {
  customer: { id: string; customerName: string; phone: string | null; email: string | null }
  dateFrom?: string; dateTo?: string
  openingBalance: number; closingBalance: number; totalDebit: number; totalCredit: number
  rows: LedgerRow[]
}

export interface SupplierLedgerReport {
  supplier: { id: string; supplierName: string; phone: string | null; email: string | null }
  dateFrom?: string; dateTo?: string
  openingBalance: number; closingBalance: number; totalDebit: number; totalCredit: number
  rows: LedgerRow[]
}

export interface ExpenseReportRow {
  date: string; expenseName: string; category: string; paymentMethod: string; amount: number; remarks: string | null; recordedBy: string | null
}

export interface ExpenseReport {
  dateFrom: string; dateTo: string
  summary: { totalAmount: number; expenseCount: number }
  byCategory: { category: string; amount: number; count: number }[]
  rows: ExpenseReportRow[]
}

export interface AuditReportRow {
  date: string; user: string; action: string; entityType: string | null; entityId: string | null; details: string | null
}

export interface AuditReport {
  dateFrom?: string; dateTo?: string; totalRecords: number
  rows: AuditReportRow[]
  page: number; limit: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toDate(s: string): Date { return new Date(s) }

function groupLabel(date: Date, groupBy: string): string {
  if (groupBy === 'day') return date.toISOString().slice(0, 10)
  if (groupBy === 'week') {
    const d = new Date(date)
    d.setDate(d.getDate() - d.getDay())
    return `Week of ${d.toISOString().slice(0, 10)}`
  }
  if (groupBy === 'month') return date.toISOString().slice(0, 7)
  if (groupBy === 'year') return String(date.getFullYear())
  return date.toISOString().slice(0, 10)
}

// ─────────────────────────────────────────────────────────────────────────────
// Sales Report
// ─────────────────────────────────────────────────────────────────────────────

/** Sales summary grouped by day or month. Use dateGroupBy='paymentDate' to match cash received.
 *  Always aggregates over the full matching date range — RULE REP003 requires totals to match
 *  source invoice data, so summary/groups must never be derived from a partial page of rows. */
async function generateSalesReport(params: {
  dateFrom: string; dateTo: string; groupBy?: string
  dateGroupBy?: 'invoiceDate' | 'paymentDate'
}): Promise<SalesReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)
  const gby = params.groupBy ?? 'day'
  const dateField = params.dateGroupBy ?? 'invoiceDate'

  const dateWhere = dateField === 'paymentDate'
    ? { payments: { some: { paymentDate: { gte: from, lte: to }, isReversed: false } } }
    : { invoiceDate: { gte: from, lte: to } }

  const invoices = await db.invoice.findMany({
    where: dateWhere,
    include: {
      customer: { select: { customerName: true } },
      items: { select: { quantity: true } },
      payments: { select: { paymentMethod: true, paymentDate: true }, where: { isReversed: false } }
    },
    orderBy: { invoiceDate: 'asc' }
  })

  const activeInvoices = invoices.filter(inv => inv.status !== 'CANCELLED')
  const cancelled = invoices.filter(inv => inv.status === 'CANCELLED').length

  const totalRevenue = activeInvoices.reduce((s, i) => s + i.totalAmount, 0)
  // A RETURN invoice stores discountAmount/taxAmount as a positive magnitude
  // (only subtotal/totalAmount are pre-signed negative) — the same
  // sign-correction idiom analytics.service.ts already established for
  // `quantity` (see its computeProfit/getTopProducts comments). Summing raw
  // discountAmount/taxAmount without this correction double-counts a
  // return's discount/tax as if it were an ADDITIONAL sale's.
  const totalDiscount = activeInvoices.reduce((s, i) => s + (i.invoiceType === 'RETURN' ? -1 : 1) * i.discountAmount, 0)
  const totalTax = activeInvoices.reduce((s, i) => s + (i.invoiceType === 'RETURN' ? -1 : 1) * i.taxAmount, 0)
  const totalInvoices = activeInvoices.length
  const averageOrderValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0

  const groupMap = new Map<string, SalesReportGroup>()
  for (const inv of activeInvoices) {
    const groupDate = dateField === 'paymentDate' && inv.payments.length > 0
      ? new Date(inv.payments[0].paymentDate)
      : new Date(inv.invoiceDate)
    const label = groupLabel(groupDate, gby)
    const existing = groupMap.get(label) ?? { label, revenue: 0, invoiceCount: 0, taxAmount: 0 }
    existing.revenue += inv.totalAmount
    existing.invoiceCount += 1
    existing.taxAmount += (inv.invoiceType === 'RETURN' ? -1 : 1) * inv.taxAmount
    groupMap.set(label, existing)
  }

  // "Sales by time" — busiest hours across the ENTIRE selected range (not
  // just "today"), so an owner can find a pattern over a week/month/year, not
  // only a single day. Reuses the exact hour-bucketing convention already
  // established in generateAppointmentUtilisationReport's byHour.
  const hourMap = new Map<string, SalesReportHourRow>()
  for (const inv of activeInvoices) {
    const hourPart = new Date(inv.invoiceDate).getHours().toString().padStart(2, '0')
    const label = `${hourPart}:00`
    const existing = hourMap.get(label) ?? { hour: label, revenue: 0, invoiceCount: 0 }
    existing.revenue += inv.totalAmount
    existing.invoiceCount += 1
    hourMap.set(label, existing)
  }
  const byHour = Array.from(hourMap.values()).sort((a, b) => a.hour.localeCompare(b.hour))

  const rows: SalesReportRow[] = invoices.map(inv => ({
    invoiceNumber: inv.invoiceNumber,
    date: new Date(inv.invoiceDate).toISOString().slice(0, 10),
    customer: inv.customer?.customerName ?? null,
    // Phase 38: was sum(quantity) across all lines, which silently mixed whole-
    // unit counts with fractional loose-billed weights into one meaningless
    // number (e.g. "3 packets + 0.25 kg" summed to "3.25"). Distinct-line count
    // is coherent regardless of what units the lines are in, and matches the
    // generic "Items" column label better than a cross-unit quantity sum did.
    itemCount: inv.items.length,
    subtotal: inv.subtotal,
    discountAmount: (inv.invoiceType === 'RETURN' ? -1 : 1) * inv.discountAmount,
    taxAmount: (inv.invoiceType === 'RETURN' ? -1 : 1) * inv.taxAmount,
    totalAmount: inv.totalAmount,
    paymentMethod: inv.payments.length > 0
      ? [...new Set(inv.payments.map(p => p.paymentMethod))].join(' / ')
      : (inv.paymentStatus === 'UNPAID' || inv.status === 'CANCELLED' ? inv.paymentStatus : 'CASH'),
    paymentStatus: inv.status === 'CANCELLED' ? 'CANCELLED' : inv.paymentStatus
  }))

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, groupBy: gby,
    summary: { totalRevenue, totalDiscount, totalTax, totalInvoices, cancelledInvoices: cancelled, averageOrderValue },
    groups: Array.from(groupMap.values()),
    byHour,
    rows, total: invoices.length
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Inventory Report
// ─────────────────────────────────────────────────────────────────────────────

async function generateInventoryReport(params?: { categoryId?: string; lowStockOnly?: boolean }): Promise<InventoryReport> {
  const db = getPrisma()

  const products = await db.product.findMany({
    where: {
      isActive: true,
      ...(params?.categoryId ? { categoryId: params.categoryId } : {})
    },
    include: {
      category: { select: { name: true } },
      inventory: true
    },
    orderBy: { productName: 'asc' }
  })

  const rows: InventoryReportRow[] = []
  for (const p of products) {
    const stock = p.inventory?.quantity ?? 0
    const lowAlert = p.inventory ? stock <= (p.inventory.reorderLevel ?? 0) && stock > 0 : false
    const stockValue = stock * p.costPrice

    if (params?.lowStockOnly && !lowAlert && stock !== 0) continue

    rows.push({
      sku: p.sku, productName: p.productName,
      category: p.category?.name ?? 'Uncategorized',
      productType: p.productType,
      // Phase 38: a loose-billed product's stock is tracked directly in its
      // weightUnit (kg/g/L/mL), not the generic pack Product.unit — showing
      // "42.5 PCS" for 42.5kg of loose rice was silently wrong.
      currentStock: stock, unit: (p.sellByWeight && p.weightUnit) ? p.weightUnit : p.unit, costPrice: p.costPrice,
      sellingPrice: p.sellingPrice, stockValue, lowStockAlert: lowAlert || stock === 0
    })
  }

  const totalStockValue = rows.reduce((s, r) => s + r.stockValue, 0)
  const lowStockItems = rows.filter(r => r.lowStockAlert && r.currentStock > 0).length
  const outOfStockItems = rows.filter(r => r.currentStock === 0 && r.productType === 'STANDARD').length

  return {
    generatedAt: new Date().toISOString(),
    summary: { totalProducts: rows.length, totalStockValue, lowStockItems, outOfStockItems },
    rows
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tax Report
// ─────────────────────────────────────────────────────────────────────────────

/** Splits tax items by gstType: IGST rows go into igstRows, CGST_SGST rows into rows. Used for GST filing reconciliation.
 *  The output is always a compact by-rate breakdown, so it always aggregates over every matching
 *  invoice item in range — capping the source rows would silently under-report tax collected. */
async function generateTaxReport(params: { dateFrom: string; dateTo: string }): Promise<TaxReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const taxItemWhere = {
    invoice: { invoiceDate: { gte: from, lte: to }, status: { not: 'CANCELLED' as const } },
    taxRate: { not: 0 }
  }

  const items = await db.invoiceItem.findMany({
    where: taxItemWhere,
    include: { invoice: { select: { invoiceDate: true, gstType: true, invoiceType: true } } }
  })

  const taxConfigs = await db.taxConfiguration.findMany({ where: { isActive: true } })
  const configMap = new Map(taxConfigs.map(t => [t.rate, t]))

  // Separate CGST_SGST items from IGST items per rate
  type RateData = { taxableAmount: number; taxCollected: number; invoiceIds: Set<string> }
  const cgstSgstMap = new Map<number, RateData>()
  const igstMap = new Map<number, RateData>()

  const profile = await db.businessProfile.findFirst()
  const isGST = profile?.taxModel === 'GST'

  for (const item of items) {
    const rate = item.taxRate ?? 0
    if (!rate) continue
    const isIgst = item.invoice.gstType === 'IGST'
    const map = (isGST && isIgst) ? igstMap : cgstSgstMap
    const existing = map.get(rate) ?? { taxableAmount: 0, taxCollected: 0, invoiceIds: new Set() }
    // Return items store unitPrice/quantity/discountAmount/taxAmount as
    // positive magnitudes (see generateSalesReport's totalDiscount comment
    // above for why) — net them out here so a return correctly reduces
    // taxable turnover and tax collected instead of adding to it.
    const sign = item.invoice.invoiceType === 'RETURN' ? -1 : 1
    const lineTotal = sign * (item.unitPrice * item.quantity - item.discountAmount)
    existing.taxableAmount += lineTotal
    existing.taxCollected += sign * item.taxAmount
    existing.invoiceIds.add(item.invoiceId)
    map.set(rate, existing)
  }

  const rows: TaxReportRow[] = []

  for (const [rate, data] of Array.from(cgstSgstMap.entries()).sort((a, b) => a[0] - b[0])) {
    const cfg = configMap.get(rate)
    if (isGST && rate > 0) {
      const halfRate = rate / 2
      const halfTax = data.taxCollected / 2
      const halfBase = data.taxableAmount / 2
      rows.push({ taxName: `CGST @ ${halfRate}%`, taxType: 'CGST', rate: halfRate, taxableAmount: halfBase, taxCollected: halfTax, invoiceCount: data.invoiceIds.size })
      rows.push({ taxName: `SGST @ ${halfRate}%`, taxType: 'SGST', rate: halfRate, taxableAmount: halfBase, taxCollected: halfTax, invoiceCount: data.invoiceIds.size })
    } else {
      rows.push({ taxName: cfg?.taxName ?? `${rate}% Tax`, taxType: cfg?.taxType ?? 'SALES_TAX', rate, taxableAmount: data.taxableAmount, taxCollected: data.taxCollected, invoiceCount: data.invoiceIds.size })
    }
  }

  for (const [rate, data] of Array.from(igstMap.entries()).sort((a, b) => a[0] - b[0])) {
    rows.push({ taxName: `IGST @ ${rate}%`, taxType: 'IGST', rate, taxableAmount: data.taxableAmount, taxCollected: data.taxCollected, invoiceCount: data.invoiceIds.size })
  }

  const allData = [...cgstSgstMap.values(), ...igstMap.values()]
  const totalTaxableAmount = allData.reduce((s, r) => s + r.taxableAmount, 0)
  const totalTaxCollected = allData.reduce((s, r) => s + r.taxCollected, 0)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: { totalTaxableAmount, totalTaxCollected },
    rows, total: items.length
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Outstanding Report — RULE REP004: must match ledger balances
// ─────────────────────────────────────────────────────────────────────────────

function agingBucket(daysOld: number, amount: number): AgingBuckets {
  const b: AgingBuckets = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0 }
  if (daysOld <= 0) b.current += amount
  else if (daysOld <= 30) b.days1to30 += amount
  else if (daysOld <= 60) b.days31to60 += amount
  else if (daysOld <= 90) b.days61to90 += amount
  else b.days90plus += amount
  return b
}

function mergeAging(a: AgingBuckets, b: AgingBuckets): AgingBuckets {
  return {
    current: a.current + b.current,
    days1to30: a.days1to30 + b.days1to30,
    days31to60: a.days31to60 + b.days31to60,
    days61to90: a.days61to90 + b.days61to90,
    days90plus: a.days90plus + b.days90plus
  }
}

const ZERO_AGING: AgingBuckets = { current: 0, days1to30: 0, days31to60: 0, days61to90: 0, days90plus: 0 }

async function generateOutstandingReport(): Promise<OutstandingReport> {
  const db = getPrisma()
  const now = new Date()

  // Batch-load everything in 4 parallel queries instead of N+1
  const [customers, suppliers, allUnpaidInvoices, allSupplierLedger] = await Promise.all([
    db.customer.findMany({ where: { isActive: true }, select: { id: true, customerName: true, phone: true } }),
    db.supplier.findMany({ where: { isActive: true }, select: { id: true, supplierName: true, phone: true } }),
    db.invoice.findMany({
      where: { paymentStatus: { in: ['UNPAID', 'PARTIAL'] }, status: { not: 'CANCELLED' }, customerId: { not: null } },
      select: { customerId: true, balanceAmount: true, invoiceDate: true, dueDate: true }
    }),
    db.supplierLedger.findMany({
      select: { supplierId: true, debitAmount: true, creditAmount: true, createdAt: true }
    })
  ])

  // Group invoices by customer in memory
  const invoicesByCustomer = new Map<string, { balanceAmount: number; invoiceDate: Date; dueDate: Date | null }[]>()
  for (const inv of allUnpaidInvoices) {
    if (!inv.customerId) continue
    const arr = invoicesByCustomer.get(inv.customerId) ?? []
    arr.push({ balanceAmount: inv.balanceAmount, invoiceDate: inv.invoiceDate, dueDate: inv.dueDate })
    invoicesByCustomer.set(inv.customerId, arr)
  }

  // Group supplier ledger entries by supplierId in memory
  const ledgerBySupplier = new Map<string, { debitAmount: number; creditAmount: number; createdAt: Date }[]>()
  for (const e of allSupplierLedger) {
    const arr = ledgerBySupplier.get(e.supplierId) ?? []
    arr.push(e)
    ledgerBySupplier.set(e.supplierId, arr)
  }

  const customerRows: OutstandingCustomer[] = []
  for (const c of customers) {
    const unpaidInvoices = invoicesByCustomer.get(c.id) ?? []
    if (unpaidInvoices.length === 0) continue

    let outstanding = 0
    let aging: AgingBuckets = { ...ZERO_AGING }
    for (const inv of unpaidInvoices) {
      const balance = inv.balanceAmount
      if (balance <= 0.01) continue
      outstanding += balance
      // Aging is relative to the payment due date when set (e.g. a credit-terms invoice);
      // falls back to invoiceDate for invoices with no due date recorded.
      const agingBasis = inv.dueDate ?? inv.invoiceDate
      const daysOld = Math.floor((now.getTime() - agingBasis.getTime()) / 86400000)
      aging = mergeAging(aging, agingBucket(daysOld, balance))
    }

    if (outstanding > 0.01) {
      customerRows.push({ id: c.id, customerName: c.customerName, phone: c.phone, outstanding, aging })
    }
  }

  const supplierRows: OutstandingSupplier[] = []
  for (const s of suppliers) {
    const ledgerEntries = ledgerBySupplier.get(s.id) ?? []
    if (ledgerEntries.length === 0) continue

    const outstanding = ledgerEntries.reduce((sum, e) => sum + e.debitAmount - e.creditAmount, 0)
    if (outstanding <= 0.01) continue

    let aging: AgingBuckets = { ...ZERO_AGING }
    let remaining = outstanding
    const debitEntries = ledgerEntries.filter(e => e.debitAmount > 0).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    for (const entry of debitEntries) {
      if (remaining <= 0) break
      const portion = Math.min(entry.debitAmount, remaining)
      const daysOld = Math.floor((now.getTime() - entry.createdAt.getTime()) / 86400000)
      aging = mergeAging(aging, agingBucket(daysOld, portion))
      remaining -= portion
    }

    supplierRows.push({ id: s.id, supplierName: s.supplierName, phone: s.phone, outstanding, aging })
  }

  customerRows.sort((a, b) => b.outstanding - a.outstanding)
  supplierRows.sort((a, b) => b.outstanding - a.outstanding)

  const customerAgingTotals = customerRows.reduce((acc, r) => mergeAging(acc, r.aging), { ...ZERO_AGING })
  const supplierAgingTotals = supplierRows.reduce((acc, r) => mergeAging(acc, r.aging), { ...ZERO_AGING })

  return {
    generatedAt: now.toISOString(),
    customers: {
      totalOutstanding: customerRows.reduce((s, r) => s + r.outstanding, 0),
      count: customerRows.length,
      rows: customerRows,
      agingTotals: customerAgingTotals
    },
    suppliers: {
      totalOutstanding: supplierRows.reduce((s, r) => s + r.outstanding, 0),
      count: supplierRows.length,
      rows: supplierRows,
      agingTotals: supplierAgingTotals
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer Ledger Statement
// ─────────────────────────────────────────────────────────────────────────────

async function generateCustomerLedgerReport(params: { customerId: string; dateFrom?: string; dateTo?: string }): Promise<CustomerLedgerReport> {
  const db = getPrisma()

  const customer = await db.customer.findUniqueOrThrow({
    where: { id: params.customerId },
    select: { id: true, customerName: true, phone: true, email: true }
  })

  const dateFilter = params.dateFrom || params.dateTo ? {
    createdAt: {
      ...(params.dateFrom ? { gte: toDate(params.dateFrom) } : {}),
      ...(params.dateTo ? { lte: (() => { const d = new Date(params.dateTo); d.setHours(23, 59, 59, 999); return d })() } : {})
    }
  } : {}

  // Opening balance = sum of all entries BEFORE dateFrom
  let openingBalance = 0
  if (params.dateFrom) {
    const agg = await db.customerLedger.aggregate({
      where: { customerId: params.customerId, createdAt: { lt: toDate(params.dateFrom) } },
      _sum: { debitAmount: true, creditAmount: true }
    })
    openingBalance = (agg._sum.debitAmount ?? 0) - (agg._sum.creditAmount ?? 0)
  }

  const entries = await db.customerLedger.findMany({
    where: { customerId: params.customerId, ...dateFilter },
    orderBy: { createdAt: 'asc' }
  })

  const rows: LedgerRow[] = entries.map(e => ({
    date: new Date(e.createdAt).toISOString(),
    referenceType: e.referenceType,
    referenceId: e.referenceId,
    debitAmount: e.debitAmount,
    creditAmount: e.creditAmount,
    balance: e.balance,
    remarks: e.remarks
  }))

  const totalDebit = entries.reduce((s, e) => s + e.debitAmount, 0)
  const totalCredit = entries.reduce((s, e) => s + e.creditAmount, 0)
  const closingBalance = openingBalance + totalDebit - totalCredit

  return { customer, dateFrom: params.dateFrom, dateTo: params.dateTo, openingBalance, closingBalance, totalDebit, totalCredit, rows }
}

// ─────────────────────────────────────────────────────────────────────────────
// Supplier Ledger Statement
// ─────────────────────────────────────────────────────────────────────────────

async function generateSupplierLedgerReport(params: { supplierId: string; dateFrom?: string; dateTo?: string }): Promise<SupplierLedgerReport> {
  const db = getPrisma()

  const supplier = await db.supplier.findUniqueOrThrow({
    where: { id: params.supplierId },
    select: { id: true, supplierName: true, phone: true, email: true }
  })

  const dateFilter = params.dateFrom || params.dateTo ? {
    createdAt: {
      ...(params.dateFrom ? { gte: toDate(params.dateFrom) } : {}),
      ...(params.dateTo ? { lte: (() => { const d = new Date(params.dateTo); d.setHours(23, 59, 59, 999); return d })() } : {})
    }
  } : {}

  let openingBalance = 0
  if (params.dateFrom) {
    const agg = await db.supplierLedger.aggregate({
      where: { supplierId: params.supplierId, createdAt: { lt: toDate(params.dateFrom) } },
      _sum: { debitAmount: true, creditAmount: true }
    })
    // Matches supplier-ledger.service.ts's calculateBalance/addEntry convention (and the
    // per-row `balance` column stored on SupplierLedger itself): debit = we owe more
    // (a purchase/GRN was posted), credit = we owe less (a payment was made).
    openingBalance = (agg._sum.debitAmount ?? 0) - (agg._sum.creditAmount ?? 0)
  }

  const entries = await db.supplierLedger.findMany({
    where: { supplierId: params.supplierId, ...dateFilter },
    orderBy: { createdAt: 'asc' }
  })

  const rows: LedgerRow[] = entries.map(e => ({
    date: new Date(e.createdAt).toISOString(),
    referenceType: e.referenceType,
    referenceId: e.referenceId,
    debitAmount: e.debitAmount,
    creditAmount: e.creditAmount,
    balance: e.balance,
    remarks: e.remarks
  }))

  const totalDebit = entries.reduce((s, e) => s + e.debitAmount, 0)
  const totalCredit = entries.reduce((s, e) => s + e.creditAmount, 0)
  const closingBalance = openingBalance + totalDebit - totalCredit

  return { supplier, dateFrom: params.dateFrom, dateTo: params.dateTo, openingBalance, closingBalance, totalDebit, totalCredit, rows }
}

// ─────────────────────────────────────────────────────────────────────────────
// Expense Report
// ─────────────────────────────────────────────────────────────────────────────

async function generateExpenseReport(params: { dateFrom: string; dateTo: string; categoryId?: string }): Promise<ExpenseReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const expenses = await db.expense.findMany({
    where: {
      expenseDate: { gte: from, lte: to },
      ...(params.categoryId ? { categoryId: params.categoryId } : {})
    },
    include: {
      category: { select: { categoryName: true } },
      createdBy: { select: { fullName: true } }
    },
    orderBy: { expenseDate: 'asc' }
  })

  const catRaw = new Map<string, { amounts: number[]; count: number }>()
  for (const e of expenses) {
    const name = e.category.categoryName
    const existing = catRaw.get(name) ?? { amounts: [], count: 0 }
    existing.amounts.push(e.amount)
    existing.count += 1
    catRaw.set(name, existing)
  }
  const catMap = new Map<string, { amount: number; count: number }>(
    Array.from(catRaw.entries()).map(([name, { amounts, count }]) => [name, { amount: sumCurrency(amounts), count }])
  )

  const rows: ExpenseReportRow[] = expenses.map(e => ({
    date: new Date(e.expenseDate).toISOString().slice(0, 10),
    expenseName: e.expenseName,
    category: e.category.categoryName,
    paymentMethod: e.paymentMethod,
    amount: e.amount,
    remarks: e.remarks,
    recordedBy: e.createdBy?.fullName ?? null
  }))

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      totalAmount: sumCurrency(expenses.map(e => e.amount)),
      expenseCount: expenses.length
    },
    byCategory: Array.from(catMap.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.amount - a.amount),
    rows
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Profit & Loss Statement (fresh-audit fix, 2026-07-12) — profit was
// previously only a single locked Dashboard KPI tile with no print/export
// path at all. Deliberately reuses analytics.service.ts's computeProfit()
// formula exactly (same RETURN-invoice sign correction on COGS) so this
// report's numbers always agree with the Dashboard's own Profit Estimate for
// the same period — two different profit figures for one business would be
// worse than the single-tile status quo this replaces.
// ─────────────────────────────────────────────────────────────────────────────

export interface ProfitAndLossExpenseCategory { category: string; amount: number }
export interface ProfitAndLossReport {
  dateFrom: string; dateTo: string
  summary: {
    revenue: number; cogs: number; grossProfit: number; grossMarginPercent: number
    totalExpenses: number; netProfit: number; netMarginPercent: number; invoiceCount: number
  }
  expensesByCategory: ProfitAndLossExpenseCategory[]
}

async function generateProfitAndLossReport(params: { dateFrom: string; dateTo: string }): Promise<ProfitAndLossReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const [invoices, expenses] = await Promise.all([
    db.invoice.findMany({
      where: { status: 'ACTIVE', paymentStatus: { in: ['PAID', 'PARTIAL'] }, invoiceDate: { gte: from, lte: to } },
      select: { totalAmount: true, invoiceType: true, items: { select: { quantity: true, product: { select: { costPrice: true } } } } }
    }),
    db.expense.findMany({
      where: { expenseDate: { gte: from, lte: to } },
      include: { category: { select: { categoryName: true } } }
    })
  ])

  const revenue = sumCurrency(invoices.map(inv => inv.totalAmount))
  // Same RETURN-invoice sign correction as analytics.service.ts's
  // computeProfit(): a return's item quantities are stored positive (used to
  // restock inventory), so summing quantity*costPrice unconditionally would
  // double-punish profit — revenue already dropped via totalAmount, COGS
  // must drop too (the goods came back into stock), not rise as a second sale.
  const cogs = sumCurrency(invoices.flatMap((inv) => {
    const sign = inv.invoiceType === 'RETURN' ? -1 : 1
    return inv.items.map((it) => sign * it.quantity * it.product.costPrice)
  }))
  const grossProfit = roundCurrency(revenue - cogs)

  const catRaw = new Map<string, number[]>()
  for (const e of expenses) {
    const name = e.category.categoryName
    catRaw.set(name, [...(catRaw.get(name) ?? []), e.amount])
  }
  const catMap = new Map<string, number>(Array.from(catRaw.entries()).map(([name, amounts]) => [name, sumCurrency(amounts)]))
  const totalExpenses = sumCurrency(expenses.map(e => e.amount))
  const netProfit = roundCurrency(grossProfit - totalExpenses)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      revenue, cogs, grossProfit,
      grossMarginPercent: revenue !== 0 ? Math.round((grossProfit / revenue) * 1000) / 10 : 0,
      totalExpenses, netProfit,
      netMarginPercent: revenue !== 0 ? Math.round((netProfit / revenue) * 1000) / 10 : 0,
      invoiceCount: invoices.length,
    },
    expensesByCategory: Array.from(catMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cash Book — a chronological register of every real cash/bank movement:
// customer payments in (Payment, non-reversed), and cash out via both
// Expense records and supplier payments (SupplierLedger referenceType
// 'PAYMENT' entries — the only SupplierLedger rows that represent money
// actually leaving the business, as opposed to PURCHASE_ORDER/DEBIT_NOTE
// rows which just record an obligation). Opening balance is the net of
// every such movement strictly before dateFrom, so closingBalance always
// ties out to "if you replayed every transaction from day one."
// ─────────────────────────────────────────────────────────────────────────────

export interface CashBookEntry {
  date: string
  description: string
  type: 'IN' | 'OUT'
  paymentMethod: string
  amount: number
  runningBalance: number
}
export interface CashBookReport {
  dateFrom: string; dateTo: string
  openingBalance: number
  entries: CashBookEntry[]
  totalIn: number
  totalOut: number
  closingBalance: number
}

async function fetchCashMovements(upTo: Date): Promise<{ date: Date; description: string; type: 'IN' | 'OUT'; paymentMethod: string; amount: number }[]> {
  const db = getPrisma()
  const [payments, expenses, supplierPayments] = await Promise.all([
    db.payment.findMany({
      where: { isReversed: false, paymentDate: { lte: upTo } },
      select: { paymentDate: true, amount: true, paymentMethod: true, referenceNumber: true, invoice: { select: { invoiceNumber: true } } }
    }),
    db.expense.findMany({
      where: { expenseDate: { lte: upTo } },
      select: { expenseDate: true, amount: true, paymentMethod: true, expenseName: true }
    }),
    db.supplierLedger.findMany({
      where: { referenceType: 'PAYMENT', createdAt: { lte: upTo } },
      select: { createdAt: true, creditAmount: true, supplier: { select: { supplierName: true } } }
    })
  ])

  return [
    ...payments.map((p) => ({
      date: p.paymentDate, type: 'IN' as const, paymentMethod: p.paymentMethod, amount: p.amount,
      description: `Payment received — ${p.invoice.invoiceNumber}${p.referenceNumber ? ` (Ref: ${p.referenceNumber})` : ''}`
    })),
    ...expenses.map((e) => ({
      date: e.expenseDate, type: 'OUT' as const, paymentMethod: e.paymentMethod, amount: e.amount,
      description: `Expense — ${e.expenseName}`
    })),
    ...supplierPayments.map((s) => ({
      date: s.createdAt, type: 'OUT' as const, paymentMethod: 'SUPPLIER_PAYMENT', amount: s.creditAmount,
      description: `Payment to supplier — ${s.supplier.supplierName}`
    }))
  ]
}

async function generateCashBookReport(params: { dateFrom: string; dateTo: string; paymentMethod?: string }): Promise<CashBookReport> {
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const allUpToEnd = await fetchCashMovements(to)
  const filtered = params.paymentMethod
    ? allUpToEnd.filter((m) => m.paymentMethod === params.paymentMethod)
    : allUpToEnd

  const before = filtered.filter((m) => m.date < from)
  const openingBalance = roundCurrency(
    sumCurrency(before.filter((m) => m.type === 'IN').map((m) => m.amount)) -
    sumCurrency(before.filter((m) => m.type === 'OUT').map((m) => m.amount))
  )

  const inRange = filtered.filter((m) => m.date >= from).sort((a, b) => a.date.getTime() - b.date.getTime())

  let running = openingBalance
  const entries: CashBookEntry[] = inRange.map((m) => {
    running = roundCurrency(m.type === 'IN' ? running + m.amount : running - m.amount)
    return {
      date: m.date.toISOString(),
      description: m.description,
      type: m.type,
      paymentMethod: m.paymentMethod,
      amount: m.amount,
      runningBalance: running
    }
  })

  const totalIn = sumCurrency(inRange.filter((m) => m.type === 'IN').map((m) => m.amount))
  const totalOut = sumCurrency(inRange.filter((m) => m.type === 'OUT').map((m) => m.amount))

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    openingBalance, entries, totalIn, totalOut,
    closingBalance: roundCurrency(openingBalance + totalIn - totalOut)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Trial Balance — derived from this app's existing ledgers/invoices/expenses
// rather than a persisted double-entry general ledger (this app doesn't have
// one; see currency/ledger notes elsewhere). Deliberately reuses
// generateProfitAndLossReport's exact revenue/COGS/expense numbers so this
// never disagrees with the P&L report for the same period.
//
// Cash & Bank, Accounts Receivable, and Accounts Payable are CURRENT
// (as-of-now) balances, not reconstructed as of dateTo — Customer.
// outstandingBalance and the SupplierLedger running balance are maintained
// as live running totals, not a dated history that can be rewound. Cash &
// Bank IS computed as of dateTo (it's derived from dated transaction rows,
// so it can be). This is stated plainly in the report's own `asOf` field
// rather than silently presented as more precise than it is.
//
// "Capital & Retained Earnings" is a balancing entry, not a tracked account
// (this app has no owner's-capital ledger) — it's Debit total minus every
// other Credit line, labelled as computed so it's never mistaken for a real
// ledger balance.
// ─────────────────────────────────────────────────────────────────────────────

export interface TrialBalanceRow { account: string; debit: number; credit: number }
export interface TrialBalanceReport {
  dateFrom: string; dateTo: string; asOf: string
  rows: TrialBalanceRow[]
  totalDebit: number
  totalCredit: number
  balanced: boolean
}

async function generateTrialBalanceReport(params: { dateFrom: string; dateTo: string }): Promise<TrialBalanceReport> {
  const db = getPrisma()
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const [pnl, taxInvoices, customers, supplierBalances, cashMovements] = await Promise.all([
    generateProfitAndLossReport({ dateFrom: params.dateFrom, dateTo: params.dateTo }),
    db.invoice.findMany({
      where: { status: 'ACTIVE', paymentStatus: { in: ['PAID', 'PARTIAL'] }, invoiceDate: { gte: toDate(params.dateFrom), lte: to } },
      select: { taxAmount: true }
    }),
    db.customer.findMany({ where: { outstandingBalance: { gt: 0 } }, select: { outstandingBalance: true } }),
    db.supplierLedger.groupBy({ by: ['supplierId'], _sum: { debitAmount: true, creditAmount: true } }),
    fetchCashMovements(to)
  ])

  const taxCollected = sumCurrency(taxInvoices.map((inv) => inv.taxAmount))
  const revenueNet = roundCurrency(pnl.summary.revenue - taxCollected)

  const accountsReceivable = sumCurrency(customers.map((c) => c.outstandingBalance))
  const accountsPayable = sumCurrency(
    supplierBalances
      .map((s) => (s._sum.debitAmount ?? 0) - (s._sum.creditAmount ?? 0))
      .filter((bal) => bal > 0)
  )
  const cashAndBank = roundCurrency(
    sumCurrency(cashMovements.filter((m) => m.type === 'IN').map((m) => m.amount)) -
    sumCurrency(cashMovements.filter((m) => m.type === 'OUT').map((m) => m.amount))
  )

  // Several of these figures can legitimately go negative: Cash & Bank
  // (more paid out than ever came in), Cost of Goods Sold and Sales Revenue
  // (a period where RETURN invoices outweigh SALE invoices — the same sign
  // case generateProfitAndLossReport's own RETURN-invoice correction
  // handles). A negative "debit" account is, by definition, actually a
  // credit balance for that period — put each figure on whichever side its
  // sign actually belongs on, rather than either showing a negative number
  // in a column (not how a real trial balance reads) or letting it silently
  // disappear from both columns while still being netted into the totals.
  function signedRow(account: string, naturalSide: 'debit' | 'credit', amount: number): TrialBalanceRow {
    const magnitude = Math.abs(amount)
    const side = amount >= 0 ? naturalSide : (naturalSide === 'debit' ? 'credit' : 'debit')
    return side === 'debit' ? { account, debit: magnitude, credit: 0 } : { account, debit: 0, credit: magnitude }
  }

  const rowsExclCapital: TrialBalanceRow[] = [
    signedRow('Cash & Bank', 'debit', cashAndBank),
    signedRow('Accounts Receivable', 'debit', accountsReceivable),
    signedRow('Cost of Goods Sold', 'debit', pnl.summary.cogs),
    signedRow('Operating Expenses', 'debit', pnl.summary.totalExpenses),
    signedRow('Accounts Payable', 'credit', accountsPayable),
    signedRow('Sales Revenue', 'credit', revenueNet),
    signedRow('Tax Payable (Output)', 'credit', taxCollected)
  ]

  const totalDebitExclCapital = roundCurrency(sumCurrency(rowsExclCapital.map((r) => r.debit)))
  const totalCreditExclCapital = roundCurrency(sumCurrency(rowsExclCapital.map((r) => r.credit)))
  const capital = roundCurrency(totalDebitExclCapital - totalCreditExclCapital)
  // The balancing plug can land on either side too (liabilities+income
  // outweighing assets+expenses is a legitimate negative-equity position,
  // not just a rounding artifact) — same non-negative-per-column treatment.
  const capitalRow: TrialBalanceRow = capital >= 0
    ? { account: 'Capital & Retained Earnings (balancing)', debit: 0, credit: capital }
    : { account: 'Capital & Retained Earnings (balancing)', debit: -capital, credit: 0 }

  const rows: TrialBalanceRow[] = [...rowsExclCapital, capitalRow]
  const totalDebit = roundCurrency(totalDebitExclCapital + capitalRow.debit)
  const totalCredit = roundCurrency(totalCreditExclCapital + capitalRow.credit)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, asOf: params.dateTo,
    rows, totalDebit, totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.01
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit Report (Admin only)
// ─────────────────────────────────────────────────────────────────────────────

async function generateAuditReport(params?: {
  dateFrom?: string; dateTo?: string; userId?: string; action?: string; entityType?: string
  page?: number; limit?: number
}): Promise<AuditReport> {
  const db = getPrisma()

  const from = params?.dateFrom ? toDate(params.dateFrom) : undefined
  const to = params?.dateTo ? (() => { const d = new Date(params.dateTo!); d.setHours(23, 59, 59, 999); return d })() : undefined
  const page = params?.page ?? 1
  const limit = Math.min(params?.limit ?? 200, 1000)
  const skip = (page - 1) * limit

  const where = {
    ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
    ...(params?.userId ? { userId: params.userId } : {}),
    ...(params?.action ? { action: { contains: params.action } } : {}),
    ...(params?.entityType ? { entityType: params.entityType } : {})
  }

  // Real count (not rows.length) — a hard row cap must never masquerade as the true total.
  const [logs, totalRecords] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: { user: { select: { fullName: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit
    }),
    db.auditLog.count({ where })
  ])

  const rows: AuditReportRow[] = logs.map(l => ({
    date: new Date(l.createdAt).toISOString(),
    user: l.user ? `${l.user.fullName} (${l.user.username})` : 'System',
    action: l.action,
    entityType: l.entityType,
    entityId: l.entityId,
    details: l.newValue ?? l.oldValue ?? null
  }))

  return { dateFrom: params?.dateFrom, dateTo: params?.dateTo, totalRecords, rows, page, limit }
}

// ─────────────────────────────────────────────────────────────────────────────
// Food Cost Report (Restaurant template)
// ─────────────────────────────────────────────────────────────────────────────

export interface FoodCostReportRow {
  ingredientName: string; unit: string; totalQuantityUsed: number; costPrice: number; totalCost: number
}

export interface FoodCostReport {
  dateFrom?: string; dateTo?: string; totalCost: number; rows: FoodCostReportRow[]
}

async function generateFoodCostReport(params?: { dateFrom?: string; dateTo?: string }): Promise<FoodCostReport> {
  const db = getPrisma()

  const from = params?.dateFrom ? toDate(params.dateFrom) : undefined
  const to = params?.dateTo ? (() => { const d = new Date(params.dateTo!); d.setHours(23, 59, 59, 999); return d })() : undefined

  // Find all inventory movements triggered by KOT ingredient deductions
  const movements = await db.inventoryMovement.findMany({
    where: {
      movementType: 'ADJUSTMENT',
      quantity: { lt: 0 },
      remarks: { contains: INGREDIENT_DEDUCTION_REMARKS_PREFIX },
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {})
    },
    include: {
      product: { select: { productName: true, unit: true, costPrice: true } }
    }
  })

  // Aggregate by product
  const byProduct = new Map<string, FoodCostReportRow>()
  for (const m of movements) {
    const key = m.productId
    const used = Math.abs(m.quantity)
    const cost = m.product.costPrice ?? 0
    if (byProduct.has(key)) {
      const existing = byProduct.get(key)!
      existing.totalQuantityUsed += used
      existing.totalCost += used * cost
    } else {
      byProduct.set(key, {
        ingredientName: m.product.productName,
        unit: m.product.unit,
        totalQuantityUsed: used,
        costPrice: cost,
        totalCost: used * cost
      })
    }
  }

  const rows = Array.from(byProduct.values()).sort((a, b) => b.totalCost - a.totalCost)
  const totalCost = rows.reduce((s, r) => s + r.totalCost, 0)

  return { dateFrom: params?.dateFrom, dateTo: params?.dateTo, totalCost, rows }
}

// ─────────────────────────────────────────────────────────────────────────────
// GSTR-1 Export (B2B, B2C summary in Indian GST filing format)
// ─────────────────────────────────────────────────────────────────────────────

export interface GSTR1B2BRow {
  gstin: string; receiverName: string; invoiceNumber: string; invoiceDate: string
  invoiceValue: number; placeOfSupply: string; reverseCharge: 'N'
  taxableValue: number; igstAmount: number; cgstAmount: number; sgstAmount: number; rate: number
}

export interface GSTR1B2CSRow {
  placeOfSupply: string; rate: number; taxableValue: number
  igstAmount: number; cgstAmount: number; sgstAmount: number
}

export interface GSTR1Report {
  period: string
  b2b: GSTR1B2BRow[]
  b2cs: GSTR1B2CSRow[]
  summary: { totalB2BValue: number; totalB2CSValue: number; totalIgst: number; totalCgst: number; totalSgst: number }
}

/** Builds GSTR-1 return data: B2B (customer has GSTIN/taxNumber) vs B2CS (retail). IGST for inter-state, CGST+SGST for intra-state. */
async function generateGSTR1(params: { dateFrom: string; dateTo: string }): Promise<GSTR1Report> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const invoices = await db.invoice.findMany({
    where: { invoiceDate: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
    include: {
      customer: { select: { customerName: true, taxNumber: true, state: true } },
      items: true
    },
    orderBy: { invoiceDate: 'asc' }
  })

  const b2b: GSTR1B2BRow[] = []
  const b2csMap = new Map<string, GSTR1B2CSRow>()

  for (const inv of invoices) {
    const isIgst = inv.gstType === 'IGST'
    const placeOfSupply = inv.buyerState ?? inv.customer?.state ?? 'Unknown'
    // See generateSalesReport's totalDiscount comment — return items store
    // positive-magnitude discountAmount/taxAmount, net them out here.
    const sign = inv.invoiceType === 'RETURN' ? -1 : 1

    for (const item of inv.items) {
      const rate = item.taxRate ?? 0
      const taxableValue = sign * (item.unitPrice * item.quantity - item.discountAmount)
      const totalTax = sign * item.taxAmount
      const igst = isIgst ? totalTax : 0
      const cgst = isIgst ? 0 : totalTax / 2
      const sgst = isIgst ? 0 : totalTax / 2

      if (inv.customer?.taxNumber) {
        b2b.push({
          gstin: inv.customer.taxNumber,
          receiverName: inv.customer.customerName,
          invoiceNumber: inv.invoiceNumber,
          invoiceDate: new Date(inv.invoiceDate).toISOString().slice(0, 10),
          invoiceValue: inv.totalAmount,
          placeOfSupply,
          reverseCharge: 'N',
          taxableValue, igstAmount: igst, cgstAmount: cgst, sgstAmount: sgst, rate
        })
      } else {
        const key = `${placeOfSupply}|${rate}|${isIgst ? 'IGST' : 'CGST_SGST'}`
        const existing = b2csMap.get(key) ?? { placeOfSupply, rate, taxableValue: 0, igstAmount: 0, cgstAmount: 0, sgstAmount: 0 }
        existing.taxableValue += taxableValue
        existing.igstAmount += igst
        existing.cgstAmount += cgst
        existing.sgstAmount += sgst
        b2csMap.set(key, existing)
      }
    }
  }

  const b2cs = Array.from(b2csMap.values())
  const totalB2BValue = b2b.reduce((s, r) => s + r.invoiceValue, 0)
  const totalB2CSValue = b2cs.reduce((s, r) => s + r.taxableValue, 0)
  const totalIgst = [...b2b, ...b2cs].reduce((s, r) => s + r.igstAmount, 0)
  const totalCgst = [...b2b, ...b2cs].reduce((s, r) => s + r.cgstAmount, 0)
  const totalSgst = [...b2b, ...b2cs].reduce((s, r) => s + r.sgstAmount, 0)

  const period = `${params.dateFrom} to ${params.dateTo}`
  return { period, b2b, b2cs, summary: { totalB2BValue, totalB2CSValue, totalIgst, totalCgst, totalSgst } }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 54F.17 — HSN-Wise Summary, Document Summary, GSTR-3B Reconciliation
// Preview. Reference reports for GST filing, NOT a portal-upload JSON export
// — see PHASE_54F_17_TECHNICAL_SPEC.md Section 1 for why: as of the current
// GSTN rollout, Table 12 (HSN) is dropdown-only entry on the portal itself,
// and GSTR-3B's outward-supply tables (3.1/3.2) auto-populate from an
// already-filed GSTR-1 and are non-editable. These reports give the owner/CA
// the numbers to cross-check against the portal, not a file to upload.
// ─────────────────────────────────────────────────────────────────────────────

export interface HSNSummaryRow {
  hsnCode: string; description: string; uqc: string
  totalQuantity: number; totalValue: number; taxableValue: number
  igstAmount: number; cgstAmount: number; sgstAmount: number
}

export interface HSNSummaryReport {
  period: string
  b2b: HSNSummaryRow[]
  b2c: HSNSummaryRow[]
  summary: { totalTaxableValue: number; totalTax: number; rowCount: number }
}

const NO_HSN_CODE = 'No HSN Code'

async function generateHSNSummaryReport(params: { dateFrom: string; dateTo: string }): Promise<HSNSummaryReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const invoices = await db.invoice.findMany({
    where: { invoiceDate: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
    include: {
      customer: { select: { taxNumber: true } },
      items: { include: { product: { select: { unit: true } } } }
    },
    orderBy: { invoiceDate: 'asc' }
  })

  const b2bMap = new Map<string, HSNSummaryRow>()
  const b2cMap = new Map<string, HSNSummaryRow>()

  for (const inv of invoices) {
    const isIgst = inv.gstType === 'IGST'
    const isB2B = Boolean(inv.customer?.taxNumber)
    const target = isB2B ? b2bMap : b2cMap
    // See generateSalesReport's totalDiscount comment — return items store
    // positive-magnitude quantity/discountAmount/taxAmount, net them out
    // here (matching analytics.service.ts's existing quantity-netting
    // convention, applied here to taxableValue/tax/quantity together for
    // this report's own internal consistency).
    const sign = inv.invoiceType === 'RETURN' ? -1 : 1

    for (const item of inv.items) {
      const hsnCode = item.hsnCode?.trim() || NO_HSN_CODE
      const rate = item.taxRate ?? 0
      const key = `${hsnCode}|${rate}`
      const taxableValue = sign * (item.unitPrice * item.quantity - item.discountAmount)
      const totalTax = sign * item.taxAmount
      const igst = isIgst ? totalTax : 0
      const cgst = isIgst ? 0 : totalTax / 2
      const sgst = isIgst ? 0 : totalTax / 2

      const existing = target.get(key) ?? {
        hsnCode, description: item.productName || '—', uqc: item.weightUnit || item.product.unit || 'PCS',
        totalQuantity: 0, totalValue: 0, taxableValue: 0, igstAmount: 0, cgstAmount: 0, sgstAmount: 0
      }
      existing.totalQuantity += sign * item.quantity
      existing.totalValue += item.lineTotal
      existing.taxableValue += taxableValue
      existing.igstAmount += igst
      existing.cgstAmount += cgst
      existing.sgstAmount += sgst
      target.set(key, existing)
    }
  }

  const b2b = Array.from(b2bMap.values())
  const b2c = Array.from(b2cMap.values())
  const allRows = [...b2b, ...b2c]
  const totalTaxableValue = allRows.reduce((s, r) => s + r.taxableValue, 0)
  const totalTax = allRows.reduce((s, r) => s + r.igstAmount + r.cgstAmount + r.sgstAmount, 0)

  return {
    period: `${params.dateFrom} to ${params.dateTo}`,
    b2b, b2c,
    summary: { totalTaxableValue, totalTax, rowCount: allRows.length }
  }
}

export interface DocumentSummaryRow {
  documentType: string; seriesPrefix: string
  fromNumber: string; toNumber: string; totalCount: number; cancelledCount: number
}

export interface DocumentSummaryReport {
  period: string
  rows: DocumentSummaryRow[]
}

async function generateDocumentSummaryReport(params: { dateFrom: string; dateTo: string }): Promise<DocumentSummaryReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const rows: DocumentSummaryRow[] = []

  const invoices = await db.invoice.findMany({
    where: { invoiceDate: { gte: from, lte: to } },
    select: { invoiceNumber: true, status: true },
    orderBy: { invoiceNumber: 'asc' }
  })
  if (invoices.length > 0) {
    rows.push({
      documentType: 'Invoice',
      seriesPrefix: invoices[0].invoiceNumber.split('-').slice(0, -1).join('-'),
      fromNumber: invoices[0].invoiceNumber,
      toNumber: invoices[invoices.length - 1].invoiceNumber,
      totalCount: invoices.length,
      cancelledCount: invoices.filter(i => i.status === 'CANCELLED').length
    })
  }

  const creditNotes = await db.creditNote.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { creditNoteNumber: true },
    orderBy: { creditNoteNumber: 'asc' }
  })
  if (creditNotes.length > 0) {
    rows.push({
      documentType: 'Credit Note',
      seriesPrefix: creditNotes[0].creditNoteNumber.split('-').slice(0, -1).join('-'),
      fromNumber: creditNotes[0].creditNoteNumber,
      toNumber: creditNotes[creditNotes.length - 1].creditNoteNumber,
      totalCount: creditNotes.length,
      cancelledCount: 0 // CreditNote has no cancellation concept in this schema — not fabricated
    })
  }

  const debitNotes = await db.debitNote.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { debitNoteNumber: true },
    orderBy: { debitNoteNumber: 'asc' }
  })
  if (debitNotes.length > 0) {
    rows.push({
      documentType: 'Debit Note',
      seriesPrefix: debitNotes[0].debitNoteNumber.split('-').slice(0, -1).join('-'),
      fromNumber: debitNotes[0].debitNoteNumber,
      toNumber: debitNotes[debitNotes.length - 1].debitNoteNumber,
      totalCount: debitNotes.length,
      cancelledCount: 0
    })
  }

  return { period: `${params.dateFrom} to ${params.dateTo}`, rows }
}

export interface GSTR3BStateRow { state: string; taxableValue: number; igstAmount: number }

export interface GSTR3BPreview {
  period: string
  table31: {
    taxableOutwardSupplies: number
    zeroRatedSupplies: number
    exemptNilNonGstSupplies: number
    taxAmount: { igst: number; cgst: number; sgst: number }
  }
  table32: GSTR3BStateRow[]
  notes: string[]
}

// Computed from the exact same underlying invoice data GSTR-1 itself is built
// from — if this preview's numbers don't match what the portal auto-populates
// from the owner's actually-filed GSTR-1, that mismatch is itself the useful
// signal (see spec Section 1: Table 3.1/3.2 are non-editable, auto-populated
// from GSTR-1 as of the Nov 2025 tax period).
async function generateGSTR3BPreview(params: { dateFrom: string; dateTo: string }): Promise<GSTR3BPreview> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const invoices = await db.invoice.findMany({
    where: { invoiceDate: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
    include: { customer: { select: { taxNumber: true, state: true } }, items: true },
    orderBy: { invoiceDate: 'asc' }
  })

  let taxableOutwardSupplies = 0
  let exemptNilNonGstSupplies = 0
  let igstTotal = 0, cgstTotal = 0, sgstTotal = 0
  const stateMap = new Map<string, GSTR3BStateRow>()

  for (const inv of invoices) {
    const isIgst = inv.gstType === 'IGST'
    const isB2B = Boolean(inv.customer?.taxNumber)
    const placeOfSupply = inv.buyerState ?? inv.customer?.state ?? 'Unknown'
    // See generateSalesReport's totalDiscount comment — return items store
    // positive-magnitude discountAmount/taxAmount, net them out here.
    const sign = inv.invoiceType === 'RETURN' ? -1 : 1

    for (const item of inv.items) {
      const taxableValue = sign * (item.unitPrice * item.quantity - item.discountAmount)
      if ((item.taxRate ?? 0) === 0) {
        exemptNilNonGstSupplies += taxableValue
        continue
      }
      taxableOutwardSupplies += taxableValue
      const totalTax = sign * item.taxAmount
      if (isIgst) igstTotal += totalTax
      else { cgstTotal += totalTax / 2; sgstTotal += totalTax / 2 }

      // Table 3.2 — inter-state supplies to unregistered persons/composition
      // dealers only (same B2CS scope generateGSTR1 already uses for this split)
      if (!isB2B && isIgst) {
        const existing = stateMap.get(placeOfSupply) ?? { state: placeOfSupply, taxableValue: 0, igstAmount: 0 }
        existing.taxableValue += taxableValue
        existing.igstAmount += totalTax
        stateMap.set(placeOfSupply, existing)
      }
    }
  }

  return {
    period: `${params.dateFrom} to ${params.dateTo}`,
    table31: {
      taxableOutwardSupplies,
      zeroRatedSupplies: 0, // this app has no export/SEZ invoice concept today — not fabricated
      exemptNilNonGstSupplies,
      taxAmount: { igst: igstTotal, cgst: cgstTotal, sgst: sgstTotal }
    },
    table32: Array.from(stateMap.values()),
    notes: [
      'Reverse-charge inward supplies (Table 3.1(d)) are not tracked by Sarang — enter manually if applicable.',
      'Input Tax Credit (Table 4) is not covered by this report — Sarang does not track purchase-side GST input credit.',
      'Table 5 (composition/exempt inward supplies from unregistered persons) is not tracked by Sarang.'
    ]
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Appointment Utilisation Report (Phase 35 — Service)
// ─────────────────────────────────────────────────────────────────────────────

export interface AppointmentUtilisationByProvider {
  providerName: string; total: number; completed: number; cancelled: number; noShow: number; completionRate: number
}

export interface AppointmentUtilisationRow {
  appointmentNumber: string; date: string; time: string; customer: string
  provider: string; service: string; status: string; durationMinutes: number
}

export interface AppointmentUtilisationReport {
  dateFrom: string; dateTo: string
  summary: { total: number; completed: number; cancelled: number; noShow: number; active: number; completionRate: number }
  byProvider: AppointmentUtilisationByProvider[]
  byDayOfWeek: { day: string; count: number }[]
  byHour: { hour: string; count: number }[]
  rows: AppointmentUtilisationRow[]
}

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

async function generateAppointmentUtilisationReport(params: {
  dateFrom: string; dateTo: string; providerId?: string
}): Promise<AppointmentUtilisationReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const appointments = await db.appointment.findMany({
    where: {
      scheduledDate: { gte: from, lte: to },
      ...(params.providerId ? { providerId: params.providerId } : {}),
    },
    include: {
      provider: { select: { fullName: true } },
      customer: { select: { customerName: true } },
    },
    orderBy: { scheduledDate: 'asc' },
  })

  const total = appointments.length
  const completed = appointments.filter(a => a.status === 'COMPLETED').length
  const cancelled = appointments.filter(a => a.status === 'CANCELLED').length
  const noShow = appointments.filter(a => a.status === 'NO_SHOW').length
  // SCHEDULED, CONFIRMED, and IN_PROGRESS all count as "active" (not yet resolved)
  const active = total - completed - cancelled - noShow
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

  const providerMap = new Map<string, AppointmentUtilisationByProvider>()
  for (const a of appointments) {
    const key = a.providerId ?? '__none__'
    const name = a.provider?.fullName ?? 'Unassigned'
    const existing = providerMap.get(key) ?? { providerName: name, total: 0, completed: 0, cancelled: 0, noShow: 0, completionRate: 0 }
    existing.total += 1
    if (a.status === 'COMPLETED') existing.completed += 1
    if (a.status === 'CANCELLED') existing.cancelled += 1
    if (a.status === 'NO_SHOW') existing.noShow += 1
    providerMap.set(key, existing)
  }
  const byProvider = Array.from(providerMap.values())
    .map(p => ({ ...p, completionRate: p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total)

  const dowMap = new Map<number, number>()
  for (const a of appointments) {
    const dow = new Date(a.scheduledDate).getDay()
    dowMap.set(dow, (dowMap.get(dow) ?? 0) + 1)
  }
  const byDayOfWeek = [0, 1, 2, 3, 4, 5, 6]
    .map(d => ({ day: DOW_NAMES[d], count: dowMap.get(d) ?? 0 }))
    .filter(d => d.count > 0)

  const hourMap = new Map<string, number>()
  for (const a of appointments) {
    const hourPart = (a.scheduledTime ?? '00:00').split(':')[0].padStart(2, '0')
    const label = `${hourPart}:00`
    hourMap.set(label, (hourMap.get(label) ?? 0) + 1)
  }
  const byHour = Array.from(hourMap.entries())
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour.localeCompare(b.hour))

  const rows: AppointmentUtilisationRow[] = appointments.map(a => ({
    appointmentNumber: a.appointmentNumber,
    date: new Date(a.scheduledDate).toISOString().slice(0, 10),
    time: a.scheduledTime,
    customer: a.customer?.customerName ?? a.customerName ?? 'Walk-in',
    provider: a.provider?.fullName ?? 'Unassigned',
    service: a.serviceTitle,
    status: a.status,
    durationMinutes: a.durationMinutes,
  }))

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: { total, completed, cancelled, noShow, active, completionRate },
    byProvider, byDayOfWeek, byHour, rows,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Client Retention Report (Phase 35 — Service)
// ─────────────────────────────────────────────────────────────────────────────

export interface ClientRetentionRow {
  customerName: string; phone: string | null
  firstVisitEver: string; lastVisit: string; visitsInPeriod: number; isNew: boolean; atRisk: boolean
}

export interface ClientRetentionReport {
  dateFrom: string; dateTo: string
  summary: { totalUnique: number; newClients: number; returningClients: number; retentionRate: number; atRiskCount: number }
  rows: ClientRetentionRow[]
}

async function generateClientRetentionReport(params: { dateFrom: string; dateTo: string }): Promise<ClientRetentionReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)
  // "At risk" is relative to the end of the period being viewed, not wall-clock
  // now — otherwise a historical report (e.g. for a month 90 days ago) would
  // mark nearly every client "at risk" just because today is far past that
  // period, regardless of whether they were actually overdue at the time.
  const atRiskCutoff = new Date(to); atRiskCutoff.setDate(atRiskCutoff.getDate() - 30)

  // Exclude CANCELLED and NO_SHOW — only appointments where the client actually attended (or is expected to attend)
  const attendedFilter = { notIn: ['CANCELLED', 'NO_SHOW'] }

  const inPeriod = await db.appointment.findMany({
    where: { scheduledDate: { gte: from, lte: to }, customerId: { not: null }, status: attendedFilter },
    select: { customerId: true, scheduledDate: true },
  })

  if (inPeriod.length === 0) {
    return { dateFrom: params.dateFrom, dateTo: params.dateTo, summary: { totalUnique: 0, newClients: 0, returningClients: 0, retentionRate: 0, atRiskCount: 0 }, rows: [] }
  }

  const uniqueIds = [...new Set(inPeriod.map(a => a.customerId as string))]

  const allVisits = await db.appointment.findMany({
    where: { customerId: { in: uniqueIds }, status: attendedFilter },
    select: { customerId: true, scheduledDate: true },
    orderBy: { scheduledDate: 'asc' },
  })

  type CustData = { firstEver: Date; lastVisit: Date; visitsInPeriod: number }
  const custMap = new Map<string, CustData>()
  for (const a of allVisits) {
    const cid = a.customerId as string
    const existing = custMap.get(cid)
    if (!existing) {
      custMap.set(cid, { firstEver: a.scheduledDate, lastVisit: a.scheduledDate, visitsInPeriod: 0 })
    } else {
      if (a.scheduledDate > existing.lastVisit) existing.lastVisit = a.scheduledDate
    }
  }
  for (const a of inPeriod) {
    const cid = a.customerId as string
    const d = custMap.get(cid)
    if (d) d.visitsInPeriod += 1
  }

  const customers = await db.customer.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, customerName: true, phone: true },
  })
  const custDetails = new Map(customers.map(c => [c.id, c]))

  let newClients = 0, returningClients = 0, atRiskCount = 0
  const rows: ClientRetentionRow[] = []
  for (const cid of uniqueIds) {
    const data = custMap.get(cid)
    if (!data) continue
    const details = custDetails.get(cid)
    const isNew = data.firstEver >= from && data.firstEver <= to
    const atRisk = data.lastVisit < atRiskCutoff
    if (isNew) newClients++; else returningClients++
    if (atRisk) atRiskCount++
    rows.push({
      customerName: details?.customerName ?? 'Unknown',
      phone: details?.phone ?? null,
      firstVisitEver: data.firstEver.toISOString().slice(0, 10),
      lastVisit: data.lastVisit.toISOString().slice(0, 10),
      visitsInPeriod: data.visitsInPeriod, isNew, atRisk,
    })
  }
  rows.sort((a, b) => b.visitsInPeriod - a.visitsInPeriod)

  const totalUnique = uniqueIds.length
  const retentionRate = totalUnique > 0 ? Math.round((returningClients / totalUnique) * 100) : 0
  return { dateFrom: params.dateFrom, dateTo: params.dateTo, summary: { totalUnique, newClients, returningClients, retentionRate, atRiskCount }, rows }
}

// ─────────────────────────────────────────────────────────────────────────────
// Commission Report (Phase 35 — Service)
// ─────────────────────────────────────────────────────────────────────────────

export interface CommissionByStaff {
  staffName: string; serviceRevenue: number; commissionAmount: number; tipAmount: number
  paidAmount: number; unpaidAmount: number; recordCount: number
}

export interface CommissionReportRow {
  staffName: string; period: string; serviceRevenue: number; commissionAmount: number
  tipAmount: number; commissionType: string; commissionRate: number; isPaid: boolean; paidDate: string | null
}

export interface CommissionReport {
  dateFrom: string; dateTo: string
  summary: { totalCommission: number; totalTips: number; totalServiceRevenue: number; paidAmount: number; unpaidAmount: number; recordCount: number }
  byStaff: CommissionByStaff[]
  rows: CommissionReportRow[]
}

async function generateCommissionReport(params: { dateFrom: string; dateTo: string; staffId?: string }): Promise<CommissionReport> {
  const db = getPrisma()
  // Filter by period (YYYY-MM) — commissions belong to a billing month and may be inserted
  // slightly after month-end when payroll is processed, so createdAt would be wrong here.
  const fromPeriod = params.dateFrom.slice(0, 7)
  const toPeriod = params.dateTo.slice(0, 7)

  const records = await db.staffCommission.findMany({
    where: {
      period: { gte: fromPeriod, lte: toPeriod },
      ...(params.staffId ? { staffId: params.staffId } : {}),
    },
    include: { staff: { select: { fullName: true } } },
    orderBy: [{ period: 'asc' }, { createdAt: 'asc' }],
  })

  const totalCommission = records.reduce((s, r) => s + Number(r.commissionAmount), 0)
  const totalTips = records.reduce((s, r) => s + Number(r.tipAmount), 0)
  const totalServiceRevenue = records.reduce((s, r) => s + Number(r.serviceRevenue), 0)
  const paidAmount = records.filter(r => r.isPaid).reduce((s, r) => s + Number(r.commissionAmount), 0)
  const unpaidAmount = totalCommission - paidAmount

  const staffMap = new Map<string, CommissionByStaff>()
  for (const r of records) {
    const existing = staffMap.get(r.staffId) ?? { staffName: r.staff.fullName, serviceRevenue: 0, commissionAmount: 0, tipAmount: 0, paidAmount: 0, unpaidAmount: 0, recordCount: 0 }
    existing.serviceRevenue += Number(r.serviceRevenue)
    existing.commissionAmount += Number(r.commissionAmount)
    existing.tipAmount += Number(r.tipAmount)
    if (r.isPaid) existing.paidAmount += Number(r.commissionAmount)
    else existing.unpaidAmount += Number(r.commissionAmount)
    existing.recordCount += 1
    staffMap.set(r.staffId, existing)
  }
  const byStaff = Array.from(staffMap.values()).sort((a, b) => b.commissionAmount - a.commissionAmount)

  const rows: CommissionReportRow[] = records.map(r => ({
    staffName: r.staff.fullName,
    period: r.period,
    serviceRevenue: Number(r.serviceRevenue),
    commissionAmount: Number(r.commissionAmount),
    tipAmount: Number(r.tipAmount),
    commissionType: r.commissionType,
    commissionRate: Number(r.commissionRate),
    isPaid: r.isPaid,
    paidDate: r.paidDate ? r.paidDate.toISOString().slice(0, 10) : null,
  }))

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: { totalCommission, totalTips, totalServiceRevenue, paidAmount, unpaidAmount, recordCount: records.length },
    byStaff, rows,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Order Volume Report (Phase 54 — Restaurant QR Table Ordering)
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderVolumeByDay { date: string; pending: number; accepted: number; rejected: number; total: number }
export interface OrderVolumeRow { createdAt: string; tableLabel: string; status: string; itemCount: number; resolvedAt: string | null }

export interface OrderVolumeReport {
  dateFrom: string; dateTo: string
  summary: { totalOrders: number; accepted: number; rejected: number; pending: number; acceptanceRate: number }
  byDay: OrderVolumeByDay[]
  rows: OrderVolumeRow[]
}

async function generateOrderVolumeReport(params: { dateFrom: string; dateTo: string }): Promise<OrderVolumeReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const orders = await db.tableOrderRequest.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: { table: { select: { tableNumber: true, tableName: true } }, items: { select: { quantity: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const accepted = orders.filter(o => o.status === 'ACCEPTED').length
  const rejected = orders.filter(o => o.status === 'REJECTED').length
  const pending = orders.filter(o => o.status === 'PENDING').length
  const resolved = accepted + rejected
  const acceptanceRate = resolved > 0 ? Math.round((accepted / resolved) * 100) : 0

  const dayMap = new Map<string, OrderVolumeByDay>()
  for (const o of orders) {
    const day = o.createdAt.toISOString().slice(0, 10)
    const existing = dayMap.get(day) ?? { date: day, pending: 0, accepted: 0, rejected: 0, total: 0 }
    if (o.status === 'ACCEPTED') existing.accepted += 1
    else if (o.status === 'REJECTED') existing.rejected += 1
    else existing.pending += 1
    existing.total += 1
    dayMap.set(day, existing)
  }
  const byDay = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  const rows: OrderVolumeRow[] = orders.map(o => ({
    createdAt: o.createdAt.toISOString(),
    tableLabel: o.table.tableName ?? `Table ${o.table.tableNumber}`,
    status: o.status,
    itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
    resolvedAt: o.resolvedAt ? o.resolvedAt.toISOString() : null,
  }))

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: { totalOrders: orders.length, accepted, rejected, pending, acceptanceRate },
    byDay, rows,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch & Expiry Report (Phase 54 — any business with batch_tracking: Agri Inputs, Pharmacy, etc.)
// ─────────────────────────────────────────────────────────────────────────────

export type ExpiryBucketId = 'expired' | 'critical' | 'warning' | 'safe'
export interface BatchExpiryBucket { bucket: ExpiryBucketId; label: string; count: number; quantityRemaining: number }
export interface BatchExpiryRow {
  productName: string; batchNumber: string; expiryDate: string; daysToExpiry: number
  quantityRemaining: number; bucket: ExpiryBucketId; unitCost: number; supplierName: string | null
}

export interface BatchExpiryReport {
  generatedAt: string
  summary: { totalBatches: number; expiredCount: number; criticalCount: number; warningCount: number; safeCount: number; expiredValue: number }
  buckets: BatchExpiryBucket[]
  rows: BatchExpiryRow[]
}

function bucketForDaysToExpiry(days: number): ExpiryBucketId {
  if (days < 0) return 'expired'
  if (days <= 7) return 'critical'
  if (days <= 30) return 'warning'
  return 'safe'
}

async function generateBatchExpiryReport(): Promise<BatchExpiryReport> {
  const db = getPrisma()
  const now = new Date()

  const batches = await db.productBatch.findMany({
    where: { isActive: true, quantityRemaining: { gt: 0 } },
    include: { product: { select: { productName: true } }, supplier: { select: { supplierName: true } } },
    orderBy: { expiryDate: 'asc' },
  })

  const rows: BatchExpiryRow[] = batches.map(b => {
    const daysToExpiry = Math.ceil((b.expiryDate.getTime() - now.getTime()) / 86400000)
    return {
      productName: b.product.productName, batchNumber: b.batchNumber,
      expiryDate: b.expiryDate.toISOString(), daysToExpiry,
      quantityRemaining: b.quantityRemaining, bucket: bucketForDaysToExpiry(daysToExpiry),
      unitCost: b.unitCost, supplierName: b.supplier?.supplierName ?? null,
    }
  })

  const bucketDefs: { id: ExpiryBucketId; label: string }[] = [
    { id: 'expired', label: 'Expired' },
    { id: 'critical', label: 'Expiring ≤ 7 days' },
    { id: 'warning', label: 'Expiring 8–30 days' },
    { id: 'safe', label: 'Safe (> 30 days)' },
  ]
  const buckets: BatchExpiryBucket[] = bucketDefs.map(d => {
    const inBucket = rows.filter(r => r.bucket === d.id)
    return { bucket: d.id, label: d.label, count: inBucket.length, quantityRemaining: inBucket.reduce((s, r) => s + r.quantityRemaining, 0) }
  })

  const expiredValue = rows.filter(r => r.bucket === 'expired').reduce((s, r) => s + r.quantityRemaining * r.unitCost, 0)

  return {
    generatedAt: now.toISOString(),
    summary: {
      totalBatches: rows.length,
      expiredCount: buckets[0].count, criticalCount: buckets[1].count,
      warningCount: buckets[2].count, safeCount: buckets[3].count,
      expiredValue,
    },
    buckets, rows,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lab Test Throughput Report (Phase 54 — Diagnostic & Pathology Labs)
// ─────────────────────────────────────────────────────────────────────────────

const LAB_STAGE_ORDER = ['ORDERED', 'SAMPLE_COLLECTED', 'IN_PROCESS', 'REPORTED', 'DELIVERED'] as const
const LAB_STAGE_LABELS: Record<string, string> = {
  ORDERED: 'Ordered', SAMPLE_COLLECTED: 'Sample Collected', IN_PROCESS: 'In Process',
  REPORTED: 'Reported', DELIVERED: 'Delivered', CANCELLED: 'Cancelled',
}

export interface LabThroughputStage { status: string; label: string; count: number }
export interface LabThroughputRow {
  orderNumber: string; patientName: string; status: string
  createdAt: string; reportedAt: string | null; turnaroundHours: number | null
}

export interface LabThroughputReport {
  dateFrom: string; dateTo: string
  summary: { totalOrders: number; delivered: number; cancelled: number; pendingCount: number; avgTurnaroundHours: number | null }
  byStatus: LabThroughputStage[]
  rows: LabThroughputRow[]
}

async function generateLabThroughputReport(params: { dateFrom: string; dateTo: string }): Promise<LabThroughputReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const orders = await db.labTestOrder.findMany({
    where: { createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: 'asc' },
  })

  const delivered = orders.filter(o => o.status === 'DELIVERED').length
  const cancelled = orders.filter(o => o.status === 'CANCELLED').length
  const pendingCount = orders.length - delivered - cancelled

  const turnarounds = orders
    .filter(o => o.reportedAt)
    .map(o => (o.reportedAt!.getTime() - o.createdAt.getTime()) / 3600000)
  const avgTurnaroundHours = turnarounds.length > 0
    ? Math.round((turnarounds.reduce((s, h) => s + h, 0) / turnarounds.length) * 10) / 10
    : null

  const byStatus: LabThroughputStage[] = [...LAB_STAGE_ORDER, 'CANCELLED'].map(status => ({
    status, label: LAB_STAGE_LABELS[status], count: orders.filter(o => o.status === status).length,
  }))

  const rows: LabThroughputRow[] = orders.map(o => ({
    orderNumber: o.orderNumber, patientName: o.patientName, status: o.status,
    createdAt: o.createdAt.toISOString(), reportedAt: o.reportedAt ? o.reportedAt.toISOString() : null,
    turnaroundHours: o.reportedAt ? Math.round(((o.reportedAt.getTime() - o.createdAt.getTime()) / 3600000) * 10) / 10 : null,
  }))

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: { totalOrders: orders.length, delivered, cancelled, pendingCount, avgTurnaroundHours },
    byStatus, rows,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Blood Stock Report (Phase 54 — Blood Bank; reuses bloodBankService.getBloodStock)
// ─────────────────────────────────────────────────────────────────────────────

export interface BloodStockByGroup { bloodGroup: string; available: number; expiringSoon: number }
export interface BloodStockReportRow {
  donationNumber: string; bloodGroup: string; componentType: string
  expiryDate: string; daysToExpiry: number; isExpiringSoon: boolean
}

export interface BloodStockReport {
  generatedAt: string
  summary: { totalAvailable: number; totalExpiringSoon: number; groupsWithNoStock: string[] }
  byGroup: BloodStockByGroup[]
  rows: BloodStockReportRow[]
}

const ALL_BLOOD_GROUPS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']

async function generateBloodStockReport(): Promise<BloodStockReport> {
  const { getBloodStock } = await import('./blood-bank.service')
  const result = await getBloodStock()
  const units = result.data?.units ?? []

  const groupMap = new Map<string, BloodStockByGroup>()
  for (const g of ALL_BLOOD_GROUPS) groupMap.set(g, { bloodGroup: g, available: 0, expiringSoon: 0 })
  for (const u of units) {
    const existing = groupMap.get(u.bloodGroup) ?? { bloodGroup: u.bloodGroup, available: 0, expiringSoon: 0 }
    if (!u.isExpired) existing.available += 1
    if (u.isExpiringSoon) existing.expiringSoon += 1
    groupMap.set(u.bloodGroup, existing)
  }
  const byGroup = ALL_BLOOD_GROUPS.map(g => groupMap.get(g)!)

  const rows: BloodStockReportRow[] = units
    .filter(u => !u.isExpired)
    .map(u => ({
      donationNumber: u.donationNumber, bloodGroup: u.bloodGroup, componentType: u.componentType,
      expiryDate: u.expiryDate, daysToExpiry: u.daysToExpiry, isExpiringSoon: u.isExpiringSoon,
    }))

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalAvailable: byGroup.reduce((s, g) => s + g.available, 0),
      totalExpiringSoon: byGroup.reduce((s, g) => s + g.expiringSoon, 0),
      groupsWithNoStock: byGroup.filter(g => g.available === 0).map(g => g.bloodGroup),
    },
    byGroup, rows,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Jewellery Report (fresh-audit fix, 2026-07-12 — Jewellery had zero reports
// despite Metal Rates/Metal Exchange being real, separate features. Stock
// valuation is netWeight × today's rate, NOT the generic Inventory Report's
// quantity × costPrice, which is meaningless for a metal item.)
// ─────────────────────────────────────────────────────────────────────────────

export interface JewelleryStockRow { metalType: string; purity: string; netWeightGrams: number; ratePerGram: number | null; valuationAmount: number }
export interface JewelleryReport {
  dateFrom: string; dateTo: string
  stockByMetal: JewelleryStockRow[]
  summary: {
    totalStockValuationGrams: number
    totalStockValuationAmount: number
    totalMakingChargeRevenue: number
    totalExchangeCount: number
    totalExchangeValueGiven: number
    metalsWithNoRateSet: string[]
  }
}

async function generateJewelleryReport(params: { dateFrom: string; dateTo: string }): Promise<JewelleryReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const products = await db.product.findMany({
    where: { isActive: true, metalType: { not: null } },
    select: { metalType: true, purity: true, netWeight: true }
  })
  const rates = await db.metalRate.findMany()
  const rateMap = new Map(rates.map(r => [`${r.metalType}|${r.purity}`, r.ratePerGram]))

  const groupMap = new Map<string, JewelleryStockRow>()
  for (const p of products) {
    if (!p.metalType || !p.purity) continue
    const key = `${p.metalType}|${p.purity}`
    const rate = rateMap.get(key) ?? null
    const existing = groupMap.get(key) ?? { metalType: p.metalType, purity: p.purity, netWeightGrams: 0, ratePerGram: rate, valuationAmount: 0 }
    existing.netWeightGrams += p.netWeight ?? 0
    groupMap.set(key, existing)
  }
  const stockByMetal = Array.from(groupMap.values()).map(g => ({ ...g, valuationAmount: g.ratePerGram ? g.netWeightGrams * g.ratePerGram : 0 }))

  // Making-charge revenue over the selected range — snapshotted on InvoiceItem
  // at sale time (see billing.service.ts), not re-derived from current rates.
  const jewelleryItems = await db.invoiceItem.findMany({
    where: {
      jewelleryMetalType: { not: null },
      invoice: { invoiceDate: { gte: from, lte: to }, status: { not: 'CANCELLED' } }
    },
    select: { jewelleryMakingCharge: true, quantity: true }
  })
  const totalMakingChargeRevenue = jewelleryItems.reduce((s, i) => s + (i.jewelleryMakingCharge ?? 0) * i.quantity, 0)

  const exchanges = await db.metalExchange.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { valueGiven: true }
  })

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    stockByMetal,
    summary: {
      totalStockValuationGrams: stockByMetal.reduce((s, g) => s + g.netWeightGrams, 0),
      totalStockValuationAmount: stockByMetal.reduce((s, g) => s + g.valuationAmount, 0),
      totalMakingChargeRevenue,
      totalExchangeCount: exchanges.length,
      totalExchangeValueGiven: exchanges.reduce((s, e) => s + e.valueGiven, 0),
      metalsWithNoRateSet: stockByMetal.filter(g => g.ratePerGram === null).map(g => `${g.metalType} ${g.purity}`),
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Logistics Report (Phase 54B — reuses logisticsAnalyticsService.getLogisticsAnalytics,
// serving every product business type with LOGISTICS_MODULES enabled)
// ─────────────────────────────────────────────────────────────────────────────

export interface LogisticsReportTrendRow { month: string; count: number; freight: number }
export interface LogisticsReportCarrier { name: string; count: number }
export interface LogisticsReportStatusRow { status: string; count: number }

export interface LogisticsReport {
  dateFrom: string; dateTo: string
  summary: {
    totalShipments: number; deliveryRate: number; avgDeliveryDays: number
    totalFreight: number; freightPending: number; totalGRNValue: number; activeCarriers: number
  }
  monthlyTrend: LogisticsReportTrendRow[]
  topCarriers: LogisticsReportCarrier[]
  shipmentsByStatus: LogisticsReportStatusRow[]
}

async function generateLogisticsReport(params: { dateFrom: string; dateTo: string }): Promise<LogisticsReport> {
  const { getLogisticsAnalytics } = await import('./logistics-analytics.service')
  const result = await getLogisticsAnalytics({ fromDate: params.dateFrom, toDate: params.dateTo })
  if (!result.success || !result.data) throw new Error(result.error?.message ?? 'Could not load logistics analytics.')
  const d = result.data

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      totalShipments: d.shipments.total, deliveryRate: d.shipments.deliveryRate, avgDeliveryDays: d.shipments.avgDeliveryDays,
      totalFreight: d.freight.total, freightPending: d.freight.pending, totalGRNValue: d.grns.totalValue, activeCarriers: d.fleet.activeCarriers,
    },
    monthlyTrend: d.monthlyShipments,
    topCarriers: d.topCarriers.map(c => ({ name: c.name, count: c.count })),
    shipmentsByStatus: Object.entries(d.shipments.byStatus).map(([status, count]) => ({ status, count: count as number })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HR / Attendance Report (Phase 54B — universal, no requiredModule; Phase 17's
// Attendance module has no report of its own despite being on every business type)
// ─────────────────────────────────────────────────────────────────────────────

export interface AttendanceByEmployee { employeeName: string; present: number; absent: number; halfDay: number; leave: number; attendanceRate: number }
export interface AttendanceReportRow { employeeName: string; date: string; status: string; checkIn: string | null; checkOut: string | null }

export interface AttendanceReport {
  dateFrom: string; dateTo: string
  summary: { totalRecords: number; presentCount: number; absentCount: number; leaveCount: number; overallAttendanceRate: number }
  byEmployee: AttendanceByEmployee[]
  rows: AttendanceReportRow[]
}

async function generateAttendanceReport(params: { dateFrom: string; dateTo: string }): Promise<AttendanceReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const records = await db.attendance.findMany({
    where: { date: { gte: from, lte: to } },
    include: { employee: { select: { fullName: true } } },
    orderBy: { date: 'asc' },
  })

  const presentCount = records.filter(r => r.status === 'PRESENT').length
  const absentCount = records.filter(r => r.status === 'ABSENT').length
  const leaveCount = records.filter(r => r.status === 'LEAVE').length
  // HOLIDAY/WEEK_OFF are non-working days — excluding them from the rate
  // denominator avoids a business with 2 weekly offs looking artificially
  // less attendant than one with none.
  const countableForRate = records.filter(r => r.status !== 'HOLIDAY' && r.status !== 'WEEK_OFF')
  const overallAttendanceRate = countableForRate.length
    ? Math.round((countableForRate.filter(r => r.status === 'PRESENT' || r.status === 'HALF_DAY').length / countableForRate.length) * 100)
    : 0

  const empMap = new Map<string, AttendanceByEmployee>()
  for (const r of countableForRate) {
    const name = r.employee.fullName
    const e = empMap.get(name) ?? { employeeName: name, present: 0, absent: 0, halfDay: 0, leave: 0, attendanceRate: 0 }
    if (r.status === 'PRESENT') e.present += 1
    else if (r.status === 'ABSENT') e.absent += 1
    else if (r.status === 'HALF_DAY') e.halfDay += 1
    else if (r.status === 'LEAVE') e.leave += 1
    empMap.set(name, e)
  }
  const byEmployee = Array.from(empMap.values())
    .map(e => {
      const total = e.present + e.absent + e.halfDay + e.leave
      return { ...e, attendanceRate: total > 0 ? Math.round(((e.present + e.halfDay * 0.5) / total) * 100) : 0 }
    })
    .sort((a, b) => b.attendanceRate - a.attendanceRate)

  const rows: AttendanceReportRow[] = records.map(r => ({
    employeeName: r.employee.fullName, date: r.date.toISOString().slice(0, 10),
    status: r.status, checkIn: r.checkIn, checkOut: r.checkOut,
  }))

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: { totalRecords: records.length, presentCount, absentCount, leaveCount, overallAttendanceRate },
    byEmployee, rows,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Manufacturing Production Report (Phase 54B — MANUFACTURING had 8 dedicated
// modules — BOM, production orders/analytics, work orders, dispatch, finished
// goods, vendor management — and zero reports reflecting any of them)
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductionByStatusRow { status: string; count: number }
export interface ProductionReportRow {
  orderNumber: string; productName: string; plannedQty: number; producedQty: number
  status: string; startDate: string | null; completedDate: string | null
}

export interface ProductionReport {
  dateFrom: string; dateTo: string
  summary: { totalOrders: number; completed: number; inProgress: number; totalPlannedQty: number; totalProducedQty: number; completionRate: number }
  byStatus: ProductionByStatusRow[]
  rows: ProductionReportRow[]
}

async function generateProductionReport(params: { dateFrom: string; dateTo: string }): Promise<ProductionReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const orders = await db.productionOrder.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: { product: { select: { productName: true } } },
    orderBy: { createdAt: 'asc' },
  })

  const completed = orders.filter(o => o.status === 'COMPLETED').length
  const inProgress = orders.filter(o => o.status === 'IN_PROGRESS').length
  const totalPlannedQty = orders.reduce((s, o) => s + o.plannedQty, 0)
  const totalProducedQty = orders.reduce((s, o) => s + o.producedQty, 0)
  const completionRate = orders.length > 0 ? Math.round((completed / orders.length) * 100) : 0

  const statusMap = new Map<string, number>()
  for (const o of orders) statusMap.set(o.status, (statusMap.get(o.status) ?? 0) + 1)
  const byStatus = Array.from(statusMap.entries()).map(([status, count]) => ({ status, count }))

  const rows: ProductionReportRow[] = orders.map(o => ({
    orderNumber: o.orderNumber, productName: o.product.productName,
    plannedQty: o.plannedQty, producedQty: o.producedQty, status: o.status,
    startDate: o.startDate ? o.startDate.toISOString().slice(0, 10) : null,
    completedDate: o.completedDate ? o.completedDate.toISOString().slice(0, 10) : null,
  }))

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: { totalOrders: orders.length, completed, inProgress, totalPlannedQty, totalProducedQty, completionRate },
    byStatus, rows,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Serial & Warranty Report (Phase 54B — closes ELECTRONICS's zero-report gap
// despite serial_tracking/imei_tracking/warranty_tracking being enabled)
// ─────────────────────────────────────────────────────────────────────────────

export type WarrantyBucketId = 'expired' | 'expiringSoon' | 'active' | 'noWarranty'
export interface SerialWarrantyBucket { bucket: WarrantyBucketId; count: number }
export interface SerialWarrantyRow {
  serialNumber: string; productName: string; status: string
  warrantyExpiryDate: string | null; daysToExpiry: number | null
}

export interface SerialWarrantyReport {
  generatedAt: string
  summary: { totalSerials: number; inStock: number; sold: number; warrantyExpiringSoon: number; warrantyExpired: number }
  buckets: SerialWarrantyBucket[]
  rows: SerialWarrantyRow[]
}

async function generateSerialWarrantyReport(): Promise<SerialWarrantyReport> {
  const db = getPrisma()
  const now = new Date()

  const serials = await db.productSerial.findMany({
    include: { product: { select: { productName: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const rows: SerialWarrantyRow[] = serials.map(s => {
    const daysToExpiry = s.warrantyExpiryDate ? Math.ceil((s.warrantyExpiryDate.getTime() - now.getTime()) / 86400000) : null
    return {
      serialNumber: s.serialNumber, productName: s.product.productName, status: s.status,
      warrantyExpiryDate: s.warrantyExpiryDate ? s.warrantyExpiryDate.toISOString() : null, daysToExpiry,
    }
  })

  const inStock = serials.filter(s => s.status === 'AVAILABLE').length
  const sold = serials.filter(s => s.status === 'SOLD').length
  const warrantyExpiringSoon = rows.filter(r => r.daysToExpiry !== null && r.daysToExpiry >= 0 && r.daysToExpiry <= 30).length
  const warrantyExpired = rows.filter(r => r.daysToExpiry !== null && r.daysToExpiry < 0).length
  const noWarranty = rows.filter(r => r.daysToExpiry === null).length
  const active = rows.length - warrantyExpiringSoon - warrantyExpired - noWarranty

  return {
    generatedAt: now.toISOString(),
    summary: { totalSerials: serials.length, inStock, sold, warrantyExpiringSoon, warrantyExpired },
    buckets: [
      { bucket: 'expired', count: warrantyExpired },
      { bucket: 'expiringSoon', count: warrantyExpiringSoon },
      { bucket: 'active', count: active },
      { bucket: 'noWarranty', count: noWarranty },
    ],
    rows,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Variant Stock Report (Phase 54B — closes CLOTHING/FOOTWEAR's zero-report gap
// despite variant_tracking being enabled)
// ─────────────────────────────────────────────────────────────────────────────

export interface VariantStockRow { productName: string; size: string | null; color: string | null; sku: string | null; stockQty: number }

export interface VariantStockReport {
  generatedAt: string
  summary: { totalVariants: number; totalStockQty: number; outOfStockVariants: number }
  rows: VariantStockRow[]
}

async function generateVariantStockReport(): Promise<VariantStockReport> {
  const db = getPrisma()

  const variants = await db.productVariant.findMany({
    where: { isActive: true },
    include: { product: { select: { productName: true } } },
    orderBy: [{ product: { productName: 'asc' } }, { size: 'asc' }],
  })

  const rows: VariantStockRow[] = variants.map(v => ({
    productName: v.product.productName, size: v.size, color: v.color, sku: v.sku, stockQty: v.stockQty,
  }))

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalVariants: variants.length,
      totalStockQty: rows.reduce((s, r) => s + r.stockQty, 0),
      outOfStockVariants: rows.filter(r => r.stockQty <= 0).length,
    },
    rows,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Score / Academic Performance Report (Phase 54F — F.14 closed a gap
// with no report companion: the new StudentTestScore data had nowhere to be
// reviewed in aggregate across a batch/institute, only row-by-row on
// TestScoresScreen. Optional dateFrom/dateTo scopes to a term/period; a batch
// filter is left to the client (batchId already round-trips through
// listTestScores) rather than duplicated here.
// ─────────────────────────────────────────────────────────────────────────────

export interface TestScoreReportRow {
  studentName: string; batchName: string; subject: string | null; testName: string
  marksObtained: number; maxMarks: number; percentage: number; grade: string | null; testDate: string
}

export interface TestScoreReportStudentSummary {
  studentName: string; testCount: number; averagePercentage: number
}

export interface TestScoreReport {
  generatedAt: string
  summary: { totalTests: number; averagePercentage: number; belowFiftyCount: number; studentCount: number }
  studentSummaries: TestScoreReportStudentSummary[]
  rows: TestScoreReportRow[]
}

async function generateTestScoreReport(params: { dateFrom?: string; dateTo?: string; batchId?: string }): Promise<TestScoreReport> {
  const db = getPrisma()

  const where: Record<string, unknown> = {}
  if (params.dateFrom || params.dateTo) {
    where.testDate = {
      ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
      ...(params.dateTo ? { lte: new Date(params.dateTo) } : {}),
    }
  }
  if (params.batchId) where.enrollment = { batchId: params.batchId }

  const scores = await db.studentTestScore.findMany({
    where,
    include: { enrollment: { include: { student: { select: { customerName: true } }, batch: { select: { batchName: true } } } } },
    orderBy: { testDate: 'desc' },
  })

  const rows: TestScoreReportRow[] = scores.map(s => ({
    studentName: s.enrollment.student.customerName,
    batchName: s.enrollment.batch.batchName,
    subject: s.subject,
    testName: s.testName,
    marksObtained: s.marksObtained,
    maxMarks: s.maxMarks,
    percentage: Math.round((s.marksObtained / s.maxMarks) * 1000) / 10,
    grade: s.grade,
    testDate: s.testDate.toISOString(),
  }))

  const byStudent = new Map<string, { count: number; pctSum: number }>()
  for (const r of rows) {
    const entry = byStudent.get(r.studentName) ?? { count: 0, pctSum: 0 }
    entry.count += 1
    entry.pctSum += r.percentage
    byStudent.set(r.studentName, entry)
  }
  const studentSummaries: TestScoreReportStudentSummary[] = [...byStudent.entries()]
    .map(([studentName, { count, pctSum }]) => ({ studentName, testCount: count, averagePercentage: Math.round((pctSum / count) * 10) / 10 }))
    .sort((a, b) => b.averagePercentage - a.averagePercentage)

  const averagePercentage = rows.length ? Math.round((rows.reduce((s, r) => s + r.percentage, 0) / rows.length) * 10) / 10 : 0

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalTests: rows.length,
      averagePercentage,
      belowFiftyCount: rows.filter(r => r.percentage < 50).length,
      studentCount: byStudent.size,
    },
    studentSummaries,
    rows,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Compliance Task Status Report (Phase 54F — F.9's auto-generation needs a
// report companion: a CA/CS firm with many clients needs one screen showing
// which clients have pending/overdue statutory tasks, not just a per-client
// task list. No date range — this is a current-state snapshot, same shape
// as Batch Expiry/Blood Stock (also snapshot, not period, reports).
// ─────────────────────────────────────────────────────────────────────────────

export interface ComplianceTaskReportRow {
  clientName: string; title: string; category: string; dueDate: string
  daysUntilDue: number; status: string; priority: string
}

export interface ComplianceTaskReport {
  generatedAt: string
  summary: { totalOpen: number; overdueCount: number; dueThisWeekCount: number; clientCount: number }
  rows: ComplianceTaskReportRow[]
}

async function generateComplianceTaskReport(): Promise<ComplianceTaskReport> {
  const db = getPrisma()
  const now = new Date()
  const weekFromNow = new Date(now.getTime() + 7 * 86400000)

  const tasks = await db.complianceTask.findMany({
    where: { status: { in: ['PENDING', 'IN_PROGRESS', 'OVERDUE'] } },
    include: { client: { select: { customerName: true } } },
    orderBy: { dueDate: 'asc' },
  })

  const rows: ComplianceTaskReportRow[] = tasks.map(t => ({
    clientName: t.client.customerName,
    title: t.title,
    category: t.category,
    dueDate: t.dueDate.toISOString(),
    daysUntilDue: Math.ceil((t.dueDate.getTime() - now.getTime()) / 86400000),
    status: t.dueDate < now && t.status !== 'OVERDUE' ? 'OVERDUE' : t.status,
    priority: t.priority,
  }))

  return {
    generatedAt: now.toISOString(),
    summary: {
      totalOpen: rows.length,
      overdueCount: rows.filter(r => r.status === 'OVERDUE').length,
      dueThisWeekCount: rows.filter(r => new Date(r.dueDate) <= weekFromNow && r.status !== 'OVERDUE').length,
      clientCount: new Set(rows.map(r => r.clientName)).size,
    },
    rows,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Project Report (fresh-audit fix, 2026-07-12) — SERVICE (Service Business/
// Agency/IT) and CONSULTANT (Consultant/Freelancer) are live, selectable
// business types (SetupWizard.tsx) with zero vertical-specific reports
// before this: their modules (projects, project_tasks, work_tracking,
// customer_history) match none of the other reports' requiredModule gates,
// unlike every one of the 25 Phase-22 service verticals, which get at least
// the appointments-based reports by default. Also applies to any other
// vertical with the `projects` module (Architect/Civil/Software Agency/
// Marketing Agency/etc.) as a general project-status view alongside their
// own more specific reports.
// ─────────────────────────────────────────────────────────────────────────────

// Real bug found 2026-07-16: this report originally queried ServiceProject
// (the model used by Independent Consultant/Marketing Agency/Software
// Agency/Architect/Civil Engineer/Real Estate — the `service_projects`
// module) but was gated in ReportsScreen.tsx behind the unrelated legacy
// `projects` module (SERVICE/CONSULTANT, who write to the *different*
// `Project` model). Net effect: SERVICE/CONSULTANT saw a "Projects" report
// tile that was permanently empty, and the six ServiceProject-using verticals
// had real data but no way to see it at all. Fixed by splitting into two
// correctly-gated reports: this one now genuinely queries `Project` (legacy
// SERVICE/CONSULTANT), and generateServiceProjectReport below covers the
// ServiceProject-using verticals with the original logic, unchanged.

export interface ProjectReportRow {
  title: string; clientName: string | null; status: string; priority: string
  estimatedAmount: number
  startDate: string | null; dueDate: string | null; completedDate: string | null
}
export interface ProjectReportByStatus { status: string; count: number }
export interface ProjectReport {
  dateFrom: string; dateTo: string
  summary: { totalProjects: number; open: number; inProgress: number; completed: number; onHold: number; cancelled: number; totalEstimatedAmount: number }
  byStatus: ProjectReportByStatus[]
  rows: ProjectReportRow[]
}

async function generateProjectReport(params: { dateFrom: string; dateTo: string }): Promise<ProjectReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const projects = await db.project.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: { customer: { select: { customerName: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const statusMap = new Map<string, number>()
  for (const p of projects) statusMap.set(p.status, (statusMap.get(p.status) ?? 0) + 1)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      totalProjects: projects.length,
      open: projects.filter(p => p.status === 'OPEN').length,
      inProgress: projects.filter(p => p.status === 'IN_PROGRESS').length,
      completed: projects.filter(p => p.status === 'COMPLETED').length,
      onHold: projects.filter(p => p.status === 'ON_HOLD').length,
      cancelled: projects.filter(p => p.status === 'CANCELLED').length,
      totalEstimatedAmount: projects.reduce((s, p) => s + Number(p.estimatedAmount ?? 0), 0),
    },
    byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
    rows: projects.map(p => ({
      title: p.title, clientName: p.customer?.customerName ?? null, status: p.status, priority: p.priority,
      estimatedAmount: Number(p.estimatedAmount ?? 0),
      startDate: p.startDate ? p.startDate.toISOString().slice(0, 10) : null,
      dueDate: p.dueDate ? p.dueDate.toISOString().slice(0, 10) : null,
      completedDate: p.completedDate ? p.completedDate.toISOString().slice(0, 10) : null,
    })),
  }
}

export interface ServiceProjectReportRow {
  projectName: string; clientName: string; status: string; projectType: string
  totalContractValue: number | null
  startDate: string | null; expectedEndDate: string | null; completedDate: string | null
}
export interface ServiceProjectReportByStatus { status: string; count: number }
export interface ServiceProjectReport {
  dateFrom: string; dateTo: string
  summary: { totalProjects: number; active: number; completed: number; onHold: number; cancelled: number; totalContractValue: number }
  byStatus: ServiceProjectReportByStatus[]
  rows: ServiceProjectReportRow[]
}

async function generateServiceProjectReport(params: { dateFrom: string; dateTo: string }): Promise<ServiceProjectReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const projects = await db.serviceProject.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: { client: { select: { customerName: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const statusMap = new Map<string, number>()
  for (const p of projects) statusMap.set(p.status, (statusMap.get(p.status) ?? 0) + 1)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      totalProjects: projects.length,
      active: projects.filter(p => p.status === 'ACTIVE').length,
      completed: projects.filter(p => p.status === 'COMPLETED').length,
      onHold: projects.filter(p => p.status === 'ON_HOLD').length,
      cancelled: projects.filter(p => p.status === 'CANCELLED').length,
      totalContractValue: projects.reduce((s, p) => s + Number(p.totalContractValue ?? 0), 0),
    },
    byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
    rows: projects.map(p => ({
      projectName: p.projectName, clientName: p.client.customerName, status: p.status, projectType: p.projectType,
      totalContractValue: p.totalContractValue != null ? Number(p.totalContractValue) : null,
      startDate: p.startDate ? p.startDate.toISOString().slice(0, 10) : null,
      expectedEndDate: p.expectedEndDate ? p.expectedEndDate.toISOString().slice(0, 10) : null,
      completedDate: p.completedDate ? p.completedDate.toISOString().slice(0, 10) : null,
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Job Card Report (fresh-audit fix, 2026-07-12) — REPAIR (Repair Shop/
// Service Centre) is a live, selectable business type with zero vertical-
// specific reports before this. Statuses verified exhaustive against
// JobCard.status in job-card.service.ts ("RECEIVED|DIAGNOSING|IN_REPAIR|
// PENDING_PARTS|READY|DELIVERED|CANCELLED").
// ─────────────────────────────────────────────────────────────────────────────

export interface JobCardReportRow {
  jobNumber: string; title: string; customerName: string | null; status: string; priority: string
  estimatedCost: number; actualCost: number
  receivedDate: string; expectedDate: string | null; deliveredDate: string | null
}
export interface JobCardReportByStatus { status: string; count: number }
export interface JobCardReport {
  dateFrom: string; dateTo: string
  summary: { totalJobs: number; delivered: number; pending: number; cancelled: number; totalEstimatedCost: number; totalActualCost: number }
  byStatus: JobCardReportByStatus[]
  rows: JobCardReportRow[]
}

async function generateJobCardReport(params: { dateFrom: string; dateTo: string }): Promise<JobCardReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const jobs = await db.jobCard.findMany({
    where: { receivedDate: { gte: from, lte: to } },
    include: { customer: { select: { customerName: true } } },
    orderBy: { receivedDate: 'desc' },
  })

  const statusMap = new Map<string, number>()
  for (const j of jobs) statusMap.set(j.status, (statusMap.get(j.status) ?? 0) + 1)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      totalJobs: jobs.length,
      delivered: jobs.filter(j => j.status === 'DELIVERED').length,
      pending: jobs.filter(j => j.status !== 'DELIVERED' && j.status !== 'CANCELLED').length,
      cancelled: jobs.filter(j => j.status === 'CANCELLED').length,
      totalEstimatedCost: jobs.reduce((s, j) => s + j.estimatedCost, 0),
      totalActualCost: jobs.reduce((s, j) => s + j.actualCost, 0),
    },
    byStatus: Array.from(statusMap.entries()).map(([status, count]) => ({ status, count })),
    rows: jobs.map(j => ({
      jobNumber: j.jobNumber, title: j.title, customerName: j.customer?.customerName ?? null, status: j.status, priority: j.priority,
      estimatedCost: j.estimatedCost, actualCost: j.actualCost,
      receivedDate: j.receivedDate.toISOString().slice(0, 10),
      expectedDate: j.expectedDate ? j.expectedDate.toISOString().slice(0, 10) : null,
      deliveredDate: j.deliveredDate ? j.deliveredDate.toISOString().slice(0, 10) : null,
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 58 §1 — 10 new reports for verticals with rich structured data and
// zero dedicated report before this (2026-07-17).
// ─────────────────────────────────────────────────────────────────────────────

// ── Car Service Center — labor vs. parts revenue, technician productivity ──

export interface CarJobCardReportRow {
  jobNumber: string; customerName: string; vehicleNumber: string; vehicleMake: string; vehicleModel: string
  status: string; laborTotal: number; partsTotal: number
  createdAt: string; deliveredDate: string | null
}
export interface CarJobCardTechnicianStat { technicianId: string; jobCount: number }
export interface CarJobCardReport {
  dateFrom: string; dateTo: string
  summary: { totalJobs: number; delivered: number; totalLaborRevenue: number; totalPartsRevenue: number }
  byTechnician: CarJobCardTechnicianStat[]
  rows: CarJobCardReportRow[]
}

async function generateCarJobCardReport(params: { dateFrom: string; dateTo: string }): Promise<CarJobCardReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const jobs = await db.carJobCard.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: { client: { select: { customerName: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const techCounts = new Map<string, number>()
  for (const j of jobs) {
    let techIds: string[] = []
    try { techIds = JSON.parse(j.technicianIds || '[]') } catch { /* leave empty */ }
    for (const tid of techIds) techCounts.set(tid, (techCounts.get(tid) ?? 0) + 1)
  }

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      totalJobs: jobs.length,
      delivered: jobs.filter(j => j.status === 'DELIVERED').length,
      totalLaborRevenue: jobs.reduce((s, j) => s + Number(j.laborTotal), 0),
      totalPartsRevenue: jobs.reduce((s, j) => s + Number(j.partsTotal), 0),
    },
    byTechnician: Array.from(techCounts.entries()).map(([technicianId, jobCount]) => ({ technicianId, jobCount })),
    rows: jobs.map(j => ({
      jobNumber: j.jobNumber, customerName: j.client.customerName, vehicleNumber: j.vehicleNumber,
      vehicleMake: j.vehicleMake, vehicleModel: j.vehicleModel, status: j.status,
      laborTotal: Number(j.laborTotal), partsTotal: Number(j.partsTotal),
      createdAt: j.createdAt.toISOString().slice(0, 10),
      deliveredDate: j.deliveredDate ? j.deliveredDate.toISOString().slice(0, 10) : null,
    })),
  }
}

// ── Tailor Boutique — orders by garment type ──────────────────────────────

export interface TailoringOrderReportRow {
  orderNumber: string; customerName: string; garmentType: string; status: string
  quantity: number; totalAmount: number
  createdAt: string; deliveryDate: string | null
}
export interface TailoringOrderByGarment { garmentType: string; count: number; totalAmount: number }
export interface TailoringOrderReport {
  dateFrom: string; dateTo: string
  summary: { totalOrders: number; delivered: number; totalAmount: number }
  byGarmentType: TailoringOrderByGarment[]
  rows: TailoringOrderReportRow[]
}

async function generateTailoringOrderReport(params: { dateFrom: string; dateTo: string }): Promise<TailoringOrderReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const orders = await db.tailoringOrder.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: { client: { select: { customerName: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const byGarment = new Map<string, { count: number; totalAmount: number }>()
  for (const o of orders) {
    const entry = byGarment.get(o.garmentType) ?? { count: 0, totalAmount: 0 }
    entry.count += 1
    entry.totalAmount += Number(o.totalAmount)
    byGarment.set(o.garmentType, entry)
  }

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      totalOrders: orders.length,
      delivered: orders.filter(o => o.status === 'DELIVERED').length,
      totalAmount: orders.reduce((s, o) => s + Number(o.totalAmount), 0),
    },
    byGarmentType: Array.from(byGarment.entries()).map(([garmentType, v]) => ({ garmentType, ...v })),
    rows: orders.map(o => ({
      orderNumber: o.orderNumber, customerName: o.client.customerName, garmentType: o.garmentType, status: o.status,
      quantity: o.quantity, totalAmount: Number(o.totalAmount),
      createdAt: o.createdAt.toISOString().slice(0, 10),
      deliveryDate: o.deliveryDate ? o.deliveryDate.toISOString().slice(0, 10) : null,
    })),
  }
}

// ── Pest Control — contracts expiring, revenue by pest type ──────────────
// Revenue-by-pest-type is attributed from PestJobSheet.jobAmount (actual
// billed visits), joined back to the parent contract's pestTypes list —
// job sheets don't carry pest type directly. A visit whose contract lists
// multiple pest types has its jobAmount counted once per listed type (no
// existing convention in this codebase splits amounts across tags).

export interface PestContractExpiringRow {
  contractNumber: string; customerName: string; pestTypes: string[]; endDate: string; daysUntilExpiry: number
}
export interface PestRevenueByType { pestType: string; revenue: number; visitCount: number }
export interface PestContractReport {
  dateFrom: string; dateTo: string
  summary: { activeContracts: number; expiringWithin30Days: number; totalContractValue: number }
  expiring: PestContractExpiringRow[]
  byPestType: PestRevenueByType[]
}

async function generatePestContractReport(params: { dateFrom: string; dateTo: string }): Promise<PestContractReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)
  const now = new Date()
  const in30Days = new Date(now.getTime() + 30 * 86400000)

  const [contracts, jobSheets] = await Promise.all([
    db.pestServiceContract.findMany({
      where: { status: 'ACTIVE' },
      include: { client: { select: { customerName: true } } },
      orderBy: { endDate: 'asc' },
    }),
    db.pestJobSheet.findMany({
      where: { completedDate: { gte: from, lte: to }, status: 'COMPLETED' },
      include: { contract: { select: { pestTypes: true } } },
    }),
  ])

  const expiring = contracts.filter(c => c.endDate && c.endDate >= now && c.endDate <= in30Days)

  const byType = new Map<string, { revenue: number; visitCount: number }>()
  for (const js of jobSheets) {
    let pestTypes: string[] = []
    try { pestTypes = JSON.parse(js.contract?.pestTypes || '[]') } catch { /* leave empty */ }
    if (pestTypes.length === 0) pestTypes = ['UNSPECIFIED']
    for (const pt of pestTypes) {
      const entry = byType.get(pt) ?? { revenue: 0, visitCount: 0 }
      entry.revenue += Number(js.jobAmount)
      entry.visitCount += 1
      byType.set(pt, entry)
    }
  }

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      activeContracts: contracts.length,
      expiringWithin30Days: expiring.length,
      totalContractValue: contracts.reduce((s, c) => s + Number(c.contractValue), 0),
    },
    expiring: expiring.map(c => {
      let pestTypes: string[] = []
      try { pestTypes = JSON.parse(c.pestTypes || '[]') } catch { /* leave empty */ }
      const daysUntilExpiry = Math.ceil((c.endDate!.getTime() - now.getTime()) / 86400000)
      return { contractNumber: c.contractNumber, customerName: c.client.customerName, pestTypes, endDate: c.endDate!.toISOString().slice(0, 10), daysUntilExpiry }
    }),
    byPestType: Array.from(byType.entries()).map(([pestType, v]) => ({ pestType, ...v })),
  }
}

// ── Real Estate — listings/deals pipeline ──────────────────────────────────

export interface RealEstatePipelineByStage { stage: string; count: number; value: number }
export interface RealEstateDealRow {
  propertyLocation: string; buyerName: string; sellerName: string
  dealValue: number; brokerageAmount: number; status: string; createdAt: string
}
export interface RealEstatePipelineReport {
  dateFrom: string; dateTo: string
  summary: { totalListings: number; availableListings: number; dealsInProgress: number; totalBrokerageEarned: number }
  byInquiryStage: RealEstatePipelineByStage[]
  deals: RealEstateDealRow[]
}

async function generateRealEstatePipelineReport(params: { dateFrom: string; dateTo: string }): Promise<RealEstatePipelineReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const [properties, inquiries, deals] = await Promise.all([
    db.property.findMany({ where: { createdAt: { gte: from, lte: to } } }),
    db.propertyInquiry.findMany({ where: { createdAt: { gte: from, lte: to } } }),
    db.propertyDeal.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: {
        property: { select: { location: true } },
        buyer: { select: { customerName: true } },
        seller: { select: { customerName: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  const byStage = new Map<string, { count: number; value: number }>()
  for (const i of inquiries) {
    const entry = byStage.get(i.status) ?? { count: 0, value: 0 }
    entry.count += 1
    byStage.set(i.status, entry)
  }

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      totalListings: properties.length,
      availableListings: properties.filter(p => p.status === 'AVAILABLE').length,
      dealsInProgress: deals.filter(d => d.status === 'IN_PROGRESS').length,
      totalBrokerageEarned: deals.filter(d => d.status === 'REGISTERED').reduce((s, d) => s + Number(d.brokerageAmount), 0),
    },
    byInquiryStage: Array.from(byStage.entries()).map(([stage, v]) => ({ stage, ...v })),
    deals: deals.map(d => ({
      propertyLocation: d.property.location, buyerName: d.buyer.customerName, sellerName: d.seller.customerName,
      dealValue: Number(d.dealValue), brokerageAmount: Number(d.brokerageAmount), status: d.status,
      createdAt: d.createdAt.toISOString().slice(0, 10),
    })),
  }
}

// ── Independent Consultant/Marketing Agency/Software Agency — MRR/retainer ──
// collection. No RetainerInvoice model exists — "collected" is a proxy via
// lastInvoicedPeriod matching the report's target period (dateTo's month),
// not a real payment-confirmed figure (see research notes on Retainer
// invoicing — Invoice has no queryable FK back to RetainerAgreement).

export interface RetainerReportRow {
  title: string; clientName: string; status: string; monthlyAmount: number; billedThisPeriod: boolean
}
export interface RetainerReport {
  dateFrom: string; dateTo: string; targetPeriod: string
  summary: { activeRetainers: number; totalMRR: number; billedThisPeriodCount: number; billedThisPeriodAmount: number }
  rows: RetainerReportRow[]
}

async function generateRetainerReport(params: { dateFrom: string; dateTo: string }): Promise<RetainerReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)
  const targetPeriod = params.dateTo.slice(0, 7)

  const retainers = await db.retainerAgreement.findMany({
    where: { createdAt: { lte: to }, OR: [{ endDate: null }, { endDate: { gte: from } }] },
    include: { client: { select: { customerName: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const active = retainers.filter(r => r.status === 'ACTIVE')
  const billedThisPeriod = active.filter(r => r.lastInvoicedPeriod === targetPeriod)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, targetPeriod,
    summary: {
      activeRetainers: active.length,
      totalMRR: active.reduce((s, r) => s + Number(r.monthlyAmount), 0),
      billedThisPeriodCount: billedThisPeriod.length,
      billedThisPeriodAmount: billedThisPeriod.reduce((s, r) => s + Number(r.monthlyAmount), 0),
    },
    rows: retainers.map(r => ({
      title: r.title, clientName: r.client.customerName, status: r.status,
      monthlyAmount: Number(r.monthlyAmount), billedThisPeriod: r.lastInvoicedPeriod === targetPeriod,
    })),
  }
}

// ── Photo Studio — shoot bookings by type ──────────────────────────────────

export interface ShootBookingReportRow {
  clientName: string; shootType: string; shootDate: string; status: string; finalAmount: number | null
}
export interface ShootBookingByType { shootType: string; count: number }
export interface ShootBookingReport {
  dateFrom: string; dateTo: string
  summary: { totalBookings: number; delivered: number; totalRevenue: number }
  byShootType: ShootBookingByType[]
  rows: ShootBookingReportRow[]
}

async function generateShootBookingReport(params: { dateFrom: string; dateTo: string }): Promise<ShootBookingReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const bookings = await db.shootBooking.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: { client: { select: { customerName: true } } },
    orderBy: { shootDate: 'desc' },
  })

  const byType = new Map<string, number>()
  for (const b of bookings) byType.set(b.shootType, (byType.get(b.shootType) ?? 0) + 1)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      totalBookings: bookings.length,
      delivered: bookings.filter(b => b.status === 'DELIVERED').length,
      totalRevenue: bookings.reduce((s, b) => s + Number(b.finalAmount ?? 0), 0),
    },
    byShootType: Array.from(byType.entries()).map(([shootType, count]) => ({ shootType, count })),
    rows: bookings.map(b => ({
      clientName: b.client.customerName, shootType: b.shootType, shootDate: b.shootDate.toISOString().slice(0, 10),
      status: b.status, finalAmount: b.finalAmount != null ? Number(b.finalAmount) : null,
    })),
  }
}

// ── Event Management — event bookings ──────────────────────────────────────

export interface EventBookingReportRow {
  clientName: string; eventName: string; eventType: string; eventDate: string; status: string; finalAmount: number | null
}
export interface EventBookingByStatus { status: string; count: number }
export interface EventBookingReport {
  dateFrom: string; dateTo: string
  summary: { totalBookings: number; completed: number; totalRevenue: number }
  byStatus: EventBookingByStatus[]
  rows: EventBookingReportRow[]
}

async function generateEventBookingReport(params: { dateFrom: string; dateTo: string }): Promise<EventBookingReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const bookings = await db.eventBooking.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: { client: { select: { customerName: true } } },
    orderBy: { eventDate: 'desc' },
  })

  const byStatus = new Map<string, number>()
  for (const b of bookings) byStatus.set(b.status, (byStatus.get(b.status) ?? 0) + 1)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      totalBookings: bookings.length,
      completed: bookings.filter(b => b.status === 'COMPLETED').length,
      totalRevenue: bookings.reduce((s, b) => s + Number(b.finalAmount ?? 0), 0),
    },
    byStatus: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })),
    rows: bookings.map(b => ({
      clientName: b.client.customerName, eventName: b.eventName, eventType: b.eventType,
      eventDate: b.eventDate.toISOString().slice(0, 10), status: b.status,
      finalAmount: b.finalAmount != null ? Number(b.finalAmount) : null,
    })),
  }
}

// ── Placement Agency — candidate/placement pipeline with commission ────────

export interface PlacementReportRow {
  placementNumber: string; candidateName: string; jobTitle: string; clientName: string
  status: string; joiningDate: string; offeredSalary: number; commissionAmount: number
}
export interface PlacementReport {
  dateFrom: string; dateTo: string
  summary: { totalPlacements: number; joined: number; invoiced: number; totalCommission: number }
  rows: PlacementReportRow[]
}

async function generatePlacementReport(params: { dateFrom: string; dateTo: string }): Promise<PlacementReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const placements = await db.placement.findMany({
    where: { joiningDate: { gte: from, lte: to } },
    include: {
      candidate: { select: { fullName: true } },
      jobOrder: { select: { jobTitle: true } },
      client: { select: { customerName: true } },
    },
    orderBy: { joiningDate: 'desc' },
  })

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      totalPlacements: placements.length,
      joined: placements.filter(p => p.status === 'JOINED' || p.status === 'INVOICED').length,
      invoiced: placements.filter(p => p.status === 'INVOICED').length,
      totalCommission: placements.reduce((s, p) => s + Number(p.commissionAmount), 0),
    },
    rows: placements.map(p => ({
      placementNumber: p.placementNumber, candidateName: p.candidate.fullName, jobTitle: p.jobOrder.jobTitle,
      clientName: p.client.customerName, status: p.status, joiningDate: p.joiningDate.toISOString().slice(0, 10),
      offeredSalary: Number(p.offeredSalary), commissionAmount: Number(p.commissionAmount),
    })),
  }
}

// ── Architect — drawing register ────────────────────────────────────────────

export interface DrawingRegisterRow {
  drawingNumber: string; title: string; projectName: string; discipline: string
  revisionNumber: string; status: string; issuedDate: string | null
}
export interface DrawingRegisterByStatus { status: string; count: number }
export interface DrawingRegisterReport {
  dateFrom: string; dateTo: string
  summary: { totalDrawings: number; approved: number; pendingReview: number }
  byStatus: DrawingRegisterByStatus[]
  rows: DrawingRegisterRow[]
}

async function generateDrawingRegisterReport(params: { dateFrom: string; dateTo: string }): Promise<DrawingRegisterReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const drawings = await db.drawingRevision.findMany({
    where: { createdAt: { gte: from, lte: to } },
    include: { project: { select: { projectName: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const byStatus = new Map<string, number>()
  for (const d of drawings) byStatus.set(d.status, (byStatus.get(d.status) ?? 0) + 1)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      totalDrawings: drawings.length,
      approved: drawings.filter(d => d.status === 'APPROVED').length,
      pendingReview: drawings.filter(d => d.status === 'ISSUED_FOR_REVIEW').length,
    },
    byStatus: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })),
    rows: drawings.map(d => ({
      drawingNumber: d.drawingNumber, title: d.title, projectName: d.project.projectName, discipline: d.discipline,
      revisionNumber: d.revisionNumber, status: d.status,
      issuedDate: d.issuedDate ? d.issuedDate.toISOString().slice(0, 10) : null,
    })),
  }
}

// ── Civil Engineer — site visit log ─────────────────────────────────────────

export interface SiteVisitLogRow {
  projectName: string; visitDate: string; visitType: string; recordedByName: string | null; findings: string | null
}
export interface SiteVisitLogByType { visitType: string; count: number }
export interface SiteVisitLogReport {
  dateFrom: string; dateTo: string
  summary: { totalVisits: number }
  byVisitType: SiteVisitLogByType[]
  rows: SiteVisitLogRow[]
}

async function generateSiteVisitLogReport(params: { dateFrom: string; dateTo: string }): Promise<SiteVisitLogReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const visits = await db.siteVisit.findMany({
    where: { visitDate: { gte: from, lte: to } },
    include: { project: { select: { projectName: true } }, recordedBy: { select: { fullName: true } } },
    orderBy: { visitDate: 'desc' },
  })

  const byType = new Map<string, number>()
  for (const v of visits) byType.set(v.visitType, (byType.get(v.visitType) ?? 0) + 1)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: { totalVisits: visits.length },
    byVisitType: Array.from(byType.entries()).map(([visitType, count]) => ({ visitType, count })),
    rows: visits.map(v => ({
      projectName: v.project.projectName, visitDate: v.visitDate.toISOString().slice(0, 10), visitType: v.visitType,
      recordedByName: v.recordedBy?.fullName ?? null, findings: v.findings,
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 58 §2 — Pharmacy Schedule H/H1 prescription-drug sales register.
// Sourced from InvoiceItem's prescription snapshot fields (see
// billing.service.ts), not a separate table — a prescription is captured
// AT sale time and never exists independent of the invoice line it's on.
// ─────────────────────────────────────────────────────────────────────────────

export interface PrescriptionDrugSalesReportRow {
  invoiceNumber: string; invoiceDate: string; productName: string; quantity: number
  patientName: string | null; doctorName: string | null; prescriptionDate: string | null
  customerName: string | null; lineTotal: number
}
export interface PrescriptionDrugSalesReport {
  dateFrom: string; dateTo: string
  summary: { totalSales: number; totalAmount: number; missingPrescriptionDetails: number }
  rows: PrescriptionDrugSalesReportRow[]
}

async function generatePrescriptionDrugSalesReport(params: { dateFrom: string; dateTo: string }): Promise<PrescriptionDrugSalesReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)

  const items = await db.invoiceItem.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      product: { isPrescriptionRequired: true },
      invoice: { status: { not: 'CANCELLED' } },
    },
    include: {
      invoice: { select: { invoiceNumber: true, createdAt: true, customer: { select: { customerName: true } } } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      totalSales: items.length,
      totalAmount: items.reduce((s, i) => s + i.lineTotal, 0),
      // A prescription-flagged product's line should always carry a
      // patient+doctor name by the time it reaches an invoice (billing.
      // service.ts enforces this at sale time) — this only ever surfaces a
      // pre-existing row from before the flag/check existed, never a new gap.
      missingPrescriptionDetails: items.filter(i => !i.prescriptionPatientName || !i.prescriptionDoctorName).length,
    },
    rows: items.map(i => ({
      invoiceNumber: i.invoice.invoiceNumber, invoiceDate: i.invoice.createdAt.toISOString().slice(0, 10),
      productName: i.productName, quantity: i.quantity,
      patientName: i.prescriptionPatientName, doctorName: i.prescriptionDoctorName,
      prescriptionDate: i.prescriptionDate ? i.prescriptionDate.toISOString().slice(0, 10) : null,
      customerName: i.invoice.customer?.customerName ?? null, lineTotal: i.lineTotal,
    })),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 54G — Rental: Currently Rented / Overdue (snapshot), Rental Revenue
// & Utilization (date range)
// ─────────────────────────────────────────────────────────────────────────────

export interface RentalStatusRow {
  bookingNumber: string; customerName: string; productName: string; unitLabel: string | null
  startDateTime: string; endDateTime: string; isOverdue: boolean; daysOverdue: number
}

export interface RentalStatusReport {
  rows: RentalStatusRow[]
  summary: { totalCheckedOut: number; overdueCount: number }
}

async function generateRentalStatusReport(): Promise<RentalStatusReport> {
  const db = getPrisma()
  const bookings = await db.rentalBooking.findMany({
    where: { status: 'CHECKED_OUT' },
    include: { customer: { select: { customerName: true } }, items: { include: { product: { select: { productName: true } }, rentalUnit: { select: { unitLabel: true } } } } },
    orderBy: { endDateTime: 'asc' },
  })

  const now = new Date()
  const rows: RentalStatusRow[] = []
  for (const b of bookings) {
    const isOverdue = b.endDateTime < now
    const daysOverdue = isOverdue ? Math.ceil((now.getTime() - b.endDateTime.getTime()) / 86_400_000) : 0
    for (const item of b.items) {
      rows.push({
        bookingNumber: b.bookingNumber, customerName: b.customer.customerName,
        productName: item.product.productName, unitLabel: item.rentalUnit?.unitLabel ?? null,
        startDateTime: b.startDateTime.toISOString(), endDateTime: b.endDateTime.toISOString(),
        isOverdue, daysOverdue,
      })
    }
  }

  return {
    rows,
    summary: { totalCheckedOut: bookings.length, overdueCount: bookings.filter(b => b.endDateTime < now).length },
  }
}

export interface RentalRevenueRow {
  productName: string; bookingCount: number; totalRevenue: number
  unitCount: number | null; utilizationPercent: number | null // UNIT items only
}

export interface RentalRevenueReport {
  dateFrom: string; dateTo: string
  rows: RentalRevenueRow[]
  summary: { totalRevenue: number; totalBookings: number }
}

async function generateRentalRevenueReport(params: { dateFrom: string; dateTo: string }): Promise<RentalRevenueReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = new Date(params.dateTo); to.setHours(23, 59, 59, 999)
  const rangeDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000))

  const items = await db.rentalBookingItem.findMany({
    where: { booking: { status: { in: ['CHECKED_OUT', 'RETURNED'] }, startDateTime: { lte: to }, endDateTime: { gte: from } } },
    include: { product: { select: { productName: true, rentalTrackingType: true } }, booking: { select: { startDateTime: true, endDateTime: true } } },
  })

  const byProduct = new Map<string, { bookingCount: number; totalRevenue: number; unitCount: number | null; rentedDaysInRange: number }>()
  for (const item of items) {
    const existing = byProduct.get(item.product.productName) ?? { bookingCount: 0, totalRevenue: 0, unitCount: item.product.rentalTrackingType === 'UNIT' ? 0 : null, rentedDaysInRange: 0 }
    existing.bookingCount += 1
    existing.totalRevenue += item.lineTotal
    // Overlap-days between this specific booking's actual span and the
    // report's requested date range — not the whole booking length, and not
    // just "1 day per booking" (a booking spanning the full range shouldn't
    // count the same as one spanning a single day of it).
    const overlapStart = item.booking.startDateTime > from ? item.booking.startDateTime : from
    const overlapEnd = item.booking.endDateTime < to ? item.booking.endDateTime : to
    const overlapMs = overlapEnd.getTime() - overlapStart.getTime()
    if (overlapMs > 0) existing.rentedDaysInRange += overlapMs / 86_400_000
    byProduct.set(item.product.productName, existing)
  }

  // Unit count for UNIT items, used as the utilization denominator
  const unitProducts = await db.product.findMany({ where: { rentalTrackingType: 'UNIT', isRentable: true }, include: { rentalUnits: true } })
  for (const p of unitProducts) {
    const entry = byProduct.get(p.productName)
    if (!entry) continue
    entry.unitCount = p.rentalUnits.length
  }

  const rows: RentalRevenueRow[] = Array.from(byProduct.entries()).map(([productName, v]) => ({
    productName, bookingCount: v.bookingCount, totalRevenue: v.totalRevenue,
    unitCount: v.unitCount,
    // days actually rented within the range / (unit count x days in range)
    utilizationPercent: v.unitCount && v.unitCount > 0 ? Math.min(100, (v.rentedDaysInRange / (v.unitCount * rangeDays)) * 100) : null,
  })).sort((a, b) => b.totalRevenue - a.totalRevenue)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, rows,
    summary: { totalRevenue: rows.reduce((s, r) => s + r.totalRevenue, 0), totalBookings: items.length },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Exports
// ─────────────────────────────────────────────────────────────────────────────

export const reportService = {
  generateSalesReport,
  generateInventoryReport,
  generateTaxReport,
  generateOutstandingReport,
  generateCustomerLedgerReport,
  generateSupplierLedgerReport,
  generateExpenseReport,
  generateProfitAndLossReport,
  generateCashBookReport,
  generateTrialBalanceReport,
  generateAuditReport,
  generateFoodCostReport,
  generateGSTR1,
  generateHSNSummaryReport,
  generateDocumentSummaryReport,
  generateGSTR3BPreview,
  generateRentalStatusReport,
  generateRentalRevenueReport,
  generateAppointmentUtilisationReport,
  generateClientRetentionReport,
  generateCommissionReport,
  generateOrderVolumeReport,
  generateBatchExpiryReport,
  generateLabThroughputReport,
  generateBloodStockReport,
  generateJewelleryReport,
  generateLogisticsReport,
  generateAttendanceReport,
  generateProductionReport,
  generateSerialWarrantyReport,
  generateVariantStockReport,
  generateTestScoreReport,
  generateComplianceTaskReport,
  generateProjectReport,
  generateServiceProjectReport,
  generateJobCardReport,
  generateCarJobCardReport,
  generateTailoringOrderReport,
  generatePestContractReport,
  generateRealEstatePipelineReport,
  generateRetainerReport,
  generateShootBookingReport,
  generateEventBookingReport,
  generatePlacementReport,
  generateDrawingRegisterReport,
  generateSiteVisitLogReport,
  generatePrescriptionDrugSalesReport,
}
