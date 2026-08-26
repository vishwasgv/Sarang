import { getPrisma } from '../database/db'
import { INGREDIENT_DEDUCTION_REMARKS_PREFIX, getDishIngredientCostsBatch, getRecipeImpliedIngredientUsageBatch } from './restaurant.service'
import { roundCurrency, sumCurrency } from './currency.service'
import { toLocalISODate, parseLocalDateStart, parseLocalDateEnd } from '../utils/date.util'
import { getProductCostsBatch } from './valuation.service'
import { generateChronicRecallComplianceReport as generateChronicRecallComplianceReportImpl } from './chronic-condition-record.service'
import { generateDentalRecallComplianceReport as generateDentalRecallComplianceReportImpl } from './recall-record.service'

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
  // Phase 67 §9.1 — Hardware: smart carton-break reorder trigger. Null for
  // every product not sold by pack (the overwhelming majority) — populated
  // only when there's a real carton ratio to break the flat piece count
  // down by, since Inventory.quantity itself never stops being pieces.
  cartonBreakdown: { unitsPerPack: number; fullCartons: number; loosePieces: number } | null
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

// ─────────────────────────────────────────────────────────────────────────────
// Phase 61 — Purchase-side reports (Bill is the definitive purchase record,
// same reasoning as Section 3.1 item 2 of the Phase 61 roadmap: a PO is a
// commitment, a Bill is what was actually purchased/owed).
// ─────────────────────────────────────────────────────────────────────────────

export interface PurchaseRegisterRow {
  billNumber: string; date: string; supplier: string; status: string
  itemCount: number; subtotal: number; discountAmount: number; taxAmount: number; totalAmount: number
}
export interface PurchaseRegisterByVendorRow { supplierName: string; totalAmount: number; billCount: number }

export interface PurchaseRegisterReport {
  dateFrom: string; dateTo: string
  summary: { totalPurchases: number; billCount: number; totalTax: number }
  byVendor: PurchaseRegisterByVendorRow[]
  rows: PurchaseRegisterRow[]
  total: number
}

export interface PurchasesByVendorRow { supplierId: string; supplierName: string; totalAmount: number; billCount: number }
export interface PurchasesByVendorReport {
  dateFrom: string; dateTo: string
  summary: { totalPurchases: number; vendorCount: number }
  rows: PurchasesByVendorRow[]
}

export interface PurchasesByItemRow { itemName: string; isService: boolean; quantity: number; totalAmount: number; billCount: number }
export interface PurchasesByItemReport {
  dateFrom: string; dateTo: string
  summary: { totalPurchases: number; itemCount: number }
  rows: PurchasesByItemRow[]
}

export interface ApAgingRow { id: string; supplierName: string; phone: string | null; outstanding: number; aging: AgingBuckets }
export interface ApAgingReport {
  generatedAt: string
  summary: { totalOutstanding: number; count: number }
  agingTotals: AgingBuckets
  rows: ApAgingRow[]
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

// Discounts & Bargained Pricing Report — covers BOTH kinds of price
// reduction: the pre-existing overall bill-level discount and the new
// per-line "Final Price" bargaining mode added to BillingScreen.tsx (both
// ultimately just write to InvoiceItem.discountAmount, so this report
// doesn't need to know which UI path produced a given line's discount).
// Common in Indian retail/hardware/wholesale trade where a haggled final
// price is the norm — this gives an owner visibility into how much margin
// is being negotiated away, by product and by staff member.
export interface DiscountReportRow {
  invoiceNumber: string; date: string; customer: string | null
  productName: string; quantity: number; lineGross: number
  discountAmount: number; discountPercent: number
  staffName: string | null
}

export interface DiscountByStaffRow { staffName: string; discountGiven: number; lineCount: number }
export interface DiscountByProductRow { productName: string; discountGiven: number; lineCount: number }

export interface DiscountReport {
  dateFrom: string; dateTo: string
  summary: { totalDiscountGiven: number; discountedLineCount: number; totalLineCount: number; discountIncidencePercent: number; averageDiscountPercent: number }
  byStaff: DiscountByStaffRow[]
  byProduct: DiscountByProductRow[]
  rows: DiscountReportRow[]
  total: number
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

// BUG FOUND 2026-07-22: this used to be `new Date(s)`, which parses a bare
// "YYYY-MM-DD" string (exactly what every report's date-range filter sends)
// as UTC midnight, not local midnight -- silently excluding the first ~5.5
// hours of the "from" date on every report in this file for IST users. All
// ~40 report functions route through this one helper, so fixing it here
// fixes every one of them at once. See date.util.ts's parseLocalDateStart
// for the full explanation.
function toDate(s: string): Date { return parseLocalDateStart(s) }

// Real bug found 2026-07-23: every one of the ~35 call sites below built the
// "to" (end) bound as `new Date(dateToString); d.setHours(23,59,59,999)` —
// this parses the bare "YYYY-MM-DD" string as UTC midnight FIRST (one full
// calendar day earlier than intended in any negative-UTC-offset timezone),
// then setHours() only rewrites the H/M/S/ms fields, never the Year/Month/
// Date that was already wrong. The net effect: the entire actually-selected
// end date was silently dropped from every date-ranged report in this file
// for any user not in a positive UTC offset (IST never triggers it, which is
// exactly why this went unnoticed by the otherwise-thorough "from"-bound fix
// right above). See date.util.ts's parseLocalDateEnd for the full
// explanation — same fix shape as toDate()/parseLocalDateStart above.
function toDateEnd(s: string): Date { return parseLocalDateEnd(s) }

function groupLabel(date: Date, groupBy: string): string {
  if (groupBy === 'day') return toLocalISODate(date)
  if (groupBy === 'week') {
    const d = new Date(date)
    d.setDate(d.getDate() - d.getDay())
    return `Week of ${toLocalISODate(d)}`
  }
  // BUG FOUND 2026-07-22: `date.toISOString().slice(0, 7)` extracts the UTC
  // year-month, which is the same anti-pattern as the day-level bug this
  // whole helper exists to fix -- an invoice timestamped in the first ~5.5
  // hours of a calendar month (IST) was bucketed into the PREVIOUS month in
  // any monthly-grouped report/chart. Local year/month components instead.
  if (groupBy === 'month') return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  if (groupBy === 'year') return String(date.getFullYear())
  return toLocalISODate(date)
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
  const to = toDateEnd(params.dateTo)
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
    date: toLocalISODate(new Date(inv.invoiceDate)),
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
    // REAL BUG found+fixed 2026-07-30: was Product.costPrice (a static value
    // never updated by purchases/receiving/adjustments), diverging from the
    // Inventory screen's "Total Value" (Inventory.averageCost, the live
    // weighted-average cost basis) for any business with purchase-price
    // history. See analytics.service.ts's getDashboardKpis for the same fix.
    const stockValue = stock * (p.inventory?.averageCost ?? p.costPrice)

    if (params?.lowStockOnly && !lowAlert && stock !== 0) continue

    // Phase 67 §9.1 — Hardware: reframe a flat piece count into carton
    // terms for any product genuinely sold by pack — floor division, since
    // this is "how much do I actually have," not a reorder suggestion
    // (which rounds up instead — see purchase-order.service.ts's
    // roundUpToCartonMultiple for that distinct, deliberately opposite,
    // rounding direction).
    const cartonBreakdown = (p.sellByPack && p.unitsPerPack && p.unitsPerPack > 0)
      ? { unitsPerPack: p.unitsPerPack, fullCartons: Math.floor(stock / p.unitsPerPack), loosePieces: stock % p.unitsPerPack }
      : null

    rows.push({
      sku: p.sku, productName: p.productName,
      category: p.category?.name ?? 'Uncategorized',
      productType: p.productType,
      // Phase 38: a loose-billed product's stock is tracked directly in its
      // weightUnit (kg/g/L/mL), not the generic pack Product.unit — showing
      // "42.5 PCS" for 42.5kg of loose rice was silently wrong.
      currentStock: stock, unit: (p.sellByWeight && p.weightUnit) ? p.weightUnit : p.unit, costPrice: p.costPrice,
      sellingPrice: p.sellingPrice, stockValue, lowStockAlert: lowAlert || stock === 0,
      cartonBreakdown
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
  const to = toDateEnd(params.dateTo)

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

// Shared FIFO-oldest-debit-first aging allocation — factored out of
// generateOutstandingReport's supplier branch so generateApAgingReport
// (Phase 61) genuinely reuses the same proven-correct algorithm instead of
// a re-typed copy that could silently drift from it.
function computeAgingRows(
  now: Date,
  entities: { id: string; name: string; phone: string | null }[],
  ledgerByEntity: Map<string, { debitAmount: number; creditAmount: number; createdAt: Date }[]>
): { id: string; name: string; phone: string | null; outstanding: number; aging: AgingBuckets }[] {
  const rows: { id: string; name: string; phone: string | null; outstanding: number; aging: AgingBuckets }[] = []
  for (const e of entities) {
    const ledgerEntries = ledgerByEntity.get(e.id) ?? []
    if (ledgerEntries.length === 0) continue

    const outstanding = ledgerEntries.reduce((sum, x) => sum + x.debitAmount - x.creditAmount, 0)
    if (outstanding <= 0.01) continue

    let aging: AgingBuckets = { ...ZERO_AGING }
    let remaining = outstanding
    const debitEntries = ledgerEntries.filter(x => x.debitAmount > 0).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    for (const entry of debitEntries) {
      if (remaining <= 0) break
      const portion = Math.min(entry.debitAmount, remaining)
      const daysOld = Math.floor((now.getTime() - entry.createdAt.getTime()) / 86400000)
      aging = mergeAging(aging, agingBucket(daysOld, portion))
      remaining -= portion
    }

    rows.push({ id: e.id, name: e.name, phone: e.phone, outstanding, aging })
  }
  return rows
}

async function generateOutstandingReport(): Promise<OutstandingReport> {
  const db = getPrisma()
  const now = new Date()

  // Batch-load everything in 4 parallel queries instead of N+1
  const [customers, suppliers, allCustomerLedger, allSupplierLedger] = await Promise.all([
    db.customer.findMany({ where: { isActive: true }, select: { id: true, customerName: true, phone: true } }),
    db.supplier.findMany({ where: { isActive: true }, select: { id: true, supplierName: true, phone: true } }),
    db.customerLedger.findMany({
      select: { customerId: true, debitAmount: true, creditAmount: true, createdAt: true }
    }),
    db.supplierLedger.findMany({
      select: { supplierId: true, debitAmount: true, creditAmount: true, createdAt: true }
    })
  ])

  // Group customer ledger entries by customerId in memory
  const ledgerByCustomer = new Map<string, { debitAmount: number; creditAmount: number; createdAt: Date }[]>()
  for (const e of allCustomerLedger) {
    const arr = ledgerByCustomer.get(e.customerId) ?? []
    arr.push(e)
    ledgerByCustomer.set(e.customerId, arr)
  }

  // Group supplier ledger entries by supplierId in memory
  const ledgerBySupplier = new Map<string, { debitAmount: number; creditAmount: number; createdAt: Date }[]>()
  for (const e of allSupplierLedger) {
    const arr = ledgerBySupplier.get(e.supplierId) ?? []
    arr.push(e)
    ledgerBySupplier.set(e.supplierId, arr)
  }

  // REAL BUG found+fixed 2026-07-30: this used to sum unpaid Invoice.balanceAmount
  // instead of the CustomerLedger (RULE AN001 — the same rule the Dashboard's
  // outstanding tile and getTopOutstanding()/getOutstandingAmount() already
  // follow correctly; only this report's customer branch diverged, while its
  // own sibling supplier branch below was already ledger-based). A customer
  // with a standalone OPENING_BALANCE or CREDIT_NOTE ledger entry (debt with
  // no Invoice row at all) showed correctly on the Dashboard but was entirely
  // absent here — understating total receivables versus the same session's
  // Dashboard figure. Now ledger-based, mirroring the supplier branch exactly
  // (including its FIFO-oldest-debit-first aging allocation), which also
  // means aging is now relative to when each ledger entry was recorded rather
  // than an invoice's due date — consistent with the supplier side, and the
  // only basis that makes sense for a non-invoice ledger entry.
  const customerRows = computeAgingRows(now, customers.map(c => ({ id: c.id, name: c.customerName, phone: c.phone })), ledgerByCustomer)
    .map(r => ({ id: r.id, customerName: r.name, phone: r.phone, outstanding: r.outstanding, aging: r.aging }))

  const supplierRows = computeAgingRows(now, suppliers.map(s => ({ id: s.id, name: s.supplierName, phone: s.phone })), ledgerBySupplier)
    .map(r => ({ id: r.id, supplierName: r.name, phone: r.phone, outstanding: r.outstanding, aging: r.aging }))

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
// Phase 61 — AP Aging (Summary/Details): the exact same supplier-side
// computation generateOutstandingReport already does, just as its own
// dedicated report instead of bundled invisibly inside "Outstanding" — see
// PHASE_61_ROADMAP_MASTER_PROMPT.md Section 3.1 item 5.
// ─────────────────────────────────────────────────────────────────────────────

async function generateApAgingReport(): Promise<ApAgingReport> {
  const db = getPrisma()
  const now = new Date()

  const [suppliers, allSupplierLedger] = await Promise.all([
    db.supplier.findMany({ where: { isActive: true }, select: { id: true, supplierName: true, phone: true } }),
    db.supplierLedger.findMany({ select: { supplierId: true, debitAmount: true, creditAmount: true, createdAt: true } })
  ])

  const ledgerBySupplier = new Map<string, { debitAmount: number; creditAmount: number; createdAt: Date }[]>()
  for (const e of allSupplierLedger) {
    const arr = ledgerBySupplier.get(e.supplierId) ?? []
    arr.push(e)
    ledgerBySupplier.set(e.supplierId, arr)
  }

  const rows: ApAgingRow[] = computeAgingRows(now, suppliers.map(s => ({ id: s.id, name: s.supplierName, phone: s.phone })), ledgerBySupplier)
    .map(r => ({ id: r.id, supplierName: r.name, phone: r.phone, outstanding: r.outstanding, aging: r.aging }))
    .sort((a, b) => b.outstanding - a.outstanding)

  const agingTotals = rows.reduce((acc, r) => mergeAging(acc, r.aging), { ...ZERO_AGING })

  return {
    generatedAt: now.toISOString(),
    summary: { totalOutstanding: rows.reduce((s, r) => s + r.outstanding, 0), count: rows.length },
    agingTotals,
    rows
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 61 — Purchase Register / Purchases by Vendor / Purchases by Item.
// Bill (not PurchaseOrder) is the source: a PO is a commitment, a Bill is
// the actual recorded purchase/AP obligation — see Section 3.1 item 2.
// VOID bills are excluded throughout (never a real purchase).
// ─────────────────────────────────────────────────────────────────────────────

async function generatePurchaseRegisterReport(params: { dateFrom: string; dateTo: string }): Promise<PurchaseRegisterReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const bills = await db.bill.findMany({
    where: { billDate: { gte: from, lte: to }, status: { not: 'VOID' } },
    include: {
      supplier: { select: { supplierName: true } },
      items: { select: { id: true } }
    },
    orderBy: { billDate: 'asc' }
  })

  const byVendorMap = new Map<string, PurchaseRegisterByVendorRow>()
  const rows: PurchaseRegisterRow[] = bills.map(b => {
    const vendorRow = byVendorMap.get(b.supplier.supplierName) ?? { supplierName: b.supplier.supplierName, totalAmount: 0, billCount: 0 }
    vendorRow.totalAmount += b.totalAmount
    vendorRow.billCount += 1
    byVendorMap.set(b.supplier.supplierName, vendorRow)

    return {
      billNumber: b.billNumber, date: toLocalISODate(b.billDate), supplier: b.supplier.supplierName, status: b.status,
      itemCount: b.items.length, subtotal: b.subtotal, discountAmount: b.discountAmount, taxAmount: b.taxAmount, totalAmount: b.totalAmount
    }
  })

  const byVendor = Array.from(byVendorMap.values()).sort((a, b) => b.totalAmount - a.totalAmount)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      totalPurchases: sumCurrency(bills.map(b => b.totalAmount)),
      billCount: bills.length,
      totalTax: sumCurrency(bills.map(b => b.taxAmount))
    },
    byVendor,
    rows, total: rows.length
  }
}

async function generatePurchasesByVendorReport(params: { dateFrom: string; dateTo: string }): Promise<PurchasesByVendorReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const bills = await db.bill.findMany({
    where: { billDate: { gte: from, lte: to }, status: { not: 'VOID' } },
    select: { totalAmount: true, supplierId: true, supplier: { select: { supplierName: true } } }
  })

  const byVendor = new Map<string, PurchasesByVendorRow>()
  for (const b of bills) {
    const row = byVendor.get(b.supplierId) ?? { supplierId: b.supplierId, supplierName: b.supplier.supplierName, totalAmount: 0, billCount: 0 }
    row.totalAmount += b.totalAmount
    row.billCount += 1
    byVendor.set(b.supplierId, row)
  }

  const rows = Array.from(byVendor.values()).sort((a, b) => b.totalAmount - a.totalAmount)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: { totalPurchases: sumCurrency(rows.map(r => r.totalAmount)), vendorCount: rows.length },
    rows
  }
}

async function generatePurchasesByItemReport(params: { dateFrom: string; dateTo: string }): Promise<PurchasesByItemReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const items = await db.billItem.findMany({
    where: { bill: { billDate: { gte: from, lte: to }, status: { not: 'VOID' } } },
    select: {
      quantity: true, total: true,
      productId: true, serviceDescription: true,
      product: { select: { productName: true } }
    }
  })

  const byItem = new Map<string, PurchasesByItemRow>()
  for (const item of items) {
    const isService = !item.productId
    const key = isService ? `SVC:${item.serviceDescription}` : `PRD:${item.productId}`
    const itemName = isService ? (item.serviceDescription ?? 'Service') : (item.product?.productName ?? 'Unknown Product')
    const row = byItem.get(key) ?? { itemName, isService, quantity: 0, totalAmount: 0, billCount: 0 }
    row.quantity += item.quantity
    row.totalAmount += item.total
    row.billCount += 1
    byItem.set(key, row)
  }

  const rows = Array.from(byItem.values()).sort((a, b) => b.totalAmount - a.totalAmount)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: { totalPurchases: sumCurrency(rows.map(r => r.totalAmount)), itemCount: rows.length },
    rows
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
      ...(params.dateTo ? { lte: toDateEnd(params.dateTo) } : {})
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
      ...(params.dateTo ? { lte: toDateEnd(params.dateTo) } : {})
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
  const to = toDateEnd(params.dateTo)

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
    date: toLocalISODate(new Date(e.expenseDate)),
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
  const to = toDateEnd(params.dateTo)

  const [invoices, expenses] = await Promise.all([
    db.invoice.findMany({
      where: { status: 'ACTIVE', paymentStatus: { in: ['PAID', 'PARTIAL'] }, invoiceDate: { gte: from, lte: to } },
      select: { totalAmount: true, invoiceType: true, items: { select: { quantity: true, productId: true } } }
    }),
    db.expense.findMany({
      where: { expenseDate: { gte: from, lte: to } },
      include: { category: { select: { categoryName: true } } }
    })
  ])

  // Phase 64 — was `it.product.costPrice` (the static, hand-edited field),
  // the same stale-cost gap fixed in analytics.service.ts's computeProfit()
  // — getProductCostsBatch() resolves through each product's own selected
  // valuationMethod, matching the Inventory screen's live figure instead of
  // silently diverging from it.
  const costs = await getProductCostsBatch(invoices.flatMap(inv => inv.items.map(it => it.productId)))

  const revenue = sumCurrency(invoices.map(inv => inv.totalAmount))
  // Same RETURN-invoice sign correction as analytics.service.ts's
  // computeProfit(): a return's item quantities are stored positive (used to
  // restock inventory), so summing quantity*cost unconditionally would
  // double-punish profit — revenue already dropped via totalAmount, COGS
  // must drop too (the goods came back into stock), not rise as a second sale.
  const cogs = sumCurrency(invoices.flatMap((inv) => {
    const sign = inv.invoiceType === 'RETURN' ? -1 : 1
    return inv.items.map((it) => sign * it.quantity * (costs.get(it.productId) ?? 0))
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
  const to = toDateEnd(params.dateTo)

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
// Trial Balance — Phase 62 rewrite. Now that a real double-entry Chart of
// Accounts + Journal Entry ledger exists (every Invoice/Bill/Payment/
// SupplierPayment/Expense/PDC-clear/depreciation/etc. auto-posts a balanced
// JournalEntry), this reads real posted GL rows instead of synthesizing
// figures from invoices/expenses/customer balances. Superseded, not kept
// alongside, the old synthetic version — see Section 4.1 item 17 of
// PHASE_61_ROADMAP_MASTER_PROMPT.md for why this rewrite was deferred until
// the GL existed to read from.
//
// A trial balance is inherently a cumulative as-of-a-date snapshot, not a
// period movement — every ChartOfAccounts row's balance is summed from ALL
// its JournalEntryLine postings up to and including dateTo, not just the
// dateFrom..dateTo window (`dateFrom` is kept in the returned shape only
// because the report screen's date-range picker still expects it, and is
// not used in the computation).
//
// Each JournalEntry is enforced balanced at posting time (assertBalanced in
// journal-entry.service.ts), and a reversed entry's own mirrored lines net
// to zero against the original by construction — so summing every posted
// line, with no isReversed filtering needed, is guaranteed to net to zero
// across the whole ledger. Per account, net = debit − credit: a positive
// net is shown as a debit, a negative net as a credit magnitude — this
// single sign rule is what keeps every account (regardless of whether its
// "natural" balance is debit or credit) correctly balanced and never shows
// a negative number in either column.
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
  const to = toDateEnd(params.dateTo)

  const [accounts, lines] = await Promise.all([
    db.chartOfAccounts.findMany({ where: { isActive: true }, orderBy: { accountCode: 'asc' } }),
    db.journalEntryLine.findMany({
      where: { journalEntry: { entryDate: { lte: to } } },
      select: { accountId: true, debitAmount: true, creditAmount: true }
    })
  ])

  const debitByAccount = new Map<string, number>()
  const creditByAccount = new Map<string, number>()
  for (const line of lines) {
    debitByAccount.set(line.accountId, (debitByAccount.get(line.accountId) ?? 0) + line.debitAmount)
    creditByAccount.set(line.accountId, (creditByAccount.get(line.accountId) ?? 0) + line.creditAmount)
  }

  const rows: TrialBalanceRow[] = []
  for (const acct of accounts) {
    const debitTotal = debitByAccount.get(acct.id) ?? 0
    const creditTotal = creditByAccount.get(acct.id) ?? 0
    if (debitTotal === 0 && creditTotal === 0) continue // never posted to — omit rather than pad with all-zero rows
    const net = roundCurrency(debitTotal - creditTotal)
    if (Math.abs(net) < 0.005) continue // posted both ways but nets to zero — nothing to show
    const account = `${acct.accountCode} — ${acct.accountName}`
    rows.push(net > 0 ? { account, debit: net, credit: 0 } : { account, debit: 0, credit: -net })
  }

  const totalDebit = roundCurrency(sumCurrency(rows.map((r) => r.debit)))
  const totalCredit = roundCurrency(sumCurrency(rows.map((r) => r.credit)))

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, asOf: params.dateTo,
    rows, totalDebit, totalCredit,
    balanced: Math.abs(totalDebit - totalCredit) < 0.01
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 65 — Reporting Tags / Cost & Profit Centres: treemap P&L
// ─────────────────────────────────────────────────────────────────────────────

export interface CostCentreTreemapRow { costCentreId: string; costCentreName: string; revenue: number; expense: number; margin: number }
export interface CostCentreTreemapReport { dateFrom: string; dateTo: string; rows: CostCentreTreemapRow[]; untaggedRevenue: number; untaggedExpense: number }

// Reads real JournalEntryLine.costCentreId data — automatically accurate for
// every transaction retroactively tagged, since it's the same GL every
// other financial report already reads from (not a separate, driftable
// computation). Revenue nets credit-debit on INCOME-type accounts (revenue
// is credited); expense nets debit-credit on EXPENSE-type accounts —
// mirrors generateProfitAndLossReport's own sign conventions. Aggregated in
// JS rather than a Prisma groupBy because the two account types need
// opposite netting directions in the same pass — SQLite/Prisma has no
// portable "sum with a conditional sign" groupBy shape, and a reporting
// query over one business's JournalEntryLine rows is not hot-path volume.
async function generateCostCentreTreemapReport(params: { dateFrom: string; dateTo: string }): Promise<CostCentreTreemapReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const [costCentres, lines] = await Promise.all([
    db.costCentre.findMany({ where: { isActive: true } }),
    db.journalEntryLine.findMany({
      where: { journalEntry: { entryDate: { gte: from, lte: to } } },
      select: { costCentreId: true, debitAmount: true, creditAmount: true, account: { select: { accountType: true } } }
    })
  ])

  const revenueByCentre = new Map<string, number>()
  const expenseByCentre = new Map<string, number>()
  let untaggedRevenue = 0
  let untaggedExpense = 0

  for (const line of lines) {
    if (line.account.accountType === 'INCOME') {
      const net = line.creditAmount - line.debitAmount
      if (line.costCentreId) revenueByCentre.set(line.costCentreId, (revenueByCentre.get(line.costCentreId) ?? 0) + net)
      else untaggedRevenue += net
    } else if (line.account.accountType === 'EXPENSE') {
      const net = line.debitAmount - line.creditAmount
      if (line.costCentreId) expenseByCentre.set(line.costCentreId, (expenseByCentre.get(line.costCentreId) ?? 0) + net)
      else untaggedExpense += net
    }
  }

  const rows: CostCentreTreemapRow[] = costCentres.map((cc) => {
    const revenue = roundCurrency(revenueByCentre.get(cc.id) ?? 0)
    const expense = roundCurrency(expenseByCentre.get(cc.id) ?? 0)
    return { costCentreId: cc.id, costCentreName: cc.name, revenue, expense, margin: roundCurrency(revenue - expense) }
  }).filter((r) => r.revenue !== 0 || r.expense !== 0) // a cost centre nobody has tagged anything against yet — omit, don't pad with a zero rectangle

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, rows,
    untaggedRevenue: roundCurrency(untaggedRevenue), untaggedExpense: roundCurrency(untaggedExpense)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 65 — Budget vs. Actual
// ─────────────────────────────────────────────────────────────────────────────

export interface BudgetVsActualRow {
  budgetId: string; costCentreId: string | null; costCentreName: string | null
  accountId: string | null; accountName: string | null
  budgeted: number; actual: number; variance: number
}
export interface BudgetVsActualReport { periodYear: number; periodMonth: number; rows: BudgetVsActualRow[] }

// "Actual" is computed the same way generateCostCentreTreemapReport computes
// revenue/expense — real JournalEntryLine data for the same month, filtered
// by the SAME (costCentreId, accountId) scope the budget row itself names —
// so a budget set against a cost centre that's never had a single tagged
// transaction honestly reports ₹0 actual, never a silent gap. When a
// budget's accountId is null (a whole-cost-centre budget, not broken down
// by account — see Budget's own schema comment), actual sums every
// EXPENSE-type line in scope, matching this report's real-world use
// ("budget vs. real spend"), not revenue.
async function generateBudgetVsActualReport(params: { periodYear: number; periodMonth: number }): Promise<BudgetVsActualReport> {
  const db = getPrisma()
  const from = new Date(params.periodYear, params.periodMonth - 1, 1)
  const to = new Date(params.periodYear, params.periodMonth, 0, 23, 59, 59, 999)

  const budgets = await db.budget.findMany({
    where: { periodYear: params.periodYear, periodMonth: params.periodMonth },
    include: { costCentre: { select: { id: true, name: true } }, account: { select: { id: true, accountName: true, accountType: true } } }
  })
  if (budgets.length === 0) return { periodYear: params.periodYear, periodMonth: params.periodMonth, rows: [] }

  const lines = await db.journalEntryLine.findMany({
    where: { journalEntry: { entryDate: { gte: from, lte: to } } },
    select: { costCentreId: true, accountId: true, debitAmount: true, creditAmount: true, account: { select: { accountType: true } } }
  })

  const rows: BudgetVsActualRow[] = budgets.map((b) => {
    let actual = 0
    for (const line of lines) {
      if (b.costCentreId !== null && line.costCentreId !== b.costCentreId) continue
      if (b.accountId !== null) {
        if (line.accountId !== b.accountId) continue
        actual += b.account!.accountType === 'INCOME' ? (line.creditAmount - line.debitAmount) : (line.debitAmount - line.creditAmount)
      } else {
        if (line.account.accountType !== 'EXPENSE') continue
        actual += line.debitAmount - line.creditAmount
      }
    }
    actual = roundCurrency(actual)
    return {
      budgetId: b.id, costCentreId: b.costCentreId, costCentreName: b.costCentre?.name ?? null,
      accountId: b.accountId, accountName: b.account?.accountName ?? null,
      budgeted: b.amount, actual, variance: roundCurrency(b.amount - actual)
    }
  })

  return { periodYear: params.periodYear, periodMonth: params.periodMonth, rows }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 65 — Statutory (PF/ESI/Professional Tax) Summary Report
// ─────────────────────────────────────────────────────────────────────────────

export interface StatutorySummaryRow { name: string; totalAmount: number; employeeCount: number }
export interface StatutoryComplianceSummaryReport { periodYear: number; periodMonth: number; rows: StatutorySummaryRow[]; totalEmployees: number }

// A real, honest deliverable for "return generation" — this period's total
// employer liability per statutory head (PF/ESI/Professional Tax/anything
// else the owner named a deduction line), not e-filing-ready government
// return XML/forms. Building real per-state/per-scheme return formats would
// need this app to track a moving target (form/schema changes with every
// government notification) it has no channel to keep current — the exact
// fragility this whole feature's suggest-and-review design already exists
// to avoid. Sums SalaryPayment.deductions (the same JSON [{name,amount}]
// shape every payslip already stores) grouped by deduction name — works
// for suggested AND hand-typed lines alike, since both end up in the same field.
async function generateStatutoryComplianceSummaryReport(params: { periodYear: number; periodMonth: number }): Promise<StatutoryComplianceSummaryReport> {
  const db = getPrisma()
  const payments = await db.salaryPayment.findMany({
    where: { periodYear: params.periodYear, periodMonth: params.periodMonth },
    select: { deductions: true }
  })

  const totalByName = new Map<string, number>()
  const employeesByName = new Map<string, Set<number>>()
  payments.forEach((p, idx) => {
    let lines: Array<{ name: string; amount: number }> = []
    try {
      const parsed = JSON.parse(p.deductions)
      if (Array.isArray(parsed)) lines = parsed
    } catch { /* malformed/legacy row — skip, matches payroll.service.ts's own parseLines fallback */ }
    for (const line of lines) {
      if (!line.name || !(line.amount > 0)) continue
      totalByName.set(line.name, (totalByName.get(line.name) ?? 0) + line.amount)
      if (!employeesByName.has(line.name)) employeesByName.set(line.name, new Set())
      employeesByName.get(line.name)!.add(idx)
    }
  })

  const rows: StatutorySummaryRow[] = [...totalByName.entries()]
    .map(([name, totalAmount]) => ({ name, totalAmount: roundCurrency(totalAmount), employeeCount: employeesByName.get(name)?.size ?? 0 }))
    .sort((a, b) => b.totalAmount - a.totalAmount)

  return { periodYear: params.periodYear, periodMonth: params.periodMonth, rows, totalEmployees: payments.length }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 65 — Cash-Flow / Funds-Flow Projection
// ─────────────────────────────────────────────────────────────────────────────

export interface CashFlowDayBucket { date: string; actualNet: number | null; projectedNet: number | null }
export interface CashFlowProjectionReport { asOf: string; daysBack: number; daysForward: number; days: CashFlowDayBucket[] }

function addDays(d: Date, n: number): Date { const r = new Date(d); r.setDate(r.getDate() + n); return r }

// Actuals (past, solid line): real cash movement from the three transactional
// tables that already ARE the source of truth for money in/out — Payment
// (customer money in), Expense + SupplierPayment (money out). Deliberately
// NOT read from JournalEntryLine.bankAccountId — that field is only ever set
// on entries explicitly linked to a specific named BankAccount (e.g. manual
// bank-linked JEs), while ordinary Payment/Expense/Bill postings tag their
// cash line with the generic "Cash & Bank" ledger account instead, so
// bankAccountId alone would silently miss most real transaction volume.
//
// Projected (future, dashed line): open Invoice/Bill balances against their
// own dueDate (a firm, owner-set expected date — undated ones are skipped
// rather than guessed at), plus forecasted EXPENSE-type RecurringProfile
// occurrences within the window. INVOICE/BILL recurring profiles are
// deliberately NOT forecasted here — their payloadJson only snapshots line
// items, and re-deriving a future total would mean re-running full
// tax/discount computation on a stale snapshot, which risks a confidently
// wrong number being worse than the honest gap of omitting it (EXPENSE
// profiles snapshot a flat `amount` field, so no such risk there).
async function generateCashFlowProjection(params: { daysBack?: number; daysForward?: number }): Promise<CashFlowProjectionReport> {
  const db = getPrisma()
  const daysBack = params.daysBack ?? 30
  const daysForward = params.daysForward ?? 30

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const rangeStart = addDays(today, -daysBack)
  const rangeEnd = addDays(today, daysForward)
  const rangeEndOfDay = new Date(rangeEnd); rangeEndOfDay.setHours(23, 59, 59, 999)

  const buckets = new Map<string, CashFlowDayBucket>()
  for (let n = -daysBack; n <= daysForward; n++) {
    const date = toLocalISODate(addDays(today, n))
    buckets.set(date, { date, actualNet: n <= 0 ? 0 : null, projectedNet: n >= 0 ? 0 : null })
  }
  // Today itself carries both an actual (what already happened today) and a
  // projected (what's still due today) figure — the seam where the two lines meet.

  const [payments, expenses, supplierPayments] = await Promise.all([
    db.payment.findMany({ where: { paymentDate: { gte: rangeStart, lte: today }, isReversed: false }, select: { amount: true, paymentDate: true } }),
    db.expense.findMany({ where: { expenseDate: { gte: rangeStart, lte: today } }, select: { amount: true, expenseDate: true } }),
    db.supplierPayment.findMany({ where: { paymentDate: { gte: rangeStart, lte: today }, isReversed: false }, select: { amount: true, paymentDate: true } })
  ])
  for (const p of payments) {
    const b = buckets.get(toLocalISODate(p.paymentDate)); if (b) b.actualNet = (b.actualNet ?? 0) + p.amount
  }
  for (const e of expenses) {
    const b = buckets.get(toLocalISODate(e.expenseDate)); if (b) b.actualNet = (b.actualNet ?? 0) - e.amount
  }
  for (const sp of supplierPayments) {
    const b = buckets.get(toLocalISODate(sp.paymentDate)); if (b) b.actualNet = (b.actualNet ?? 0) - sp.amount
  }

  const [openInvoices, openBills, recurringExpenseProfiles] = await Promise.all([
    db.invoice.findMany({
      where: { balanceAmount: { gt: 0 }, status: { not: 'CANCELLED' }, dueDate: { gte: today, lte: rangeEndOfDay } },
      select: { balanceAmount: true, dueDate: true }
    }),
    db.bill.findMany({
      where: { balanceAmount: { gt: 0 }, status: { not: 'VOID' }, dueDate: { gte: today, lte: rangeEndOfDay } },
      select: { balanceAmount: true, dueDate: true }
    }),
    db.recurringProfile.findMany({
      where: { documentType: 'EXPENSE', active: true, startDate: { lte: rangeEndOfDay } }
    })
  ])
  for (const inv of openInvoices) {
    const b = buckets.get(toLocalISODate(inv.dueDate!)); if (b) b.projectedNet = (b.projectedNet ?? 0) + inv.balanceAmount
  }
  for (const bill of openBills) {
    const b = buckets.get(toLocalISODate(bill.dueDate!)); if (b) b.projectedNet = (b.projectedNet ?? 0) - bill.balanceAmount
  }

  const { getPeriodInfo } = await import('./recurring-profile.service')
  for (let n = 0; n <= daysForward; n++) {
    const day = addDays(today, n)
    for (const profile of recurringExpenseProfiles) {
      if (profile.startDate > day) continue
      if (profile.endDate && profile.endDate < day) continue
      const { periodKey, thresholdDate } = getPeriodInfo(profile.cadence, profile.dayOfPeriod, day)
      if (toLocalISODate(thresholdDate) !== toLocalISODate(day)) continue
      if (profile.lastGeneratedPeriod === periodKey) continue
      let amount = 0
      try { amount = JSON.parse(profile.payloadJson).amount ?? 0 } catch { /* malformed snapshot — skip */ }
      if (amount <= 0) continue
      const b = buckets.get(toLocalISODate(day)); if (b) b.projectedNet = (b.projectedNet ?? 0) - amount
    }
  }

  const days = [...buckets.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((b) => ({ date: b.date, actualNet: b.actualNet !== null ? roundCurrency(b.actualNet) : null, projectedNet: b.projectedNet !== null ? roundCurrency(b.projectedNet) : null }))

  return { asOf: toLocalISODate(today), daysBack, daysForward, days }
}

// ─────────────────────────────────────────────────────────────────────────────
// Combined Cash Position Trend (General template) — Phase 67 §9.1
// ─────────────────────────────────────────────────────────────────────────────

// A day-by-day CUMULATIVE balance trend for the single "Cash & Bank"
// ChartOfAccounts row (accountCode '1000') — genuinely different from both
// existing cash reports above: generateCashFlowProjection shows daily NET
// movement (in minus out, split into actual/projected halves), never a
// running position; generateCashBookReport shows a running balance too, but
// synthesizes it from three transactional tables directly (Payment/Expense/
// SupplierLedger) rather than the real posted GL — the same distinction
// that motivated generateTrialBalanceReport's own Phase 62 rewrite away
// from synthesized figures once a real GL existed to read from. "Combined"
// because every distinct cash-touching transaction type (Payments,
// Expenses, SupplierPayments, Bills, POS sales, PDC clears, etc.) posts to
// this SAME single GL bucket by construction (see generateCashFlowProjection's
// own comment above on this), so this trend is inherently the consolidated
// position across all of them, not per-instrument.
export interface CashPositionTrendPoint { date: string; balance: number }
export interface CashPositionTrendReport {
  dateFrom: string; dateTo: string
  points: CashPositionTrendPoint[]
  openingBalance: number; closingBalance: number; netChange: number
}

async function generateCashPositionTrendReport(params: { dateFrom: string; dateTo: string }): Promise<CashPositionTrendReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const cashAccount = await db.chartOfAccounts.findFirst({ where: { accountCode: '1000' } })
  if (!cashAccount) return { dateFrom: params.dateFrom, dateTo: params.dateTo, points: [], openingBalance: 0, closingBalance: 0, netChange: 0 }

  const [priorLines, rangeLines] = await Promise.all([
    db.journalEntryLine.findMany({
      where: { accountId: cashAccount.id, journalEntry: { entryDate: { lt: from } } },
      select: { debitAmount: true, creditAmount: true }
    }),
    db.journalEntryLine.findMany({
      where: { accountId: cashAccount.id, journalEntry: { entryDate: { gte: from, lte: to } } },
      select: { debitAmount: true, creditAmount: true, journalEntry: { select: { entryDate: true } } }
    })
  ])

  // Cash is a debit-normal ASSET account — same sign convention as
  // generateTrialBalanceReport's own net = debit − credit.
  const openingBalance = roundCurrency(
    sumCurrency(priorLines.map((l) => l.debitAmount)) - sumCurrency(priorLines.map((l) => l.creditAmount))
  )

  const netByDate = new Map<string, number>()
  for (const line of rangeLines) {
    const date = toLocalISODate(line.journalEntry.entryDate)
    netByDate.set(date, (netByDate.get(date) ?? 0) + line.debitAmount - line.creditAmount)
  }

  const points: CashPositionTrendPoint[] = []
  let running = openingBalance
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    const date = toLocalISODate(d)
    running = roundCurrency(running + (netByDate.get(date) ?? 0))
    points.push({ date, balance: running })
  }

  const closingBalance = points.length > 0 ? points[points.length - 1].balance : openingBalance
  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, points,
    openingBalance, closingBalance,
    netChange: roundCurrency(closingBalance - openingBalance)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 65 — Payment Performance Report
// ─────────────────────────────────────────────────────────────────────────────

export interface PaymentPerformanceRow {
  customerId: string; customerName: string
  paidInvoiceCount: number; avgDaysToPay: number | null
  outstandingInvoiceCount: number; outstandingAmount: number
}
export interface PaymentPerformanceReport { dateFrom: string; dateTo: string; rows: PaymentPerformanceRow[]; overallAvgDaysToPay: number | null }

// Days-to-pay's "clock stops" the moment an invoice is FULLY settled — the
// date of its LAST payment (max paymentDate among its own non-reversed
// payments), not the first partial one, since a customer who pays in three
// installments hasn't actually finished paying until the third lands. An
// invoice still carrying a balance contributes to outstandingAmount instead
// of skewing the average with a payment cycle that hasn't finished yet.
// overallAvgDaysToPay is computed from the flat list of every paid invoice's
// own days-to-pay, not an average of per-customer averages — averaging
// averages would silently over-weight a customer with one invoice against
// one with fifty.
async function generatePaymentPerformanceReport(params: { dateFrom: string; dateTo: string }): Promise<PaymentPerformanceReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const invoices = await db.invoice.findMany({
    where: { invoiceDate: { gte: from, lte: to }, status: { not: 'CANCELLED' }, customerId: { not: null } },
    select: {
      invoiceDate: true, balanceAmount: true, customerId: true,
      customer: { select: { customerName: true } },
      payments: { where: { isReversed: false }, select: { paymentDate: true } }
    }
  })

  const byCustomer = new Map<string, { customerName: string; daysList: number[]; outstandingCount: number; outstandingAmount: number }>()
  const allDays: number[] = []
  for (const inv of invoices) {
    if (!inv.customerId) continue
    const entry = byCustomer.get(inv.customerId) ?? { customerName: inv.customer?.customerName ?? 'Unknown', daysList: [], outstandingCount: 0, outstandingAmount: 0 }
    if (inv.balanceAmount <= 0 && inv.payments.length > 0) {
      const lastPaymentDate = inv.payments.reduce((max, p) => (p.paymentDate > max ? p.paymentDate : max), inv.payments[0].paymentDate)
      const days = Math.max(0, Math.floor((lastPaymentDate.getTime() - inv.invoiceDate.getTime()) / 86400000))
      entry.daysList.push(days)
      allDays.push(days)
    } else if (inv.balanceAmount > 0) {
      entry.outstandingCount += 1
      entry.outstandingAmount += inv.balanceAmount
    }
    byCustomer.set(inv.customerId, entry)
  }

  const rows: PaymentPerformanceRow[] = [...byCustomer.entries()].map(([customerId, e]) => ({
    customerId, customerName: e.customerName,
    paidInvoiceCount: e.daysList.length,
    avgDaysToPay: e.daysList.length > 0 ? roundCurrency(e.daysList.reduce((a, b) => a + b, 0) / e.daysList.length) : null,
    outstandingInvoiceCount: e.outstandingCount, outstandingAmount: roundCurrency(e.outstandingAmount)
  })).sort((a, b) => (b.avgDaysToPay ?? -1) - (a.avgDaysToPay ?? -1))

  const overallAvgDaysToPay = allDays.length > 0 ? roundCurrency(allDays.reduce((a, b) => a + b, 0) / allDays.length) : null

  return { dateFrom: params.dateFrom, dateTo: params.dateTo, rows, overallAvgDaysToPay }
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
  const to = params?.dateTo ? toDateEnd(params.dateTo) : undefined
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
  const to = params?.dateTo ? toDateEnd(params.dateTo) : undefined

  // Find all inventory movements triggered by KOT ingredient deductions
  const movements = await db.inventoryMovement.findMany({
    where: {
      movementType: 'ADJUSTMENT',
      quantity: { lt: 0 },
      remarks: { contains: INGREDIENT_DEDUCTION_REMARKS_PREFIX },
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {})
    },
    include: {
      product: { select: { productName: true, unit: true } }
    }
  })

  // Phase 64 — was `m.product.costPrice` (the static, hand-edited field),
  // the same stale-cost gap fixed for the Dashboard/P&L above.
  const costs = await getProductCostsBatch(movements.map(m => m.productId))

  // Aggregate by product
  const byProduct = new Map<string, FoodCostReportRow>()
  for (const m of movements) {
    const key = m.productId
    const used = Math.abs(m.quantity)
    const cost = costs.get(m.productId) ?? 0
    if (byProduct.has(key)) {
      const existing = byProduct.get(key)!
      existing.totalQuantityUsed += used
      existing.totalCost = roundCurrency(existing.totalCost + used * cost)
    } else {
      byProduct.set(key, {
        ingredientName: m.product.productName,
        unit: m.product.unit,
        totalQuantityUsed: used,
        costPrice: cost,
        totalCost: roundCurrency(used * cost)
      })
    }
  }

  const rows = Array.from(byProduct.values()).sort((a, b) => b.totalCost - a.totalCost)
  const totalCost = sumCurrency(rows.map(r => r.totalCost))

  return { dateFrom: params?.dateFrom, dateTo: params?.dateTo, totalCost, rows }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dish-wise Contribution Margin Report (Restaurant template) — Phase 67 §9.1
// ─────────────────────────────────────────────────────────────────────────────

// Per-dish menu-engineering margin: revenue (real, from InvoiceItem lines
// sold in the period) minus THEORETICAL recipe cost (getDishIngredientCostsBatch,
// combo-aware). Deliberately distinct from generateFoodCostReport() above —
// see that function's own comment and getDishIngredientCostsBatch's — this
// answers "which dishes are actually earning their keep," the Food Cost
// Report answers "how much did we spend on food this period." A dish with
// no recipe configured shows 0 cost / 100% margin, not a guess.
export interface DishContributionMarginRow {
  productId: string; productName: string; quantitySold: number
  revenue: number; ingredientCost: number; contributionMargin: number; marginPercent: number
}

export interface DishContributionMarginReport {
  dateFrom?: string; dateTo?: string; rows: DishContributionMarginRow[]
}

async function generateDishContributionMarginReport(params?: { dateFrom?: string; dateTo?: string }): Promise<DishContributionMarginReport> {
  const db = getPrisma()
  const from = params?.dateFrom ? toDate(params.dateFrom) : undefined
  const to = params?.dateTo ? toDateEnd(params.dateTo) : undefined

  const items = await db.invoiceItem.findMany({
    where: {
      invoice: {
        status: 'ACTIVE',
        ...(from || to ? { invoiceDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {})
      }
    },
    select: {
      productId: true, quantity: true, lineTotal: true,
      invoice: { select: { invoiceType: true } },
      product: { select: { productName: true } }
    }
  })

  const byProduct = new Map<string, { productName: string; quantitySold: number; revenue: number }>()
  for (const item of items) {
    const existing = byProduct.get(item.productId) ?? { productName: item.product.productName, quantitySold: 0, revenue: 0 }
    // Same RETURN sign correction as getTopProducts (analytics.service.ts) —
    // a returned dish must reduce both revenue and quantity, not inflate them.
    const sign = item.invoice.invoiceType === 'RETURN' ? -1 : 1
    existing.quantitySold += sign * item.quantity
    existing.revenue += item.lineTotal
    byProduct.set(item.productId, existing)
  }

  const costs = await getDishIngredientCostsBatch([...byProduct.keys()])

  const rows: DishContributionMarginRow[] = Array.from(byProduct.entries()).map(([productId, p]) => {
    const revenue = roundCurrency(p.revenue)
    const ingredientCost = roundCurrency((costs.get(productId) ?? 0) * p.quantitySold)
    const contributionMargin = roundCurrency(revenue - ingredientCost)
    return {
      productId, productName: p.productName, quantitySold: p.quantitySold,
      revenue, ingredientCost, contributionMargin,
      marginPercent: revenue !== 0 ? Math.round((contributionMargin / revenue) * 1000) / 10 : 0
    }
  }).sort((a, b) => b.contributionMargin - a.contributionMargin)

  return { dateFrom: params?.dateFrom, dateTo: params?.dateTo, rows }
}

// ─────────────────────────────────────────────────────────────────────────────
// Table Turnover by Hour Report (Restaurant template) — Phase 67 §9.1
// ─────────────────────────────────────────────────────────────────────────────

// A "table turn" is counted as one KOT created for an invoice that was
// genuinely bound to a table (KOT.tableId is optional — see restaurant.
// service.ts's createKOT — a counter/takeaway sale with no table produces a
// KOT with tableId null, correctly excluded here; a "table turnover" report
// can only honestly speak to actual dine-in seatings). Bucketed by real
// local day-of-week (0=Sun..6=Sat) and hour-of-day (0-23) from KOT.createdAt
// — Date.getDay()/getHours() are always local-time accessors in Node, the
// same implicit-local-time assumption every other report in this file
// already makes; no string-date UTC-parsing risk here since this reads a
// real Date object, not a "YYYY-MM-DD" string.
export interface TableTurnoverCell { dayOfWeek: number; hour: number; count: number }
export interface TableTurnoverByHourReport {
  dateFrom?: string; dateTo?: string
  cells: TableTurnoverCell[] // always the full 7x24 = 168 grid, zero-filled
  summary: { totalTurns: number; peakDayOfWeek: number | null; peakHour: number | null; peakCount: number }
}

async function generateTableTurnoverByHourReport(params?: { dateFrom?: string; dateTo?: string }): Promise<TableTurnoverByHourReport> {
  const db = getPrisma()
  const from = params?.dateFrom ? toDate(params.dateFrom) : undefined
  const to = params?.dateTo ? toDateEnd(params.dateTo) : undefined

  const kots = await db.kOT.findMany({
    where: {
      tableId: { not: null },
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {})
    },
    select: { createdAt: true }
  })

  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  for (const kot of kots) {
    grid[kot.createdAt.getDay()][kot.createdAt.getHours()]++
  }

  const cells: TableTurnoverCell[] = []
  let peakDayOfWeek: number | null = null
  let peakHour: number | null = null
  let peakCount = 0
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const count = grid[day][hour]
      cells.push({ dayOfWeek: day, hour, count })
      if (count > peakCount) { peakCount = count; peakDayOfWeek = day; peakHour = hour }
    }
  }

  return {
    dateFrom: params?.dateFrom, dateTo: params?.dateTo, cells,
    summary: { totalTurns: kots.length, peakDayOfWeek, peakHour, peakCount }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Recipe-vs-Actual Waste Variance Report (Restaurant template) — Phase 67 §9.1
// ─────────────────────────────────────────────────────────────────────────────

// Pairs two independently-sourced numbers per ingredient: what the recipes
// SAY should have been consumed (getRecipeImpliedIngredientUsageBatch, from
// dishes actually sold) against what was ACTUALLY drawn down (the same
// InventoryMovement rows generateFoodCostReport reads — real deductions,
// not a recipe prediction). A large gap in either direction is the real
// signal: actual > implied hints at portion drift, spillage, or theft;
// implied > actual hints at a stale/wrong recipe or ingredient substitution
// that never got recorded. Neither side alone can show this — Food Cost
// Report only has the actual side, Dish Contribution Margin only the
// implied side (as cost, not quantity).
export interface RecipeWasteVarianceRow {
  ingredientProductId: string; ingredientName: string; unit: string
  impliedQuantity: number; actualQuantity: number; varianceQuantity: number; variancePercent: number | null
}
export interface RecipeWasteVarianceReport {
  dateFrom?: string; dateTo?: string; rows: RecipeWasteVarianceRow[]
}

async function generateRecipeWasteVarianceReport(params?: { dateFrom?: string; dateTo?: string }): Promise<RecipeWasteVarianceReport> {
  const db = getPrisma()
  const from = params?.dateFrom ? toDate(params.dateFrom) : undefined
  const to = params?.dateTo ? toDateEnd(params.dateTo) : undefined
  const dateFilter = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined

  const [invoiceItems, movements] = await Promise.all([
    db.invoiceItem.findMany({
      where: { invoice: { status: 'ACTIVE', ...(dateFilter ? { invoiceDate: dateFilter } : {}) } },
      select: { productId: true, quantity: true, invoice: { select: { invoiceType: true } } }
    }),
    db.inventoryMovement.findMany({
      where: {
        movementType: 'ADJUSTMENT', quantity: { lt: 0 },
        remarks: { contains: INGREDIENT_DEDUCTION_REMARKS_PREFIX },
        ...(dateFilter ? { createdAt: dateFilter } : {})
      },
      select: { productId: true, quantity: true }
    })
  ])

  const dishSalesByProduct = new Map<string, number>()
  for (const item of invoiceItems) {
    const sign = item.invoice.invoiceType === 'RETURN' ? -1 : 1
    dishSalesByProduct.set(item.productId, (dishSalesByProduct.get(item.productId) ?? 0) + sign * item.quantity)
  }
  const dishSales = Array.from(dishSalesByProduct.entries()).map(([productId, quantity]) => ({ productId, quantity }))
  const impliedByIngredient = await getRecipeImpliedIngredientUsageBatch(dishSales)

  const actualByIngredient = new Map<string, number>()
  for (const m of movements) {
    actualByIngredient.set(m.productId, (actualByIngredient.get(m.productId) ?? 0) + Math.abs(m.quantity))
  }

  const ingredientIds = [...new Set([...impliedByIngredient.keys(), ...actualByIngredient.keys()])]
  const ingredients = ingredientIds.length > 0
    ? await db.product.findMany({ where: { id: { in: ingredientIds } }, select: { id: true, productName: true, unit: true } })
    : []
  const ingredientById = new Map(ingredients.map(p => [p.id, p]))

  const rows: RecipeWasteVarianceRow[] = ingredientIds.map(id => {
    const implied = roundCurrency(impliedByIngredient.get(id) ?? 0)
    const actual = roundCurrency(actualByIngredient.get(id) ?? 0)
    const varianceQuantity = roundCurrency(actual - implied)
    return {
      ingredientProductId: id,
      ingredientName: ingredientById.get(id)?.productName ?? id,
      unit: ingredientById.get(id)?.unit ?? '',
      impliedQuantity: implied, actualQuantity: actual, varianceQuantity,
      variancePercent: implied !== 0 ? Math.round((varianceQuantity / implied) * 1000) / 10 : null
    }
  }).sort((a, b) => Math.abs(b.varianceQuantity) - Math.abs(a.varianceQuantity))

  return { dateFrom: params?.dateFrom, dateTo: params?.dateTo, rows }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dead-Stock Clearance Report (Retail template) — Phase 67 §9.1
// ─────────────────────────────────────────────────────────────────────────────

// "Hasn't sold in N days, still in stock" is already computed for the AI
// Assistant by ai-aggregations.service.ts's getDeadStock() — deliberately
// NOT reused directly here rather than refactored into a shared function:
// that AI aggregation is tested, live, and answers a different question
// (sorted by staleness, no cost data) than this report needs (sorted by
// CAPITAL LOCKED — quantity x cost, the actual money sitting idle on the
// shelf). Mirroring its query shape rather than disturbing a working,
// already-shipped AI-facing function for a UI-only need.
export interface DeadStockClearanceRow {
  productId: string; productName: string; sku: string | null; unit: string
  currentStock: number; unitCost: number; capitalLocked: number
  lastSoldDate: string | null; daysSinceLastSale: number | null
}
export interface DeadStockClearanceReport {
  asOfDate: string; lookbackDays: number; rows: DeadStockClearanceRow[]
  summary: { totalCapitalLocked: number; itemCount: number }
}

async function generateDeadStockClearanceReport(params?: { days?: number }): Promise<DeadStockClearanceReport> {
  const db = getPrisma()
  const days = params?.days ?? 90
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)

  const products = await db.product.findMany({
    where: { isActive: true },
    select: {
      id: true, productName: true, sku: true, unit: true,
      inventory: { select: { quantity: true } },
      invoiceItems: {
        where: { invoice: { status: 'ACTIVE' } },
        orderBy: { invoice: { invoiceDate: 'desc' } },
        take: 1,
        select: { invoice: { select: { invoiceDate: true } } }
      }
    }
  })

  const withStock = products.filter(p => (p.inventory?.quantity ?? 0) > 0)
  const costs = await getProductCostsBatch(withStock.map(p => p.id))
  const now = Date.now()

  const rows: DeadStockClearanceRow[] = withStock
    .map(p => {
      const lastSoldDate = p.invoiceItems[0]?.invoice.invoiceDate ? toLocalISODate(p.invoiceItems[0].invoice.invoiceDate) : null
      const currentStock = p.inventory?.quantity ?? 0
      const unitCost = costs.get(p.id) ?? 0
      return {
        productId: p.id, productName: p.productName, sku: p.sku, unit: p.unit,
        currentStock, unitCost, capitalLocked: roundCurrency(currentStock * unitCost),
        lastSoldDate,
        daysSinceLastSale: lastSoldDate ? Math.floor((now - parseLocalDateStart(lastSoldDate).getTime()) / 86400000) : null
      }
    })
    .filter(r => !r.lastSoldDate || parseLocalDateStart(r.lastSoldDate) < cutoff)
    .sort((a, b) => b.capitalLocked - a.capitalLocked)

  return {
    asOfDate: toLocalISODate(new Date()), lookbackDays: days, rows,
    summary: { totalCapitalLocked: sumCurrency(rows.map(r => r.capitalLocked)), itemCount: rows.length }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Category Sell-Through Rate Report (Retail template) — Phase 67 §9.1
// ─────────────────────────────────────────────────────────────────────────────

// Sell-through rate = units sold ÷ (units sold + stock available), the
// standard retail formula for "of what could have sold, how much actually
// did." This app has no historical opening-stock snapshot per month (only
// `InventoryMovement`'s append-only ledger and `Inventory.quantity`'s
// current total) — reconstructing a genuine per-month opening balance would
// mean walking that ledger backward from today for every product in every
// category, a much heavier and more fragile computation for a marginal gain
// in precision. Deliberate, disclosed simplification instead (same honesty
// standard as Distributor's Scheme Cost report shipping as a correlation
// view rather than a fabricated causal one): every month in the requested
// range is compared against the SAME current stock-on-hand figure per
// category, not that month's own historical level — this is a trend-over-
// current-inventory view, not a true point-in-time historical one, and the
// UI/Manual say so explicitly.
export interface CategorySellThroughRow {
  month: string; categoryId: string; categoryName: string
  unitsSold: number; currentStock: number; sellThroughRate: number
}
export interface CategorySellThroughReport {
  dateFrom: string; dateTo: string; rows: CategorySellThroughRow[]
}

async function generateCategorySellThroughReport(params: { dateFrom: string; dateTo: string }): Promise<CategorySellThroughReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const categories = await db.productCategory.findMany({ select: { id: true, name: true } })
  if (categories.length === 0) return { dateFrom: params.dateFrom, dateTo: params.dateTo, rows: [] }
  const categoryNameById = new Map(categories.map(c => [c.id, c.name]))

  const catProducts = await db.product.findMany({
    where: { isActive: true, categoryId: { not: null } },
    select: { id: true, categoryId: true }
  })
  const stockRows = await db.inventory.findMany({
    where: { productId: { in: catProducts.map(p => p.id) } },
    select: { productId: true, quantity: true }
  })
  const stockByProduct = new Map(stockRows.map(r => [r.productId, r.quantity]))
  const stockByCategory = new Map<string, number>()
  for (const p of catProducts) {
    if (!p.categoryId) continue
    stockByCategory.set(p.categoryId, (stockByCategory.get(p.categoryId) ?? 0) + (stockByProduct.get(p.id) ?? 0))
  }

  const items = await db.invoiceItem.findMany({
    where: {
      invoice: { status: 'ACTIVE', invoiceDate: { gte: from, lte: to } },
      product: { categoryId: { not: null } }
    },
    select: {
      quantity: true,
      invoice: { select: { invoiceType: true, invoiceDate: true } },
      product: { select: { categoryId: true } }
    }
  })

  const byKey = new Map<string, { month: string; categoryId: string; unitsSold: number }>()
  // Zero-fill every month in the range for every category so a category
  // with zero sales in a given month still appears as a real 0% bar, not a
  // gap the chart would otherwise silently skip.
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
  const end = new Date(to.getFullYear(), to.getMonth(), 1)
  while (cursor <= end) {
    const month = groupLabel(cursor, 'month')
    for (const c of categories) byKey.set(`${month}|${c.id}`, { month, categoryId: c.id, unitsSold: 0 })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  for (const item of items) {
    if (!item.product.categoryId) continue
    const month = groupLabel(item.invoice.invoiceDate, 'month')
    const key = `${month}|${item.product.categoryId}`
    const existing = byKey.get(key)
    if (!existing) continue // outside the zero-filled range (shouldn't happen given the query's own date filter)
    // Same RETURN sign correction as every other report in this file.
    const sign = item.invoice.invoiceType === 'RETURN' ? -1 : 1
    existing.unitsSold += sign * item.quantity
  }

  const rows: CategorySellThroughRow[] = Array.from(byKey.values())
    .map(r => {
      const currentStock = stockByCategory.get(r.categoryId) ?? 0
      const unitsSold = Math.max(0, r.unitsSold) // a category with more returns than sales this month shows 0%, not a negative rate
      const denom = unitsSold + currentStock
      return {
        month: r.month, categoryId: r.categoryId, categoryName: categoryNameById.get(r.categoryId) ?? '',
        unitsSold: r.unitsSold, currentStock,
        sellThroughRate: denom > 0 ? Math.round((unitsSold / denom) * 1000) / 10 : 0
      }
    })
    .sort((a, b) => a.month === b.month ? a.categoryName.localeCompare(b.categoryName) : a.month.localeCompare(b.month))

  return { dateFrom: params.dateFrom, dateTo: params.dateTo, rows }
}

// ─────────────────────────────────────────────────────────────────────────────
// Season/Collection Sell-Through Report (Clothing template) — Phase 67 §9.1
// ─────────────────────────────────────────────────────────────────────────────

// Byte-for-byte the same shape and same disclosed simplification as
// generateCategorySellThroughReport above (current stock compared against
// every month in range, not that month's own historical stock level) —
// grouped by the new free-text Product.season field instead of
// ProductCategory. Products with no season set are excluded entirely
// (there's no meaningful "season" bucket for them), same as the category
// report excludes uncategorized products.
export interface SeasonSellThroughRow {
  month: string; season: string
  unitsSold: number; currentStock: number; sellThroughRate: number
}
export interface SeasonSellThroughReport {
  dateFrom: string; dateTo: string; rows: SeasonSellThroughRow[]
}

async function generateSeasonSellThroughReport(params: { dateFrom: string; dateTo: string }): Promise<SeasonSellThroughReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const seasonRows = await db.product.findMany({ where: { isActive: true, season: { not: null } }, select: { season: true }, distinct: ['season'] })
  const seasons = seasonRows.map(r => r.season!).filter(Boolean)
  if (seasons.length === 0) return { dateFrom: params.dateFrom, dateTo: params.dateTo, rows: [] }

  const seasonProducts = await db.product.findMany({ where: { isActive: true, season: { not: null } }, select: { id: true, season: true } })
  const stockRows = await db.inventory.findMany({ where: { productId: { in: seasonProducts.map(p => p.id) } }, select: { productId: true, quantity: true } })
  const stockByProduct = new Map(stockRows.map(r => [r.productId, r.quantity]))
  const stockBySeason = new Map<string, number>()
  for (const p of seasonProducts) {
    if (!p.season) continue
    stockBySeason.set(p.season, (stockBySeason.get(p.season) ?? 0) + (stockByProduct.get(p.id) ?? 0))
  }

  const items = await db.invoiceItem.findMany({
    where: {
      invoice: { status: 'ACTIVE', invoiceDate: { gte: from, lte: to } },
      product: { season: { not: null } }
    },
    select: {
      quantity: true,
      invoice: { select: { invoiceType: true, invoiceDate: true } },
      product: { select: { season: true } }
    }
  })

  const byKey = new Map<string, { month: string; season: string; unitsSold: number }>()
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1)
  const end = new Date(to.getFullYear(), to.getMonth(), 1)
  while (cursor <= end) {
    const month = groupLabel(cursor, 'month')
    for (const s of seasons) byKey.set(`${month}|${s}`, { month, season: s, unitsSold: 0 })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  for (const item of items) {
    if (!item.product.season) continue
    const month = groupLabel(item.invoice.invoiceDate, 'month')
    const key = `${month}|${item.product.season}`
    const existing = byKey.get(key)
    if (!existing) continue
    const sign = item.invoice.invoiceType === 'RETURN' ? -1 : 1
    existing.unitsSold += sign * item.quantity
  }

  const rows: SeasonSellThroughRow[] = Array.from(byKey.values())
    .map(r => {
      const currentStock = stockBySeason.get(r.season) ?? 0
      const unitsSold = Math.max(0, r.unitsSold)
      const denom = unitsSold + currentStock
      return {
        month: r.month, season: r.season,
        unitsSold: r.unitsSold, currentStock,
        sellThroughRate: denom > 0 ? Math.round((unitsSold / denom) * 1000) / 10 : 0
      }
    })
    .sort((a, b) => a.month === b.month ? a.season.localeCompare(b.season) : a.month.localeCompare(b.month))

  return { dateFrom: params.dateFrom, dateTo: params.dateTo, rows }
}

// ─────────────────────────────────────────────────────────────────────────────
// Size × Style Heatmap Report (Clothing template) — Phase 67 §9.1
// ─────────────────────────────────────────────────────────────────────────────

// "Visualizes exactly which combinations move" — Product IS the "style"
// (no separate style field needed), ProductVariant.size is the size, so this
// is a live grouping over existing InvoiceItem rows, same as Category Mix's
// own no-new-capture-needed precedent. Resolves size via a real
// ProductVariant join by variantId, not InvoiceItem.variantInfo's own
// free-text sale-time snapshot ("M / Blue") — that string is ambiguous to
// re-parse (color-only vs. size-only vs. both) and ProductVariant.size is
// the actual source of truth. Capped to the top 15 styles by net units sold
// so the grid stays legible on a catalog with hundreds of products, matching
// the same table.head-scaling instinct as this file's other bounded reports.
const CLOTHING_SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL']
const MAX_HEATMAP_STYLES = 15

function compareSizes(a: string, b: string): number {
  const aNum = Number(a); const bNum = Number(b)
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) return aNum - bNum
  const aIdx = CLOTHING_SIZE_ORDER.indexOf(a.toUpperCase())
  const bIdx = CLOTHING_SIZE_ORDER.indexOf(b.toUpperCase())
  if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx
  if (aIdx !== -1) return -1
  if (bIdx !== -1) return 1
  return a.localeCompare(b)
}

export interface SizeStyleHeatmapCell { style: string; size: string; unitsSold: number }
export interface SizeStyleHeatmapReport {
  dateFrom: string; dateTo: string
  styles: string[]; sizes: string[]
  cells: SizeStyleHeatmapCell[]
  summary: { totalUnitsSold: number; topCellStyle: string | null; topCellSize: string | null; topCellUnitsSold: number }
}

async function generateSizeStyleHeatmapReport(params: { dateFrom: string; dateTo: string }): Promise<SizeStyleHeatmapReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const items = await db.invoiceItem.findMany({
    where: {
      invoice: { status: 'ACTIVE', invoiceDate: { gte: from, lte: to } },
      variantId: { not: null }
    },
    select: {
      quantity: true, variantId: true,
      invoice: { select: { invoiceType: true } },
      product: { select: { productName: true } }
    }
  })
  if (items.length === 0) return { dateFrom: params.dateFrom, dateTo: params.dateTo, styles: [], sizes: [], cells: [], summary: { totalUnitsSold: 0, topCellStyle: null, topCellSize: null, topCellUnitsSold: 0 } }

  const variantIds = [...new Set(items.map(i => i.variantId!))]
  const variants = await db.productVariant.findMany({ where: { id: { in: variantIds } }, select: { id: true, size: true } })
  const sizeByVariantId = new Map(variants.map(v => [v.id, v.size]))

  const byKey = new Map<string, { style: string; size: string; unitsSold: number }>()
  const styleTotals = new Map<string, number>()
  for (const item of items) {
    const size = sizeByVariantId.get(item.variantId!)
    if (!size) continue
    const style = item.product.productName
    const sign = item.invoice.invoiceType === 'RETURN' ? -1 : 1
    const key = `${style}|${size}`
    const existing = byKey.get(key) ?? { style, size, unitsSold: 0 }
    existing.unitsSold += sign * item.quantity
    byKey.set(key, existing)
    styleTotals.set(style, (styleTotals.get(style) ?? 0) + sign * item.quantity)
  }

  const topStyles = Array.from(styleTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_HEATMAP_STYLES)
    .map(([style]) => style)
  const topStyleSet = new Set(topStyles)

  const cells: SizeStyleHeatmapCell[] = Array.from(byKey.values())
    .filter(c => topStyleSet.has(c.style))
    .map(c => ({ ...c, unitsSold: Math.max(0, c.unitsSold) }))

  const sizes = Array.from(new Set(cells.map(c => c.size))).sort(compareSizes)
  const totalUnitsSold = cells.reduce((s, c) => s + c.unitsSold, 0)
  const topCell = [...cells].sort((a, b) => b.unitsSold - a.unitsSold)[0] ?? null

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    styles: topStyles, sizes, cells,
    summary: {
      totalUnitsSold,
      topCellStyle: topCell?.style ?? null, topCellSize: topCell?.size ?? null, topCellUnitsSold: topCell?.unitsSold ?? 0
    }
  }
}

// Phase 67 §9.1 — Footwear item 4: Size Availability Heatmap. Deliberately a
// SEPARATE report from generateSizeStyleHeatmapReport above despite the near-
// identical styles×sizes grid shape — that one answers "what sold," this one
// answers "what's out right now": a live CURRENT-STATE stock snapshot, not a
// sales history over a date range (no dateFrom/dateTo params at all, same
// convention generateDeadStockClearanceReport already established for a
// current-state report). Reuses MAX_HEATMAP_STYLES/compareSizes as-is.
export type SizeAvailabilityStatus = 'OUT' | 'LOW' | 'IN'
export interface SizeAvailabilityHeatmapCell { style: string; size: string; stockQty: number; status: SizeAvailabilityStatus }
export interface SizeAvailabilityHeatmapReport {
  lowStockThreshold: number
  styles: string[]; sizes: string[]
  cells: SizeAvailabilityHeatmapCell[]
  summary: { totalStyles: number; outOfStockCells: number; lowStockCells: number; styleWithMostGaps: string | null; styleGapCount: number }
}

async function generateSizeAvailabilityHeatmapReport(params?: { lowStockThreshold?: number }): Promise<SizeAvailabilityHeatmapReport> {
  const db = getPrisma()
  const lowStockThreshold = params?.lowStockThreshold ?? 3

  const variants = await db.productVariant.findMany({
    where: { isActive: true, size: { not: null }, product: { isActive: true } },
    select: { size: true, stockQty: true, product: { select: { productName: true } } }
  })
  if (variants.length === 0) {
    return { lowStockThreshold, styles: [], sizes: [], cells: [], summary: { totalStyles: 0, outOfStockCells: 0, lowStockCells: 0, styleWithMostGaps: null, styleGapCount: 0 } }
  }

  // Stock is summed across colour/width for a given style×size cell — the
  // question is "is size 9 available in THIS style at all," not broken down
  // further by colour, matching the audit's own "which sizes are out for a
  // given style" framing.
  const byKey = new Map<string, { style: string; size: string; stockQty: number }>()
  const gapsByStyle = new Map<string, number>()
  for (const v of variants) {
    const style = v.product.productName
    const size = v.size!
    const key = `${style}|${size}`
    const existing = byKey.get(key) ?? { style, size, stockQty: 0 }
    existing.stockQty += v.stockQty
    byKey.set(key, existing)
  }
  for (const cell of byKey.values()) {
    if (cell.stockQty === 0) gapsByStyle.set(cell.style, (gapsByStyle.get(cell.style) ?? 0) + 1)
  }

  // Styles with the most stockouts surface first — the most actionable ones,
  // not the highest-volume ones (there's no "units sold" concept for a live
  // stock snapshot the way the sales heatmap has).
  const topStyles = Array.from(new Set(Array.from(byKey.values()).map(c => c.style)))
    .sort((a, b) => (gapsByStyle.get(b) ?? 0) - (gapsByStyle.get(a) ?? 0))
    .slice(0, MAX_HEATMAP_STYLES)
  const topStyleSet = new Set(topStyles)

  const cells: SizeAvailabilityHeatmapCell[] = Array.from(byKey.values())
    .filter(c => topStyleSet.has(c.style))
    .map(c => ({
      ...c,
      status: c.stockQty === 0 ? 'OUT' : c.stockQty <= lowStockThreshold ? 'LOW' : 'IN'
    }))

  const sizes = Array.from(new Set(cells.map(c => c.size))).sort(compareSizes)
  const outOfStockCells = cells.filter(c => c.status === 'OUT').length
  const lowStockCells = cells.filter(c => c.status === 'LOW').length
  const topGapEntry = [...gapsByStyle.entries()].sort((a, b) => b[1] - a[1])[0] ?? null

  return {
    lowStockThreshold, styles: topStyles, sizes, cells,
    summary: {
      totalStyles: topStyles.length, outOfStockCells, lowStockCells,
      styleWithMostGaps: topGapEntry?.[0] ?? null, styleGapCount: topGapEntry?.[1] ?? 0
    }
  }
}

// Phase 68 §9.1 — Gym/Studio item 4: Class Attendance Heatmap. className ×
// day-of-week grid of real check-in counts (BatchClassAttendance), not
// enrollment counts — a class can be fully enrolled and still poorly
// attended, which is the actual signal a heatmap should surface.
const DAY_OF_WEEK_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export interface ClassAttendanceHeatmapCell { className: string; dayOfWeek: string; checkInCount: number }
export interface ClassAttendanceHeatmapReport {
  dateFrom: string; dateTo: string
  classNames: string[]; daysOfWeek: string[]
  cells: ClassAttendanceHeatmapCell[]
  summary: { totalCheckIns: number; busiestClassName: string | null; busiestDay: string | null }
}

async function generateClassAttendanceHeatmapReport(params: { dateFrom: string; dateTo: string }): Promise<ClassAttendanceHeatmapReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const records = await db.batchClassAttendance.findMany({
    where: { sessionDate: { gte: from, lte: to } },
    select: { sessionDate: true, class: { select: { className: true } } },
  })
  if (records.length === 0) return { dateFrom: params.dateFrom, dateTo: params.dateTo, classNames: [], daysOfWeek: [], cells: [], summary: { totalCheckIns: 0, busiestClassName: null, busiestDay: null } }

  const byKey = new Map<string, ClassAttendanceHeatmapCell>()
  const byClassName = new Map<string, number>()
  const byDay = new Map<string, number>()
  for (const r of records) {
    const className = r.class.className
    const dayOfWeek = DAY_OF_WEEK_LABELS[r.sessionDate.getDay()]
    const key = `${className}|${dayOfWeek}`
    const existing = byKey.get(key) ?? { className, dayOfWeek, checkInCount: 0 }
    existing.checkInCount += 1
    byKey.set(key, existing)
    byClassName.set(className, (byClassName.get(className) ?? 0) + 1)
    byDay.set(dayOfWeek, (byDay.get(dayOfWeek) ?? 0) + 1)
  }

  const classNames = Array.from(byClassName.entries()).sort((a, b) => b[1] - a[1]).map(([name]) => name)
  const daysOfWeek = DAY_OF_WEEK_LABELS.filter((d) => byDay.has(d))
  const cells = Array.from(byKey.values())
  const busiestClassName = classNames[0] ?? null
  const busiestDay = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, classNames, daysOfWeek, cells,
    summary: { totalCheckIns: records.length, busiestClassName, busiestDay },
  }
}

// Phase 68 §9.1 — Gym/Studio items 1/2: membership-expiring-this-week list
// is already the real feature getExpiringMemberships (daysAhead=7) covers,
// live in MembershipsScreen.tsx's own "Next 7 days" tab — this closes the
// missing REPORT half. A membership "renewed" when the SAME client has
// another (different) membership whose startDate falls within 14 days of
// this one's own endDate — a real grace window, not same-day-only, since a
// member renewing a few days late is still a genuine renewal, not a churn.
const RENEWAL_GRACE_DAYS = 14
export interface MembershipRenewalFunnelRow { planName: string; expiredCount: number; renewedCount: number; renewalRatePercent: number }
export interface MembershipRenewalFunnelReport {
  dateFrom: string; dateTo: string
  rows: MembershipRenewalFunnelRow[]
  summary: { totalExpired: number; totalRenewed: number; overallRenewalRatePercent: number }
}

async function generateMembershipRenewalFunnelReport(params: { dateFrom: string; dateTo: string }): Promise<MembershipRenewalFunnelReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const expired = await db.membership.findMany({
    where: { endDate: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
    select: { id: true, clientId: true, endDate: true, plan: { select: { planName: true } } },
  })
  if (expired.length === 0) return { dateFrom: params.dateFrom, dateTo: params.dateTo, rows: [], summary: { totalExpired: 0, totalRenewed: 0, overallRenewalRatePercent: 0 } }

  const clientIds = [...new Set(expired.map((m) => m.clientId))]
  const allClientMemberships = await db.membership.findMany({
    where: { clientId: { in: clientIds } },
    select: { id: true, clientId: true, startDate: true },
  })
  const byClient = new Map<string, Array<{ id: string; startDate: Date }>>()
  for (const m of allClientMemberships) {
    const list = byClient.get(m.clientId) ?? []
    list.push({ id: m.id, startDate: m.startDate })
    byClient.set(m.clientId, list)
  }

  const round1 = (n: number) => Math.round(n * 10) / 10
  const byPlan = new Map<string, { expiredCount: number; renewedCount: number }>()
  let totalRenewed = 0
  for (const m of expired) {
    const graceEnd = new Date(m.endDate.getTime() + RENEWAL_GRACE_DAYS * 86400000)
    const others = byClient.get(m.clientId) ?? []
    const renewed = others.some((o) => o.id !== m.id && o.startDate >= m.endDate && o.startDate <= graceEnd)
    if (renewed) totalRenewed++
    const planName = m.plan.planName
    const entry = byPlan.get(planName) ?? { expiredCount: 0, renewedCount: 0 }
    entry.expiredCount += 1
    if (renewed) entry.renewedCount += 1
    byPlan.set(planName, entry)
  }

  const rows: MembershipRenewalFunnelRow[] = Array.from(byPlan.entries())
    .map(([planName, v]) => ({ planName, expiredCount: v.expiredCount, renewedCount: v.renewedCount, renewalRatePercent: v.expiredCount > 0 ? round1((v.renewedCount / v.expiredCount) * 100) : 0 }))
    .sort((a, b) => a.renewalRatePercent - b.renewalRatePercent)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, rows,
    summary: { totalExpired: expired.length, totalRenewed, overallRenewalRatePercent: expired.length > 0 ? round1((totalRenewed / expired.length) * 100) : 0 },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Category Mix Report (General template) — Phase 67 §9.1
// ─────────────────────────────────────────────────────────────────────────────

// "What share of my business comes from each category" — a single-period
// revenue+unit breakdown by ProductCategory, unlike Category Sell-Through's
// own month-by-month rate-vs-stock view above (a different question this
// codebase already answers). `ProductCategory` is user-defined, hence
// "user-defined category mix" — no new capture needed, this is purely a
// live grouping over existing InvoiceItem rows, confirmed via grounding
// (the Sales report's own chart groups by day/hour only, never by
// category; only the separate Inventory Report chart happens to group
// stock VALUE by category — no report anywhere groups REVENUE by category
// before this one). `lineTotal` is already signed correctly for a RETURN
// invoice item (only `quantity` is always stored positive) — same
// convention `getBottomRevenueProducts` (ai-aggregations.service.ts)
// already established, mirrored here rather than re-deriving it.
export interface CategoryMixRow {
  categoryId: string; categoryName: string
  unitsSold: number; revenue: number; revenuePercent: number
}
export interface CategoryMixReport {
  dateFrom: string; dateTo: string
  rows: CategoryMixRow[]
  summary: { totalRevenue: number; categoryCount: number }
}

async function generateCategoryMixReport(params: { dateFrom: string; dateTo: string }): Promise<CategoryMixReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const categories = await db.productCategory.findMany({ select: { id: true, name: true } })
  if (categories.length === 0) return { dateFrom: params.dateFrom, dateTo: params.dateTo, rows: [], summary: { totalRevenue: 0, categoryCount: 0 } }
  const categoryNameById = new Map(categories.map(c => [c.id, c.name]))

  const items = await db.invoiceItem.findMany({
    where: {
      invoice: { status: 'ACTIVE', invoiceDate: { gte: from, lte: to } },
      product: { categoryId: { not: null } }
    },
    select: {
      quantity: true, lineTotal: true,
      invoice: { select: { invoiceType: true } },
      product: { select: { categoryId: true } }
    }
  })

  const byCategory = new Map<string, { unitsSold: number; revenue: number }>()
  for (const item of items) {
    const catId = item.product.categoryId
    if (!catId) continue
    const sign = item.invoice.invoiceType === 'RETURN' ? -1 : 1
    const existing = byCategory.get(catId) ?? { unitsSold: 0, revenue: 0 }
    existing.unitsSold += sign * item.quantity
    existing.revenue += item.lineTotal
    byCategory.set(catId, existing)
  }

  const totalRevenue = sumCurrency(Array.from(byCategory.values()).map(v => v.revenue))
  const rows: CategoryMixRow[] = Array.from(byCategory.entries())
    .map(([categoryId, v]) => ({
      categoryId, categoryName: categoryNameById.get(categoryId) ?? '',
      unitsSold: v.unitsSold, revenue: roundCurrency(v.revenue),
      revenuePercent: totalRevenue !== 0 ? Math.round((v.revenue / totalRevenue) * 1000) / 10 : 0
    }))
    .sort((a, b) => b.revenue - a.revenue)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, rows,
    summary: { totalRevenue, categoryCount: rows.length }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Margin by Brand/Vendor Report (Clothing/Footwear template) — Phase 67 §9.1,
// item 5, closing the Clothing vertical's 5-item signature-win set.
// ─────────────────────────────────────────────────────────────────────────────

// "Which vendor's/brand's lines are actually profitable" — a single-period
// revenue+COGS+margin breakdown by SUPPLIER, reusing the pre-existing
// Product.defaultSupplierId as "vendor/brand" per the audit's own field
// note (no dedicated brand field exists in this schema, and none is needed
// — a clothing shop's "brand" for margin purposes IS which vendor supplies
// it). Structurally mirrors generateCategoryMixReport's own grouping shape
// exactly, just keyed by supplier instead of category, with COGS added via
// getProductCostsBatch() — the same valuation-method-aware resolver
// generateProfitAndLossReport already uses, rather than the stale
// hand-edited Product.costPrice field.
export interface VendorMarginRow {
  supplierId: string; supplierName: string
  revenue: number; cogs: number; margin: number; marginPercent: number
}
export interface VendorMarginReport {
  dateFrom: string; dateTo: string
  rows: VendorMarginRow[]
  summary: { totalRevenue: number; totalCogs: number; totalMargin: number; vendorCount: number }
}

async function generateVendorMarginReport(params: { dateFrom: string; dateTo: string }): Promise<VendorMarginReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const suppliers = await db.supplier.findMany({ select: { id: true, supplierName: true } })
  if (suppliers.length === 0) return { dateFrom: params.dateFrom, dateTo: params.dateTo, rows: [], summary: { totalRevenue: 0, totalCogs: 0, totalMargin: 0, vendorCount: 0 } }
  const supplierNameById = new Map(suppliers.map(s => [s.id, s.supplierName]))

  // Same "leave uncaptured rows out entirely rather than bucket them as
  // Unassigned" convention generateCategoryMixReport already established
  // for its own uncategorized-product case.
  const items = await db.invoiceItem.findMany({
    where: {
      invoice: { status: 'ACTIVE', invoiceDate: { gte: from, lte: to } },
      product: { defaultSupplierId: { not: null } }
    },
    select: {
      productId: true, quantity: true, lineTotal: true,
      invoice: { select: { invoiceType: true } },
      product: { select: { defaultSupplierId: true } }
    }
  })

  const costs = await getProductCostsBatch(items.map(it => it.productId))

  const bySupplier = new Map<string, { revenue: number; cogs: number }>()
  for (const item of items) {
    const supplierId = item.product.defaultSupplierId
    if (!supplierId) continue
    // Same RETURN sign correction generateProfitAndLossReport's own COGS
    // computation uses — quantity is always stored positive (used to
    // restock inventory), so a return's COGS must drop too, not rise as a
    // second sale; item.lineTotal is already correctly signed for revenue.
    const sign = item.invoice.invoiceType === 'RETURN' ? -1 : 1
    const existing = bySupplier.get(supplierId) ?? { revenue: 0, cogs: 0 }
    existing.revenue += item.lineTotal
    existing.cogs += sign * item.quantity * (costs.get(item.productId) ?? 0)
    bySupplier.set(supplierId, existing)
  }

  const totalRevenue = sumCurrency(Array.from(bySupplier.values()).map(v => v.revenue))
  const totalCogs = sumCurrency(Array.from(bySupplier.values()).map(v => v.cogs))
  const rows: VendorMarginRow[] = Array.from(bySupplier.entries())
    .map(([supplierId, v]) => {
      const revenue = roundCurrency(v.revenue)
      const cogs = roundCurrency(v.cogs)
      const margin = roundCurrency(revenue - cogs)
      return {
        supplierId, supplierName: supplierNameById.get(supplierId) ?? '',
        revenue, cogs, margin,
        marginPercent: revenue !== 0 ? Math.round((margin / revenue) * 1000) / 10 : 0
      }
    })
    .sort((a, b) => b.margin - a.margin)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, rows,
    summary: { totalRevenue, totalCogs, totalMargin: roundCurrency(totalRevenue - totalCogs), vendorCount: rows.length }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Brand-Wise Margin & Return-Rate Report (Footwear template) — Phase 67 §9.1,
// item 2. A distinct Footwear-only item from Clothing's own Margin by
// Brand/Vendor above (item 5) — the audit's own framing is specifically
// "footwear returns run higher than apparel; track it by brand," a real
// operational signal a plain margin-only view can't surface: a brand with
// a healthy margin can still be quietly eating into it through an
// above-average return rate. Kept as its own function rather than adding a
// returnRate field onto generateVendorMarginReport() — the two are
// separate audit items on separate verticals with independently evolving
// requirements (matches this file's own precedent of Category
// Sell-Through vs. Season Sell-Through: algorithmically similar, never
// merged into one shared function).
export interface BrandMarginReturnRateRow {
  supplierId: string; supplierName: string
  revenue: number; cogs: number; margin: number; marginPercent: number
  unitsSold: number; unitsReturned: number; returnRatePercent: number
}
export interface BrandMarginReturnRateReport {
  dateFrom: string; dateTo: string
  rows: BrandMarginReturnRateRow[]
  summary: { totalRevenue: number; totalMargin: number; overallReturnRatePercent: number; vendorCount: number }
}

async function generateBrandMarginReturnRateReport(params: { dateFrom: string; dateTo: string }): Promise<BrandMarginReturnRateReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const suppliers = await db.supplier.findMany({ select: { id: true, supplierName: true } })
  if (suppliers.length === 0) return { dateFrom: params.dateFrom, dateTo: params.dateTo, rows: [], summary: { totalRevenue: 0, totalMargin: 0, overallReturnRatePercent: 0, vendorCount: 0 } }
  const supplierNameById = new Map(suppliers.map(s => [s.id, s.supplierName]))

  const items = await db.invoiceItem.findMany({
    where: {
      invoice: { status: 'ACTIVE', invoiceDate: { gte: from, lte: to } },
      product: { defaultSupplierId: { not: null } }
    },
    select: {
      productId: true, quantity: true, lineTotal: true,
      invoice: { select: { invoiceType: true } },
      product: { select: { defaultSupplierId: true } }
    }
  })

  const costs = await getProductCostsBatch(items.map(it => it.productId))

  // Unlike generateVendorMarginReport, units sold and units returned are
  // tracked SEPARATELY (not netted) — a return rate needs the raw
  // numerator/denominator, not a net quantity that could mask a high
  // return volume against an equally high sales volume.
  const bySupplier = new Map<string, { revenue: number; cogs: number; unitsSold: number; unitsReturned: number }>()
  for (const item of items) {
    const supplierId = item.product.defaultSupplierId
    if (!supplierId) continue
    const isReturn = item.invoice.invoiceType === 'RETURN'
    const sign = isReturn ? -1 : 1
    const existing = bySupplier.get(supplierId) ?? { revenue: 0, cogs: 0, unitsSold: 0, unitsReturned: 0 }
    existing.revenue += item.lineTotal
    existing.cogs += sign * item.quantity * (costs.get(item.productId) ?? 0)
    if (isReturn) existing.unitsReturned += item.quantity
    else existing.unitsSold += item.quantity
    bySupplier.set(supplierId, existing)
  }

  const totalRevenue = sumCurrency(Array.from(bySupplier.values()).map(v => v.revenue))
  const totalCogs = sumCurrency(Array.from(bySupplier.values()).map(v => v.cogs))
  const totalUnitsSold = Array.from(bySupplier.values()).reduce((s, v) => s + v.unitsSold, 0)
  const totalUnitsReturned = Array.from(bySupplier.values()).reduce((s, v) => s + v.unitsReturned, 0)

  const rows: BrandMarginReturnRateRow[] = Array.from(bySupplier.entries())
    .map(([supplierId, v]) => {
      const revenue = roundCurrency(v.revenue)
      const cogs = roundCurrency(v.cogs)
      const margin = roundCurrency(revenue - cogs)
      return {
        supplierId, supplierName: supplierNameById.get(supplierId) ?? '',
        revenue, cogs, margin,
        marginPercent: revenue !== 0 ? Math.round((margin / revenue) * 1000) / 10 : 0,
        unitsSold: v.unitsSold, unitsReturned: v.unitsReturned,
        returnRatePercent: v.unitsSold > 0 ? Math.round((v.unitsReturned / v.unitsSold) * 1000) / 10 : 0
      }
    })
    .sort((a, b) => b.margin - a.margin)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, rows,
    summary: {
      totalRevenue, totalMargin: roundCurrency(totalRevenue - totalCogs),
      overallReturnRatePercent: totalUnitsSold > 0 ? Math.round((totalUnitsReturned / totalUnitsSold) * 1000) / 10 : 0,
      vendorCount: rows.length
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Basket Composition Report (Retail template) — Phase 67 §9.1
// ─────────────────────────────────────────────────────────────────────────────

// "Which products tend to be bought together" — a pairwise co-occurrence
// count over InvoiceItem rows grouped by invoice (a "basket"). RETURN
// invoices are excluded entirely, not sign-corrected — a returned basket's
// item pairing was never a genuine co-purchase decision at checkout, unlike
// a quantity/revenue figure that can be honestly negated instead.
export interface BasketPairRow {
  productAId: string; productAName: string
  productBId: string; productBName: string
  basketCount: number
}
export interface BasketCompositionReport {
  dateFrom: string; dateTo: string
  summary: { totalBaskets: number; avgItemsPerBasket: number; avgBasketValue: number }
  rows: BasketPairRow[]
}

async function generateBasketCompositionReport(params: { dateFrom: string; dateTo: string }): Promise<BasketCompositionReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const invoices = await db.invoice.findMany({
    where: { status: 'ACTIVE', invoiceType: { not: 'RETURN' }, invoiceDate: { gte: from, lte: to } },
    select: {
      totalAmount: true,
      items: { select: { productId: true, product: { select: { productName: true } } } }
    }
  })

  let totalItems = 0
  let totalValue = 0
  const pairCounts = new Map<string, BasketPairRow>()

  for (const inv of invoices) {
    // Distinct products only — buying 3 units of the same product isn't a
    // "pairing," and a duplicated line must never double-count a pair.
    const distinct = new Map<string, string>()
    for (const item of inv.items) distinct.set(item.productId, item.product.productName)
    const productIds = Array.from(distinct.keys())

    // Every real basket counts toward the averages, including single-item
    // ones — only the PAIRING logic below needs at least 2 products.
    totalItems += productIds.length
    totalValue += inv.totalAmount
    if (productIds.length < 2) continue

    // Sort so productAId < productBId consistently — the SAME pair seen in
    // two different baskets ({X,Y} then {Y,X}) must always collapse into one
    // key, never be double-counted as two different "pairs."
    for (let i = 0; i < productIds.length; i++) {
      for (let j = i + 1; j < productIds.length; j++) {
        const [aId, bId] = [productIds[i], productIds[j]].sort()
        const existing = pairCounts.get(`${aId}|${bId}`)
        if (existing) { existing.basketCount++; continue }
        pairCounts.set(`${aId}|${bId}`, {
          productAId: aId, productAName: distinct.get(aId)!,
          productBId: bId, productBName: distinct.get(bId)!,
          basketCount: 1
        })
      }
    }
  }

  const totalBaskets = invoices.length
  const rows = Array.from(pairCounts.values()).sort((a, b) => b.basketCount - a.basketCount)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      totalBaskets,
      avgItemsPerBasket: totalBaskets > 0 ? Math.round((totalItems / totalBaskets) * 10) / 10 : 0,
      avgBasketValue: totalBaskets > 0 ? roundCurrency(totalValue / totalBaskets) : 0
    },
    rows
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Fast-Mover vs. Slow-Mover Matrix (Hardware template) — Phase 67 §9.1
// ─────────────────────────────────────────────────────────────────────────────

// A scatter of velocity (units sold per day, RETURN-sign-corrected the same
// way as every other report in this file) against margin (%, from the same
// getProductCostsBatch() valuation basis dead-stock/GSTR reports already use)
// — no dedicated "sales velocity" concept existed anywhere in this codebase
// before this report, confirmed via a codebase-wide grep. Quadrant split by
// the MEDIAN of each axis across only products that actually sold in the
// period (a fixed absolute threshold would be meaningless across wildly
// different-sized stores) — matches the item's own "matrix" framing: a real
// 2x2, not just a flat scatter with no actionable grouping.
export type MoverQuadrant = 'FAST_HIGH_MARGIN' | 'FAST_LOW_MARGIN' | 'SLOW_HIGH_MARGIN' | 'SLOW_LOW_MARGIN'
export interface FastSlowMoverRow {
  productId: string; productName: string; sku: string | null
  quantitySold: number; velocity: number
  sellingPrice: number; unitCost: number; marginPercent: number
  quadrant: MoverQuadrant
}
export interface FastSlowMoverMatrixReport {
  dateFrom: string; dateTo: string; days: number
  velocityMedian: number; marginMedian: number
  rows: FastSlowMoverRow[]
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

async function generateFastSlowMoverMatrixReport(params: { dateFrom: string; dateTo: string }): Promise<FastSlowMoverMatrixReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)
  const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000))

  const items = await db.invoiceItem.findMany({
    where: { invoice: { status: 'ACTIVE', invoiceDate: { gte: from, lte: to } } },
    select: {
      productId: true, quantity: true,
      invoice: { select: { invoiceType: true } },
      product: { select: { productName: true, sku: true, sellingPrice: true } }
    }
  })

  const agg = new Map<string, { productName: string; sku: string | null; sellingPrice: number; quantitySold: number }>()
  for (const item of items) {
    const existing = agg.get(item.productId) ?? {
      productName: item.product.productName, sku: item.product.sku,
      sellingPrice: item.product.sellingPrice, quantitySold: 0
    }
    const sign = item.invoice.invoiceType === 'RETURN' ? -1 : 1
    existing.quantitySold += sign * item.quantity
    agg.set(item.productId, existing)
  }

  const sold = Array.from(agg.entries()).filter(([, v]) => v.quantitySold > 0)
  const costs = await getProductCostsBatch(sold.map(([productId]) => productId))

  const preRows = sold.map(([productId, v]) => {
    const unitCost = costs.get(productId) ?? 0
    const velocity = Math.round((v.quantitySold / days) * 100) / 100
    const marginPercent = v.sellingPrice > 0 ? Math.round(((v.sellingPrice - unitCost) / v.sellingPrice) * 1000) / 10 : 0
    return { productId, productName: v.productName, sku: v.sku, quantitySold: v.quantitySold, velocity, sellingPrice: v.sellingPrice, unitCost, marginPercent }
  })

  const velocityMedian = median(preRows.map(r => r.velocity))
  const marginMedian = median(preRows.map(r => r.marginPercent))

  const rows: FastSlowMoverRow[] = preRows
    .map(r => ({
      ...r,
      quadrant: (r.velocity >= velocityMedian
        ? (r.marginPercent >= marginMedian ? 'FAST_HIGH_MARGIN' : 'FAST_LOW_MARGIN')
        : (r.marginPercent >= marginMedian ? 'SLOW_HIGH_MARGIN' : 'SLOW_LOW_MARGIN')) as MoverQuadrant
    }))
    .sort((a, b) => b.velocity - a.velocity)

  return { dateFrom: params.dateFrom, dateTo: params.dateTo, days, velocityMedian, marginMedian, rows }
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
  const to = toDateEnd(params.dateTo)

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
          invoiceDate: toLocalISODate(new Date(inv.invoiceDate)),
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
  const to = toDateEnd(params.dateTo)

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
  const to = toDateEnd(params.dateTo)

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
  // Table 3.1(d) — inward supplies liable to reverse charge. Real, Phase 62
  // addition: Bill carries a proper line-level tax split so its
  // contribution here is exact; Expense has no tax-rate/amount field at
  // all (a single flat `amount`), so an RCM expense contributes its full
  // amount to taxableValue with no computable tax split — flagged plainly
  // via `expenseTaxNotComputable`, never silently guessed at.
  table31d: {
    taxableValue: number
    taxAmount: number
    expenseTaxNotComputable: boolean
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
  const to = toDateEnd(params.dateTo)

  const [invoices, rcmBills, rcmExpenses] = await Promise.all([
    db.invoice.findMany({
      where: { invoiceDate: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
      include: { customer: { select: { taxNumber: true, state: true } }, items: true },
      orderBy: { invoiceDate: 'asc' }
    }),
    // Table 3.1(d) — RCM Bills carry a real tax-exclusive totalAmount plus a
    // separately tracked taxAmount (see bill.service.ts's own RCM comment).
    db.bill.findMany({
      where: { billDate: { gte: from, lte: to }, isReverseCharge: true, status: { not: 'VOID' } },
      select: { totalAmount: true, taxAmount: true }
    }),
    db.expense.findMany({
      where: { expenseDate: { gte: from, lte: to }, isReverseCharge: true },
      select: { amount: true }
    })
  ])

  const table31d = {
    taxableValue: roundCurrency(
      sumCurrency(rcmBills.map((b) => b.totalAmount)) + sumCurrency(rcmExpenses.map((e) => e.amount))
    ),
    taxAmount: roundCurrency(sumCurrency(rcmBills.map((b) => b.taxAmount))),
    expenseTaxNotComputable: rcmExpenses.length > 0
  }

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
    table31d,
    table32: Array.from(stateMap.values()),
    notes: [
      ...(table31d.expenseTaxNotComputable
        ? ['One or more reverse-charge Expenses in this period have no separate tax-rate/amount field — their full amount is included in Table 3.1(d) taxable value, but not in its tax total. Check those manually.']
        : []),
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
  const to = toDateEnd(params.dateTo)

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
    date: toLocalISODate(new Date(a.scheduledDate)),
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
  const to = toDateEnd(params.dateTo)
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
      firstVisitEver: toLocalISODate(data.firstEver),
      lastVisit: toLocalISODate(data.lastVisit),
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
    paidDate: r.paidDate ? toLocalISODate(r.paidDate) : null,
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

// ─────────────────────────────────────────────────────────────────────────────
// Discounts & Bargained Pricing Report
// ─────────────────────────────────────────────────────────────────────────────

async function generateDiscountReport(params: { dateFrom: string; dateTo: string }): Promise<DiscountReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const invoices = await db.invoice.findMany({
    where: { invoiceDate: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
    include: {
      customer: { select: { customerName: true } },
      createdBy: { select: { fullName: true } },
      items: { select: { productName: true, quantity: true, unitPrice: true, discountAmount: true } }
    },
    orderBy: { invoiceDate: 'asc' }
  })

  // A RETURN invoice's item-level discountAmount is stored as a positive
  // magnitude, same sign-correction idiom as generateSalesReport's
  // totalDiscount — without it, a return's discount would double-count as
  // if it were an additional sale's discount rather than reversing one.
  const sign = (inv: (typeof invoices)[number]) => (inv.invoiceType === 'RETURN' ? -1 : 1)

  let totalDiscountGiven = 0
  let discountedLineCount = 0
  let totalLineCount = 0
  let discountPercentSum = 0
  const staffMap = new Map<string, DiscountByStaffRow>()
  const productMap = new Map<string, DiscountByProductRow>()
  const rows: DiscountReportRow[] = []

  for (const inv of invoices) {
    const staffName = inv.createdBy?.fullName ?? 'Unknown'
    for (const item of inv.items) {
      totalLineCount += 1
      if (item.discountAmount <= 0) continue

      const s = sign(inv)
      const discount = s * item.discountAmount
      const lineGross = item.quantity * item.unitPrice
      const discountPercent = lineGross > 0 ? (item.discountAmount / lineGross) * 100 : 0

      totalDiscountGiven += discount
      discountedLineCount += 1
      discountPercentSum += discountPercent

      const staffRow = staffMap.get(staffName) ?? { staffName, discountGiven: 0, lineCount: 0 }
      staffRow.discountGiven += discount
      staffRow.lineCount += 1
      staffMap.set(staffName, staffRow)

      const productRow = productMap.get(item.productName) ?? { productName: item.productName, discountGiven: 0, lineCount: 0 }
      productRow.discountGiven += discount
      productRow.lineCount += 1
      productMap.set(item.productName, productRow)

      rows.push({
        invoiceNumber: inv.invoiceNumber,
        date: toLocalISODate(new Date(inv.invoiceDate)),
        customer: inv.customer?.customerName ?? null,
        productName: item.productName,
        quantity: item.quantity,
        lineGross,
        discountAmount: discount,
        discountPercent: roundCurrency(discountPercent),
        staffName: inv.createdBy?.fullName ?? null
      })
    }
  }

  const discountIncidencePercent = totalLineCount > 0 ? (discountedLineCount / totalLineCount) * 100 : 0
  const averageDiscountPercent = discountedLineCount > 0 ? discountPercentSum / discountedLineCount : 0

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      totalDiscountGiven: roundCurrency(totalDiscountGiven),
      discountedLineCount, totalLineCount,
      discountIncidencePercent: roundCurrency(discountIncidencePercent),
      averageDiscountPercent: roundCurrency(averageDiscountPercent)
    },
    byStaff: Array.from(staffMap.values()).sort((a, b) => b.discountGiven - a.discountGiven),
    byProduct: Array.from(productMap.values()).sort((a, b) => b.discountGiven - a.discountGiven),
    rows,
    total: rows.length
  }
}

async function generateOrderVolumeReport(params: { dateFrom: string; dateTo: string }): Promise<OrderVolumeReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

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
    const day = toLocalISODate(o.createdAt)
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
// Phase 67 §9.1 — Pharmacy's "Expiry-risk value" signature-win report extends
// this EXISTING bucket shape with a real ₹ value per bucket (previously only
// the `expired` bucket had a matching summary figure) rather than building a
// new report — see the master prompt's own corrected grounding note.
export interface BatchExpiryBucket { bucket: ExpiryBucketId; label: string; count: number; quantityRemaining: number; value: number }
export interface BatchExpiryRow {
  productName: string; batchNumber: string; expiryDate: string; daysToExpiry: number
  quantityRemaining: number; bucket: ExpiryBucketId; unitCost: number; supplierName: string | null
}

export interface BatchExpiryReport {
  generatedAt: string
  summary: { totalBatches: number; expiredCount: number; criticalCount: number; warningCount: number; safeCount: number; expiredValue: number; atRiskValue: number }
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
    return {
      bucket: d.id, label: d.label, count: inBucket.length,
      quantityRemaining: inBucket.reduce((s, r) => s + r.quantityRemaining, 0),
      value: inBucket.reduce((s, r) => s + r.quantityRemaining * r.unitCost, 0),
    }
  })

  const expiredValue = buckets[0].value
  // "At-risk" = money genuinely still recoverable if acted on now (expired
  // stock is already a sunk loss, not a risk to act on) — critical + warning
  // buckets only, matching the audit's own "₹ at risk by 30/60/90-day
  // window" framing for the days still remaining to sell or return it.
  const atRiskValue = buckets[1].value + buckets[2].value

  return {
    generatedAt: now.toISOString(),
    summary: {
      totalBatches: rows.length,
      expiredCount: buckets[0].count, criticalCount: buckets[1].count,
      warningCount: buckets[2].count, safeCount: buckets[3].count,
      expiredValue, atRiskValue,
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
  const to = toDateEnd(params.dateTo)

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

// Phase 67 §9.1 — Blood Bank item 4: Donation-to-Issue Cycle Time. A
// retrospective waste-risk indicator, distinct from the live current-state
// Blood Stock report above — how fast an ALREADY-ISSUED unit actually moved
// from donation to use. Broken down by component type since shelf life
// varies enormously (Platelets ~5 days vs. Plasma ~365), so the same 10-day
// average cycle time is unremarkable for Plasma but a serious red flag for
// Platelets — a single blended average would hide that entirely.
export interface DonationToIssueCycleTimeByComponent { componentType: string; unitCount: number; avgDays: number; minDays: number; maxDays: number }
export interface DonationToIssueCycleTimeReport {
  summary: { totalIssuedUnits: number; overallAvgDays: number }
  byComponent: DonationToIssueCycleTimeByComponent[]
}

async function generateDonationToIssueCycleTimeReport(): Promise<DonationToIssueCycleTimeReport> {
  const db = getPrisma()
  const items = await db.bloodIssueItem.findMany({
    where: { bloodIssue: { status: { not: 'CANCELLED' } } },
    select: { componentType: true, createdAt: true, donationRecord: { select: { collectionDate: true } } },
  })
  if (items.length === 0) return { summary: { totalIssuedUnits: 0, overallAvgDays: 0 }, byComponent: [] }

  const byComponent = new Map<string, number[]>()
  const allDays: number[] = []
  for (const item of items) {
    const days = (item.createdAt.getTime() - item.donationRecord.collectionDate.getTime()) / 86400000
    allDays.push(days)
    const list = byComponent.get(item.componentType) ?? []
    list.push(days)
    byComponent.set(item.componentType, list)
  }

  const round1 = (n: number) => Math.round(n * 10) / 10
  const componentRows: DonationToIssueCycleTimeByComponent[] = Array.from(byComponent.entries())
    .map(([componentType, days]) => ({
      componentType, unitCount: days.length,
      avgDays: round1(days.reduce((s, d) => s + d, 0) / days.length),
      minDays: round1(Math.min(...days)), maxDays: round1(Math.max(...days)),
    }))
    .sort((a, b) => b.avgDays - a.avgDays)

  return {
    summary: { totalIssuedUnits: items.length, overallAvgDays: round1(allDays.reduce((s, d) => s + d, 0) / allDays.length) },
    byComponent: componentRows,
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
  const to = toDateEnd(params.dateTo)

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

// Phase 67 §9.1 — Jewellery item 2: Making-Charge vs. Metal-Value Margin,
// per SALE (invoice) — the true margin split the audit's own item wording
// names. Deliberately distinct from generateJewelleryReport's own
// `totalMakingChargeRevenue`, which is a single blended number across the
// whole date range; this breaks it out per invoice so an owner can see
// which specific sales carried a thin making-charge margin versus a fat one.
export interface MakingChargeMarginRow {
  invoiceId: string; invoiceNumber: string; invoiceDate: string; customerName: string
  metalValue: number; makingCharge: number; totalValue: number; makingChargePercent: number
}
export interface MakingChargeMarginReport {
  dateFrom: string; dateTo: string
  rows: MakingChargeMarginRow[]
  summary: { totalMetalValue: number; totalMakingCharge: number; avgMakingChargePercent: number }
}

async function generateMakingChargeMarginReport(params: { dateFrom: string; dateTo: string }): Promise<MakingChargeMarginReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const items = await db.invoiceItem.findMany({
    where: {
      jewelleryMetalType: { not: null },
      invoice: { invoiceDate: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
    },
    select: {
      jewelleryNetWeight: true, jewelleryRatePerGram: true, jewelleryMakingCharge: true, quantity: true,
      invoice: { select: { id: true, invoiceNumber: true, invoiceDate: true, customer: { select: { customerName: true } } } },
    },
  })

  const byInvoice = new Map<string, MakingChargeMarginRow>()
  for (const item of items) {
    const metalValue = (item.jewelleryNetWeight ?? 0) * (item.jewelleryRatePerGram ?? 0) * item.quantity
    const makingCharge = (item.jewelleryMakingCharge ?? 0) * item.quantity
    const existing = byInvoice.get(item.invoice.id) ?? {
      invoiceId: item.invoice.id, invoiceNumber: item.invoice.invoiceNumber,
      invoiceDate: item.invoice.invoiceDate.toISOString(), customerName: item.invoice.customer?.customerName ?? '—',
      metalValue: 0, makingCharge: 0, totalValue: 0, makingChargePercent: 0,
    }
    existing.metalValue = roundCurrency(existing.metalValue + metalValue)
    existing.makingCharge = roundCurrency(existing.makingCharge + makingCharge)
    byInvoice.set(item.invoice.id, existing)
  }

  const rows = Array.from(byInvoice.values()).map(r => ({
    ...r, totalValue: roundCurrency(r.metalValue + r.makingCharge),
    makingChargePercent: r.metalValue + r.makingCharge > 0 ? Math.round((r.makingCharge / (r.metalValue + r.makingCharge)) * 1000) / 10 : 0,
  })).sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime())

  const totalMetalValue = rows.reduce((s, r) => s + r.metalValue, 0)
  const totalMakingCharge = rows.reduce((s, r) => s + r.makingCharge, 0)
  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, rows,
    summary: {
      totalMetalValue, totalMakingCharge,
      avgMakingChargePercent: totalMetalValue + totalMakingCharge > 0 ? Math.round((totalMakingCharge / (totalMetalValue + totalMakingCharge)) * 1000) / 10 : 0,
    },
  }
}

// Phase 67 §9.1 — Jewellery item 3: Hallmarking/HUID compliance register.
// A real audit worklist, not a dashboard vanity metric — lists every active
// metal-tagged product and flags which ones are missing a BIS HUID (or
// equivalent) hallmark number, so a shop can find and fix a gap before an
// inspection rather than after one.
export interface HallmarkComplianceRow {
  productId: string; productName: string; metalType: string; purity: string
  hallmarkNumber: string | null; compliant: boolean
}
export interface HallmarkComplianceReport {
  rows: HallmarkComplianceRow[]
  summary: { totalItems: number; compliantCount: number; nonCompliantCount: number; compliancePercent: number }
}

async function generateHallmarkComplianceReport(): Promise<HallmarkComplianceReport> {
  const db = getPrisma()
  const products = await db.product.findMany({
    where: { isActive: true, metalType: { not: null } },
    select: { id: true, productName: true, metalType: true, purity: true, hallmarkNumber: true },
    orderBy: { productName: 'asc' },
  })

  const rows: HallmarkComplianceRow[] = products.map(p => ({
    productId: p.id, productName: p.productName, metalType: p.metalType ?? '', purity: p.purity ?? '',
    hallmarkNumber: p.hallmarkNumber, compliant: !!p.hallmarkNumber?.trim(),
    // Non-compliant items sort first — the actionable list, same
    // worst-first convention this phase's other ranked reports already use.
  })).sort((a, b) => Number(a.compliant) - Number(b.compliant))

  const compliantCount = rows.filter(r => r.compliant).length
  return {
    rows,
    summary: {
      totalItems: rows.length, compliantCount, nonCompliantCount: rows.length - compliantCount,
      compliancePercent: rows.length > 0 ? Math.round((compliantCount / rows.length) * 1000) / 10 : 100,
    },
  }
}

// Phase 67 §9.1 — Jewellery item 4: Metal Rate vs. Sales Volume, dual-axis
// line chart correlating gold-rate swings with sales, to inform
// stocking/pricing timing (the audit's own framing). Needs a real rate
// HISTORY to trend against — see MetalRateHistory's own schema comment for
// why this only accumulates going forward, never backfilled. Uses the same
// dual-yAxisId ComposedChart mechanism the Distributor scheme-cost-vs-volume
// report already established, monthly-bucketed.
//
// Deliberately no metalType/purity picker in the caller-facing API — the
// generic Reports screen has no mechanism for an extra selector beyond a
// date range, and a single dual-axis chart mixing multiple metals (gold and
// silver rates differ by 50-100x) would be unreadable anyway. Auto-selects
// whichever metalType+purity combination sold the most weight in the
// requested range (the one an owner actually cares about correlating),
// falling back to whichever has the most rate-history entries if there were
// no sales at all in range.
export interface MetalRateVsSalesVolumeRow { month: string; avgRatePerGram: number | null; salesWeightGrams: number }
export interface MetalRateVsSalesVolumeReport {
  dateFrom: string; dateTo: string
  metalType: string; purity: string
  rows: MetalRateVsSalesVolumeRow[]
}

function monthKey(d: Date): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

async function generateMetalRateVsSalesVolumeReport(params: { dateFrom: string; dateTo: string }): Promise<MetalRateVsSalesVolumeReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const allItems = await db.invoiceItem.findMany({
    where: {
      jewelleryMetalType: { not: null }, jewelleryPurity: { not: null },
      invoice: { invoiceDate: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
    },
    select: { jewelleryMetalType: true, jewelleryPurity: true, jewelleryNetWeight: true, quantity: true, invoice: { select: { invoiceDate: true } } },
  })

  const weightByCombo = new Map<string, number>()
  for (const item of allItems) {
    const key = `${item.jewelleryMetalType}|${item.jewelleryPurity}`
    weightByCombo.set(key, (weightByCombo.get(key) ?? 0) + (item.jewelleryNetWeight ?? 0) * item.quantity)
  }

  let dominant: string | undefined = Array.from(weightByCombo.entries()).sort((a, b) => b[1] - a[1])[0]?.[0]
  if (!dominant) {
    const rateHistoryAny = await db.metalRateHistory.groupBy({
      by: ['metalType', 'purity'], where: { recordedAt: { gte: from, lte: to } }, _count: { _all: true },
    })
    const best = rateHistoryAny.sort((a, b) => b._count._all - a._count._all)[0]
    dominant = best ? `${best.metalType}|${best.purity}` : undefined
  }
  if (!dominant) return { dateFrom: params.dateFrom, dateTo: params.dateTo, metalType: '', purity: '', rows: [] }
  const [metalType, purity] = dominant.split('|')

  const rateHistory = await db.metalRateHistory.findMany({
    where: { metalType, purity, recordedAt: { gte: from, lte: to } },
    orderBy: { recordedAt: 'asc' },
  })
  const rateSumByMonth = new Map<string, { sum: number; count: number }>()
  for (const r of rateHistory) {
    const key = monthKey(r.recordedAt)
    const existing = rateSumByMonth.get(key) ?? { sum: 0, count: 0 }
    existing.sum += r.ratePerGram; existing.count += 1
    rateSumByMonth.set(key, existing)
  }

  const weightByMonth = new Map<string, number>()
  for (const item of allItems) {
    if (item.jewelleryMetalType !== metalType || item.jewelleryPurity !== purity) continue
    const key = monthKey(item.invoice.invoiceDate)
    weightByMonth.set(key, (weightByMonth.get(key) ?? 0) + (item.jewelleryNetWeight ?? 0) * item.quantity)
  }

  const allMonths = new Set([...rateSumByMonth.keys(), ...weightByMonth.keys()])
  const rows: MetalRateVsSalesVolumeRow[] = Array.from(allMonths).sort().map(month => {
    const rate = rateSumByMonth.get(month)
    return {
      month,
      avgRatePerGram: rate ? Math.round((rate.sum / rate.count) * 100) / 100 : null,
      salesWeightGrams: Math.round((weightByMonth.get(month) ?? 0) * 1000) / 1000,
    }
  })

  return { dateFrom: params.dateFrom, dateTo: params.dateTo, metalType, purity, rows }
}

// Phase 67 §9.1 — Jewellery item 5: Purity-adjusted old-gold exchange
// analytics, "beyond a basic exchange log" per the audit's own wording —
// MetalExchangeScreen's own list is a flat feed with no normalization or
// trend. Purity varies (22K, 18K, 916, 999...) so a raw netWeight sum mixes
// incomparable metal quantities; this normalizes every exchange to its
// PURE-metal-equivalent weight (netWeight × fineness fraction) before
// aggregating, so a shop can compare true metal recovered across purities.
function purityToFineness(purity: string): number | null {
  const karat = /^(\d{1,2})\s*K$/i.exec(purity.trim())
  if (karat) {
    const k = parseInt(karat[1], 10)
    return k > 0 && k <= 24 ? k / 24 : null
  }
  const perMille = /^(\d{3})$/.exec(purity.trim())
  if (perMille) {
    const v = parseInt(perMille[1], 10)
    return v > 0 && v <= 999 ? v / 1000 : null
  }
  return null
}

export interface PurityAdjustedExchangeRow { metalType: string; purity: string; count: number; rawWeightGrams: number; pureEquivalentGrams: number; totalValueGiven: number }
export interface PurityAdjustedExchangeReport {
  dateFrom: string; dateTo: string
  byMetal: PurityAdjustedExchangeRow[]
  monthlyTrend: { month: string; pureEquivalentGrams: number }[]
  summary: { totalExchanges: number; totalPureEquivalentGrams: number; totalValueGiven: number; unparsablePurityCount: number }
}

async function generatePurityAdjustedExchangeReport(params: { dateFrom: string; dateTo: string }): Promise<PurityAdjustedExchangeReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const exchanges = await db.metalExchange.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { metalType: true, purity: true, netWeight: true, valueGiven: true, createdAt: true },
  })

  const byMetalMap = new Map<string, PurityAdjustedExchangeRow>()
  const monthlyMap = new Map<string, number>()
  let unparsablePurityCount = 0
  for (const e of exchanges) {
    const fineness = purityToFineness(e.purity)
    const pureEquivalent = fineness !== null ? e.netWeight * fineness : 0
    if (fineness === null) unparsablePurityCount++

    const key = `${e.metalType}|${e.purity}`
    const existing = byMetalMap.get(key) ?? { metalType: e.metalType, purity: e.purity, count: 0, rawWeightGrams: 0, pureEquivalentGrams: 0, totalValueGiven: 0 }
    existing.count += 1
    existing.rawWeightGrams += e.netWeight
    existing.pureEquivalentGrams += pureEquivalent
    existing.totalValueGiven += e.valueGiven
    byMetalMap.set(key, existing)

    const mKey = monthKey(e.createdAt)
    monthlyMap.set(mKey, (monthlyMap.get(mKey) ?? 0) + pureEquivalent)
  }

  const round3 = (n: number) => Math.round(n * 1000) / 1000
  const byMetal = Array.from(byMetalMap.values())
    .map(r => ({ ...r, rawWeightGrams: round3(r.rawWeightGrams), pureEquivalentGrams: round3(r.pureEquivalentGrams), totalValueGiven: roundCurrency(r.totalValueGiven) }))
    .sort((a, b) => b.pureEquivalentGrams - a.pureEquivalentGrams)
  const monthlyTrend = Array.from(monthlyMap.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, grams]) => ({ month, pureEquivalentGrams: round3(grams) }))

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, byMetal, monthlyTrend,
    summary: {
      totalExchanges: exchanges.length,
      totalPureEquivalentGrams: round3(byMetal.reduce((s, r) => s + r.pureEquivalentGrams, 0)),
      totalValueGiven: roundCurrency(exchanges.reduce((s, e) => s + e.valueGiven, 0)),
      unparsablePurityCount,
    },
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
  const to = toDateEnd(params.dateTo)

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
    employeeName: r.employee.fullName, date: toLocalISODate(r.date),
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
  const to = toDateEnd(params.dateTo)

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
    startDate: o.startDate ? toLocalISODate(o.startDate) : null,
    completedDate: o.completedDate ? toLocalISODate(o.completedDate) : null,
  }))

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: { totalOrders: orders.length, completed, inProgress, totalPlannedQty, totalProducedQty, completionRate },
    byStatus, rows,
  }
}

// Phase 67 §9.1 — Manufacturing item 2: True Landed Cost per Finished Unit.
// Deliberately does NOT recompute material cost from CURRENT RawMaterial.
// unitCost (which completeProductionOrder itself uses at completion time,
// since raw-material prices drift) — instead backs material cost OUT of the
// already-persisted, historically-accurate ProductCostHistory.unitCost for
// that order (totalCost - laborCost - overheadCost), the same real number
// that actually set the finished good's own inventory.averageCost. laborCost
// and overheadCost are already real persisted fields (Phase 64), so only
// material needed deriving.
export interface LandedCostPerUnitRow {
  productId: string; productName: string
  producedQty: number
  materialCostPerUnit: number; laborCostPerUnit: number; overheadCostPerUnit: number
  totalCostPerUnit: number
}
export interface LandedCostPerUnitReport {
  dateFrom: string; dateTo: string
  rows: LandedCostPerUnitRow[]
  summary: { totalOrders: number; totalProducedQty: number }
}

async function generateLandedCostPerUnitReport(params: { dateFrom: string; dateTo: string }): Promise<LandedCostPerUnitReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const orders = await db.productionOrder.findMany({
    where: { status: 'COMPLETED', completedDate: { gte: from, lte: to } },
    select: { id: true, productId: true, producedQty: true, laborCost: true, overheadCost: true, product: { select: { productName: true } } }
  })
  if (orders.length === 0) return { dateFrom: params.dateFrom, dateTo: params.dateTo, rows: [], summary: { totalOrders: 0, totalProducedQty: 0 } }

  const costHistory = await db.productCostHistory.findMany({
    where: { sourceType: 'PRODUCTION_ORDER', sourceId: { in: orders.map(o => o.id) } },
    select: { sourceId: true, unitCost: true }
  })
  const unitCostBySourceId = new Map(costHistory.map(c => [c.sourceId, c.unitCost]))

  const byProduct = new Map<string, { productName: string; producedQty: number; materialCost: number; laborCost: number; overheadCost: number }>()
  for (const o of orders) {
    const unitCost = unitCostBySourceId.get(o.id) ?? 0
    const totalCost = unitCost * o.producedQty
    const materialCost = Math.max(0, totalCost - o.laborCost - o.overheadCost)

    const existing = byProduct.get(o.productId) ?? { productName: o.product.productName, producedQty: 0, materialCost: 0, laborCost: 0, overheadCost: 0 }
    existing.producedQty += o.producedQty
    existing.materialCost += materialCost
    existing.laborCost += o.laborCost
    existing.overheadCost += o.overheadCost
    byProduct.set(o.productId, existing)
  }

  const rows: LandedCostPerUnitRow[] = Array.from(byProduct.entries()).map(([productId, v]) => ({
    productId, productName: v.productName, producedQty: v.producedQty,
    materialCostPerUnit: v.producedQty > 0 ? roundCurrency(v.materialCost / v.producedQty) : 0,
    laborCostPerUnit: v.producedQty > 0 ? roundCurrency(v.laborCost / v.producedQty) : 0,
    overheadCostPerUnit: v.producedQty > 0 ? roundCurrency(v.overheadCost / v.producedQty) : 0,
    totalCostPerUnit: v.producedQty > 0 ? roundCurrency((v.materialCost + v.laborCost + v.overheadCost) / v.producedQty) : 0,
  })).sort((a, b) => b.totalCostPerUnit - a.totalCostPerUnit)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, rows,
    summary: { totalOrders: orders.length, totalProducedQty: orders.reduce((s, o) => s + o.producedQty, 0) }
  }
}

// Phase 67 §9.1 — Manufacturing item 4: Rejection Rate Trend. Trended by
// month (not day — a shop-floor QC volume is too sparse per-day to chart
// meaningfully), and by stage (WorkOrder.taskName), reusing the per-stage
// qtyInspected/qtyRejected item 3 introduced — a QC step with neither set
// (every pre-item-3 row, and every non-QC step) is correctly excluded, not
// silently counted as a 0%-rejection stage.
export interface RejectionRateTrendPoint { month: string; qtyInspected: number; qtyRejected: number; rejectionRatePercent: number }
export interface RejectionRateByStageRow { taskName: string; qtyInspected: number; qtyRejected: number; rejectionRatePercent: number }
export interface RejectionRateTrendReport {
  dateFrom: string; dateTo: string
  trend: RejectionRateTrendPoint[]
  byStage: RejectionRateByStageRow[]
  summary: { totalInspected: number; totalRejected: number; overallRejectionRatePercent: number }
}

async function generateRejectionRateTrendReport(params: { dateFrom: string; dateTo: string }): Promise<RejectionRateTrendReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const steps = await db.workOrder.findMany({
    where: {
      isQcStep: true, qtyInspected: { not: null },
      completedAt: { gte: from, lte: to }
    },
    select: { taskName: true, qtyInspected: true, qtyRejected: true, completedAt: true }
  })
  if (steps.length === 0) {
    return { dateFrom: params.dateFrom, dateTo: params.dateTo, trend: [], byStage: [], summary: { totalInspected: 0, totalRejected: 0, overallRejectionRatePercent: 0 } }
  }

  const byMonth = new Map<string, { qtyInspected: number; qtyRejected: number }>()
  const byStage = new Map<string, { qtyInspected: number; qtyRejected: number }>()
  for (const s of steps) {
    const inspected = s.qtyInspected ?? 0
    const rejected = s.qtyRejected ?? 0
    const month = s.completedAt!.toISOString().slice(0, 7)

    const m = byMonth.get(month) ?? { qtyInspected: 0, qtyRejected: 0 }
    m.qtyInspected += inspected; m.qtyRejected += rejected
    byMonth.set(month, m)

    const st = byStage.get(s.taskName) ?? { qtyInspected: 0, qtyRejected: 0 }
    st.qtyInspected += inspected; st.qtyRejected += rejected
    byStage.set(s.taskName, st)
  }

  const trend: RejectionRateTrendPoint[] = Array.from(byMonth.entries())
    .map(([month, v]) => ({ month, qtyInspected: v.qtyInspected, qtyRejected: v.qtyRejected, rejectionRatePercent: v.qtyInspected > 0 ? Math.round((v.qtyRejected / v.qtyInspected) * 1000) / 10 : 0 }))
    .sort((a, b) => a.month.localeCompare(b.month))

  const byStageRows: RejectionRateByStageRow[] = Array.from(byStage.entries())
    .map(([taskName, v]) => ({ taskName, qtyInspected: v.qtyInspected, qtyRejected: v.qtyRejected, rejectionRatePercent: v.qtyInspected > 0 ? Math.round((v.qtyRejected / v.qtyInspected) * 1000) / 10 : 0 }))
    .sort((a, b) => b.rejectionRatePercent - a.rejectionRatePercent)

  const totalInspected = steps.reduce((s, r) => s + (r.qtyInspected ?? 0), 0)
  const totalRejected = steps.reduce((s, r) => s + (r.qtyRejected ?? 0), 0)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, trend, byStage: byStageRows,
    summary: { totalInspected, totalRejected, overallRejectionRatePercent: totalInspected > 0 ? Math.round((totalRejected / totalInspected) * 1000) / 10 : 0 }
  }
}

// Phase 67 §9.1 — Agri Inputs item 2: Seasonal Credit Exposure. A live
// current-state view (no date range) across the CALENDAR itself — every
// currently-outstanding CREDIT invoice with a real dueDate, bucketed by
// which calendar month that due date falls in, so a shop sees WHEN across
// the year it's most exposed (typically clustering around harvest months),
// not a sales-history trend. Also broken down by linked CropSeason name,
// separately from the pure calendar-month view, since a season can span a
// year boundary and two different seasons can share a due month.
const CALENDAR_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export interface SeasonalCreditExposureMonthPoint { month: string; outstandingAmount: number; invoiceCount: number }
export interface SeasonalCreditExposureBySeasonRow { seasonName: string; outstandingAmount: number; invoiceCount: number }
export interface SeasonalCreditExposureReport {
  byMonth: SeasonalCreditExposureMonthPoint[]
  bySeason: SeasonalCreditExposureBySeasonRow[]
  summary: { totalOutstanding: number; totalInvoices: number; peakMonth: string | null; peakMonthAmount: number }
}

async function generateSeasonalCreditExposureReport(): Promise<SeasonalCreditExposureReport> {
  const db = getPrisma()

  const invoices = await db.invoice.findMany({
    where: { status: 'ACTIVE', invoiceType: { not: 'RETURN' }, balanceAmount: { gt: 0 }, dueDate: { not: null } },
    select: { balanceAmount: true, dueDate: true, cropSeason: { select: { name: true } } }
  })

  const byMonth = new Map<number, { outstandingAmount: number; invoiceCount: number }>()
  const bySeason = new Map<string, { outstandingAmount: number; invoiceCount: number }>()
  for (const inv of invoices) {
    const monthIdx = inv.dueDate!.getMonth()
    const m = byMonth.get(monthIdx) ?? { outstandingAmount: 0, invoiceCount: 0 }
    m.outstandingAmount = roundCurrency(m.outstandingAmount + inv.balanceAmount)
    m.invoiceCount += 1
    byMonth.set(monthIdx, m)

    if (inv.cropSeason) {
      const s = bySeason.get(inv.cropSeason.name) ?? { outstandingAmount: 0, invoiceCount: 0 }
      s.outstandingAmount = roundCurrency(s.outstandingAmount + inv.balanceAmount)
      s.invoiceCount += 1
      bySeason.set(inv.cropSeason.name, s)
    }
  }

  const monthPoints: SeasonalCreditExposureMonthPoint[] = CALENDAR_MONTH_NAMES.map((month, idx) => {
    const v = byMonth.get(idx) ?? { outstandingAmount: 0, invoiceCount: 0 }
    return { month, outstandingAmount: v.outstandingAmount, invoiceCount: v.invoiceCount }
  })
  const seasonRows: SeasonalCreditExposureBySeasonRow[] = Array.from(bySeason.entries())
    .map(([seasonName, v]) => ({ seasonName, outstandingAmount: v.outstandingAmount, invoiceCount: v.invoiceCount }))
    .sort((a, b) => b.outstandingAmount - a.outstandingAmount)

  const totalOutstanding = roundCurrency(invoices.reduce((s, i) => s + i.balanceAmount, 0))
  const peak = [...monthPoints].sort((a, b) => b.outstandingAmount - a.outstandingAmount)[0] ?? null

  return {
    byMonth: monthPoints, bySeason: seasonRows,
    summary: {
      totalOutstanding, totalInvoices: invoices.length,
      peakMonth: peak && peak.outstandingAmount > 0 ? peak.month : null,
      peakMonthAmount: peak?.outstandingAmount ?? 0
    }
  }
}

// Phase 67 §9.1 — Agri Inputs item 4: Farmer-Wise Purchase & Repayment
// History. Deliberately a CROSS-farmer comparative view, distinct from the
// pre-existing generateCustomerLedgerReport (a single-customer drill-down) —
// this ranks EVERY customer with real credit activity by how reliably they
// actually repay, surfacing the riskiest accounts first, not just showing
// one farmer's history at a time.
export interface FarmerRepaymentRow {
  customerId: string; customerName: string; phone: string | null
  totalPurchased: number; totalRepaid: number; outstandingBalance: number
  repaymentRatePercent: number
}
export interface FarmerRepaymentReport {
  rows: FarmerRepaymentRow[]
  summary: { totalFarmers: number; totalOutstanding: number; overallRepaymentRatePercent: number }
}

async function generateFarmerRepaymentReport(): Promise<FarmerRepaymentReport> {
  const db = getPrisma()

  const invoices = await db.invoice.findMany({
    where: { status: 'ACTIVE', invoiceType: { not: 'RETURN' }, customerId: { not: null }, paymentStatus: { in: ['UNPAID', 'PARTIAL', 'PAID'] } },
    select: { customerId: true, totalAmount: true, paidAmount: true, balanceAmount: true, customer: { select: { customerName: true, phone: true } } }
  })
  if (invoices.length === 0) return { rows: [], summary: { totalFarmers: 0, totalOutstanding: 0, overallRepaymentRatePercent: 0 } }

  const byCustomer = new Map<string, { customerName: string; phone: string | null; totalPurchased: number; totalRepaid: number; outstandingBalance: number }>()
  for (const inv of invoices) {
    const cid = inv.customerId!
    const existing = byCustomer.get(cid) ?? { customerName: inv.customer!.customerName, phone: inv.customer!.phone, totalPurchased: 0, totalRepaid: 0, outstandingBalance: 0 }
    existing.totalPurchased = roundCurrency(existing.totalPurchased + inv.totalAmount)
    existing.totalRepaid = roundCurrency(existing.totalRepaid + inv.paidAmount)
    existing.outstandingBalance = roundCurrency(existing.outstandingBalance + inv.balanceAmount)
    byCustomer.set(cid, existing)
  }

  // Riskiest (lowest repayment rate) first — the actual actionable list, not
  // an alphabetical or highest-purchase-volume one.
  const rows: FarmerRepaymentRow[] = Array.from(byCustomer.entries())
    .map(([customerId, v]) => ({
      customerId, customerName: v.customerName, phone: v.phone,
      totalPurchased: v.totalPurchased, totalRepaid: v.totalRepaid, outstandingBalance: v.outstandingBalance,
      repaymentRatePercent: v.totalPurchased > 0 ? Math.round((v.totalRepaid / v.totalPurchased) * 1000) / 10 : 0
    }))
    .sort((a, b) => a.repaymentRatePercent - b.repaymentRatePercent)

  const totalOutstanding = roundCurrency(rows.reduce((s, r) => s + r.outstandingBalance, 0))
  const totalPurchased = rows.reduce((s, r) => s + r.totalPurchased, 0)
  const totalRepaid = rows.reduce((s, r) => s + r.totalRepaid, 0)

  return {
    rows,
    summary: {
      totalFarmers: rows.length, totalOutstanding,
      overallRepaymentRatePercent: totalPurchased > 0 ? Math.round((totalRepaid / totalPurchased) * 1000) / 10 : 0
    }
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
// RMA Aging Report (Electronics template) — Phase 67 §9.1
// ─────────────────────────────────────────────────────────────────────────────

// Every currently-open (SENT_TO_VENDOR / AWAITING_PARTS) RepairTicket, ranked
// by how long it's actually been with the vendor — the audit's own named
// "4 units over 30 days" framing, but as a full ranked breakdown rather than
// just the alert-style count generateDashboardAlerts()/electronics.rmaOverdueSummary
// already surface. Deliberately reuses the exact same daysWithVendor/isOverdue
// definitions repair-ticket.service.ts's toRecord() already established
// (vendorSlaDueDate set once on SENT_TO_VENDOR, VENDOR_SLA_DAYS = 30) rather
// than re-deriving a second, driftable copy of the same rule.
export interface RmaAgingRow {
  claimNumber: string; productName: string; vendorName: string | null
  sentToVendorDate: string; daysWithVendor: number; isOverdue: boolean
}
export interface RmaAgingReport {
  generatedAt: string
  rows: RmaAgingRow[]
  summary: { totalOpen: number; overdueCount: number }
}

async function generateRmaAgingReport(): Promise<RmaAgingReport> {
  const db = getPrisma()
  const now = new Date()

  const tickets = await db.repairTicket.findMany({
    where: { status: { in: ['SENT_TO_VENDOR', 'AWAITING_PARTS'] }, sentToVendorDate: { not: null } },
    select: {
      claimNumber: true, sentToVendorDate: true, vendorSlaDueDate: true,
      product: { select: { productName: true } },
      vendor: { select: { supplierName: true } }
    }
  })

  const rows: RmaAgingRow[] = tickets
    .map(t => {
      const daysWithVendor = Math.max(0, Math.round((now.getTime() - t.sentToVendorDate!.getTime()) / (1000 * 60 * 60 * 24)))
      const isOverdue = !!t.vendorSlaDueDate && now > t.vendorSlaDueDate
      return {
        claimNumber: t.claimNumber, productName: t.product.productName,
        vendorName: t.vendor?.supplierName ?? null,
        sentToVendorDate: t.sentToVendorDate!.toISOString(), daysWithVendor, isOverdue
      }
    })
    .sort((a, b) => b.daysWithVendor - a.daysWithVendor)

  return {
    generatedAt: now.toISOString(),
    rows,
    summary: { totalOpen: rows.length, overdueCount: rows.filter(r => r.isOverdue).length }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Vendor Warranty-Claim Recovery Ledger (Electronics template) — Phase 67 §9.1
// ─────────────────────────────────────────────────────────────────────────────

// Every RepairTicket with a real vendor claim ever recorded (open or
// closed), claimed/recovered/outstanding — the actual "ledger" the item's
// own name calls for, distinct from item 1's SLA due-date tracking and item
// 2's own days-with-vendor aging (neither one has any concept of money at
// all). Deliberately includes CLOSED claims too, not just open ones — a
// ledger that hides its own settled history isn't a ledger, it's just a
// to-do list; the report's own summary separates open vs. closed so the
// "what still needs chasing" question stays answerable at a glance.
export interface VendorRecoveryRow {
  claimNumber: string; productName: string; vendorName: string | null
  claimedAmount: number; recoveredAmount: number; outstandingAmount: number
  isClosed: boolean; closedAt: string | null
}
export interface VendorRecoveryLedgerReport {
  generatedAt: string
  rows: VendorRecoveryRow[]
  summary: { totalClaimed: number; totalRecovered: number; totalOutstanding: number; openCount: number; closedCount: number }
}

async function generateVendorRecoveryLedgerReport(): Promise<VendorRecoveryLedgerReport> {
  const db = getPrisma()
  const now = new Date()

  const tickets = await db.repairTicket.findMany({
    where: { vendorClaimAmount: { not: null } },
    select: {
      claimNumber: true, vendorClaimAmount: true, vendorRecoveredAmount: true, vendorClaimClosedAt: true,
      product: { select: { productName: true } },
      vendor: { select: { supplierName: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  const rows: VendorRecoveryRow[] = tickets.map(t => {
    const claimedAmount = t.vendorClaimAmount!
    const outstandingAmount = roundCurrency(claimedAmount - t.vendorRecoveredAmount)
    return {
      claimNumber: t.claimNumber, productName: t.product.productName,
      vendorName: t.vendor?.supplierName ?? null,
      claimedAmount, recoveredAmount: roundCurrency(t.vendorRecoveredAmount), outstandingAmount,
      isClosed: !!t.vendorClaimClosedAt, closedAt: t.vendorClaimClosedAt ? t.vendorClaimClosedAt.toISOString() : null
    }
  }).sort((a, b) => {
    if (a.isClosed !== b.isClosed) return a.isClosed ? 1 : -1
    return b.outstandingAmount - a.outstandingAmount
  })

  return {
    generatedAt: now.toISOString(),
    rows,
    summary: {
      totalClaimed: roundCurrency(sumCurrency(rows.map(r => r.claimedAmount))),
      totalRecovered: roundCurrency(sumCurrency(rows.map(r => r.recoveredAmount))),
      totalOutstanding: roundCurrency(sumCurrency(rows.filter(r => !r.isClosed).map(r => r.outstandingAmount))),
      openCount: rows.filter(r => !r.isClosed).length,
      closedCount: rows.filter(r => r.isClosed).length
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Repair Turnaround by Technician (Electronics template) — Phase 67 §9.1
// ─────────────────────────────────────────────────────────────────────────────

// Only tickets with BOTH a technician assigned AND a real completion date
// (deliveredDate) count — a still-open ticket has no finished turnaround to
// measure yet, and a ticket nobody was ever assigned to can't be attributed
// to anyone's performance. Turnaround reuses the exact receivedDate→
// deliveredDate span repair-ticket.service.ts's own turnaroundDays()
// already computes per-ticket — this report is the aggregate view of that
// same number, grouped by who did the work, not a second definition of it.
export interface TechnicianTurnaroundRow {
  technicianId: string; technicianName: string
  ticketCount: number; avgTurnaroundDays: number; minTurnaroundDays: number; maxTurnaroundDays: number
}
export interface RepairTurnaroundByTechnicianReport {
  generatedAt: string
  rows: TechnicianTurnaroundRow[]
  summary: { technicianCount: number; totalTicketsCompleted: number; overallAvgTurnaroundDays: number }
}

async function generateRepairTurnaroundByTechnicianReport(): Promise<RepairTurnaroundByTechnicianReport> {
  const db = getPrisma()
  const now = new Date()

  const tickets = await db.repairTicket.findMany({
    where: { technicianId: { not: null }, deliveredDate: { not: null } },
    select: {
      technicianId: true, receivedDate: true, deliveredDate: true,
      technician: { select: { fullName: true } }
    }
  })

  const byTechnician = new Map<string, { name: string; days: number[] }>()
  for (const t of tickets) {
    const days = Math.max(0, Math.round((t.deliveredDate!.getTime() - t.receivedDate.getTime()) / (1000 * 60 * 60 * 24)))
    const bucket = byTechnician.get(t.technicianId!) ?? { name: t.technician!.fullName, days: [] }
    bucket.days.push(days)
    byTechnician.set(t.technicianId!, bucket)
  }

  const avgOf = (nums: number[]) => Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10

  const rows: TechnicianTurnaroundRow[] = Array.from(byTechnician.entries()).map(([technicianId, { name, days }]) => ({
    technicianId, technicianName: name,
    ticketCount: days.length,
    avgTurnaroundDays: avgOf(days),
    minTurnaroundDays: Math.min(...days),
    maxTurnaroundDays: Math.max(...days)
  })).sort((a, b) => a.avgTurnaroundDays - b.avgTurnaroundDays || b.ticketCount - a.ticketCount)

  const allDays = tickets.map(t => Math.max(0, Math.round((t.deliveredDate!.getTime() - t.receivedDate.getTime()) / (1000 * 60 * 60 * 24))))

  return {
    generatedAt: now.toISOString(),
    rows,
    summary: {
      technicianCount: rows.length,
      totalTicketsCompleted: allDays.length,
      overallAvgTurnaroundDays: allDays.length > 0 ? avgOf(allDays) : 0
    }
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

  // BUG FOUND 2026-07-22: this was the one report in the file that bypassed
  // the shared toDate() helper AND never applied the standard end-of-day
  // adjustment every other report's "to" bound uses -- `lte: new
  // Date(dateTo)` is UTC midnight of that date, so almost any real
  // testDate (which carries a real time-of-day) on the "to" day itself was
  // excluded. Fixed to match the standard pattern used everywhere else in
  // this file: local-midnight "from", end-of-local-day "to".
  const where: Record<string, unknown> = {}
  if (params.dateFrom || params.dateTo) {
    where.testDate = {
      ...(params.dateFrom ? { gte: toDate(params.dateFrom) } : {}),
      ...(params.dateTo ? { lte: toDateEnd(params.dateTo) } : {}),
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
  const to = toDateEnd(params.dateTo)

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
      startDate: p.startDate ? toLocalISODate(p.startDate) : null,
      dueDate: p.dueDate ? toLocalISODate(p.dueDate) : null,
      completedDate: p.completedDate ? toLocalISODate(p.completedDate) : null,
    })),
  }
}

// Phase 67 §9.1 — Service item 2: Resolution Time by Category, bar chart —
// "a real service-quality metric" per the audit's own wording. Only tickets
// actually resolved in range (resolvedAt set) count — an OPEN ticket has no
// resolution time yet, not a zero one.
export interface ServiceResolutionTimeRow { category: string; ticketCount: number; avgHours: number; minHours: number; maxHours: number }
export interface ServiceResolutionTimeReport {
  dateFrom: string; dateTo: string
  rows: ServiceResolutionTimeRow[]
  summary: { totalResolved: number; overallAvgHours: number }
}

async function generateServiceResolutionTimeReport(params: { dateFrom: string; dateTo: string }): Promise<ServiceResolutionTimeReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const tickets = await db.serviceTicket.findMany({
    where: { resolvedAt: { gte: from, lte: to, not: null } },
    select: { category: true, createdAt: true, resolvedAt: true },
  })

  const byCategory = new Map<string, number[]>()
  for (const t of tickets) {
    if (!t.resolvedAt) continue
    const hours = (t.resolvedAt.getTime() - t.createdAt.getTime()) / (60 * 60 * 1000)
    const key = t.category?.trim() || 'Uncategorized'
    const existing = byCategory.get(key) ?? []
    existing.push(hours)
    byCategory.set(key, existing)
  }

  const round1 = (n: number) => Math.round(n * 10) / 10
  const rows: ServiceResolutionTimeRow[] = Array.from(byCategory.entries()).map(([category, hoursArr]) => ({
    category, ticketCount: hoursArr.length,
    avgHours: round1(hoursArr.reduce((s, h) => s + h, 0) / hoursArr.length),
    minHours: round1(Math.min(...hoursArr)), maxHours: round1(Math.max(...hoursArr)),
  })).sort((a, b) => b.avgHours - a.avgHours)

  const allHours = tickets.filter(t => t.resolvedAt).map(t => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / (60 * 60 * 1000))
  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, rows,
    summary: { totalResolved: allHours.length, overallAvgHours: allHours.length > 0 ? round1(allHours.reduce((s, h) => s + h, 0) / allHours.length) : 0 },
  }
}

// Phase 67 §9.1 — Service item 4: Repeat-Business Rate, line trend — "the
// retention indicator this generic scaffold has never had" per the audit.
// Monthly-bucketed: of every customer who had a ticket created in a given
// month, what share had ALSO had a ticket at any point strictly before that
// month (a real returning customer, not just a second ticket the same week).
export interface RepeatBusinessRateRow { month: string; newCustomers: number; repeatCustomers: number; repeatRatePercent: number }
export interface RepeatBusinessRateReport {
  dateFrom: string; dateTo: string
  rows: RepeatBusinessRateRow[]
}

async function generateRepeatBusinessRateReport(params: { dateFrom: string; dateTo: string }): Promise<RepeatBusinessRateReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  // Every ticket with a customer, across all time (not just the requested
  // range) — needed to know each customer's TRUE first-ever ticket date, so
  // "repeat" is judged against their real history, not just what's visible
  // inside this report's own window.
  const allTickets = await db.serviceTicket.findMany({
    where: { customerId: { not: null } },
    select: { customerId: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  const firstTicketDateByCustomer = new Map<string, Date>()
  for (const t of allTickets) {
    if (!t.customerId) continue
    if (!firstTicketDateByCustomer.has(t.customerId)) firstTicketDateByCustomer.set(t.customerId, t.createdAt)
  }

  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const byMonth = new Map<string, Set<string>>()
  for (const t of allTickets) {
    if (!t.customerId || t.createdAt < from || t.createdAt > to) continue
    const key = monthKey(t.createdAt)
    const set = byMonth.get(key) ?? new Set<string>()
    set.add(t.customerId)
    byMonth.set(key, set)
  }

  const rows: RepeatBusinessRateRow[] = Array.from(byMonth.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, customerIds]) => {
    const monthStart = new Date(`${month}-01T00:00:00`)
    let repeatCustomers = 0
    for (const customerId of customerIds) {
      const firstDate = firstTicketDateByCustomer.get(customerId)
      if (firstDate && firstDate < monthStart) repeatCustomers++
    }
    const total = customerIds.size
    return {
      month, newCustomers: total - repeatCustomers, repeatCustomers,
      repeatRatePercent: total > 0 ? Math.round((repeatCustomers / total) * 1000) / 10 : 0,
    }
  })

  return { dateFrom: params.dateFrom, dateTo: params.dateTo, rows }
}

// Phase 67 §9.1 — Consultant item 2: Utilization Rate — "the #1 consulting
// metric, currently invisible." Per staff member (WorkLog.userId), billable
// vs. non-billable hours logged against Projects in the requested range,
// sorted ascending by utilizationPercent so the LEAST-utilized consultant
// surfaces first (the actionable "who needs more billable work" list),
// same worst-first convention this phase's other ranked reports use.
export interface ConsultantUtilizationRow {
  userName: string; billableHours: number; nonBillableHours: number; totalHours: number; utilizationPercent: number
}
export interface ConsultantUtilizationReport {
  dateFrom: string; dateTo: string; rows: ConsultantUtilizationRow[]
  summary: { totalBillableHours: number; totalNonBillableHours: number; overallUtilizationPercent: number }
}
async function generateConsultantUtilizationReport(params: { dateFrom: string; dateTo: string }): Promise<ConsultantUtilizationReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const logs = await db.workLog.findMany({
    where: { logDate: { gte: from, lte: to }, projectId: { not: null } },
    select: { hours: true, billable: true, userId: true, user: { select: { fullName: true } } },
  })

  const byUser = new Map<string, { userName: string; billable: number; nonBillable: number }>()
  for (const l of logs) {
    const key = l.userId ?? 'unassigned'
    const existing = byUser.get(key) ?? { userName: l.user?.fullName ?? 'Unassigned', billable: 0, nonBillable: 0 }
    if (l.billable) existing.billable += l.hours
    else existing.nonBillable += l.hours
    byUser.set(key, existing)
  }

  const round1 = (n: number) => Math.round(n * 10) / 10
  const rows: ConsultantUtilizationRow[] = Array.from(byUser.values()).map((u) => {
    const totalHours = u.billable + u.nonBillable
    return {
      userName: u.userName, billableHours: round1(u.billable), nonBillableHours: round1(u.nonBillable),
      totalHours: round1(totalHours),
      utilizationPercent: totalHours > 0 ? round1((u.billable / totalHours) * 100) : 0,
    }
  }).sort((a, b) => a.utilizationPercent - b.utilizationPercent)

  const totalBillableHours = round1(logs.filter((l) => l.billable).reduce((s, l) => s + l.hours, 0))
  const totalNonBillableHours = round1(logs.filter((l) => !l.billable).reduce((s, l) => s + l.hours, 0))
  const grandTotal = totalBillableHours + totalNonBillableHours
  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, rows,
    summary: { totalBillableHours, totalNonBillableHours, overallUtilizationPercent: grandTotal > 0 ? round1((totalBillableHours / grandTotal) * 100) : 0 },
  }
}

// Phase 67 §9.1 — Consultant item 4: Client Profitability — "which clients
// are actually worth keeping." Revenue = invoiced amount from this
// customer's own Projects (Project.invoiceId -> Invoice.totalAmount);
// hours = WorkLog hours logged against those same projects. Sorted
// ascending by revenuePerHour so the least-profitable client surfaces
// first, same worst-first convention as the utilization report above.
export interface ClientProfitabilityRow {
  customerName: string; revenue: number; hoursSpent: number; revenuePerHour: number
}
export interface ClientProfitabilityReport {
  dateFrom: string; dateTo: string; rows: ClientProfitabilityRow[]
  summary: { totalRevenue: number; totalHours: number }
}
async function generateClientProfitabilityReport(params: { dateFrom: string; dateTo: string }): Promise<ClientProfitabilityReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const projects = await db.project.findMany({
    where: { customerId: { not: null }, createdAt: { gte: from, lte: to } },
    select: {
      customerId: true, customer: { select: { customerName: true } }, invoiceId: true,
      workLogs: { select: { hours: true } },
    },
  })
  const invoiceIds = projects.map((p) => p.invoiceId).filter((id): id is string => !!id)
  const invoices = invoiceIds.length
    ? await db.invoice.findMany({ where: { id: { in: invoiceIds } }, select: { id: true, totalAmount: true } })
    : []
  const invoiceAmountById = new Map(invoices.map((inv) => [inv.id, inv.totalAmount]))

  const byCustomer = new Map<string, { customerName: string; revenue: number; hours: number }>()
  for (const p of projects) {
    if (!p.customerId) continue
    const existing = byCustomer.get(p.customerId) ?? { customerName: p.customer?.customerName ?? 'Unknown', revenue: 0, hours: 0 }
    if (p.invoiceId) existing.revenue += invoiceAmountById.get(p.invoiceId) ?? 0
    existing.hours += p.workLogs.reduce((s, l) => s + l.hours, 0)
    byCustomer.set(p.customerId, existing)
  }

  const round1 = (n: number) => Math.round(n * 10) / 10
  const rows: ClientProfitabilityRow[] = Array.from(byCustomer.values()).map((c) => ({
    customerName: c.customerName, revenue: round1(c.revenue), hoursSpent: round1(c.hours),
    revenuePerHour: c.hours > 0 ? round1(c.revenue / c.hours) : 0,
  })).sort((a, b) => a.revenuePerHour - b.revenuePerHour)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, rows,
    summary: {
      totalRevenue: round1(rows.reduce((s, r) => s + r.revenue, 0)),
      totalHours: round1(rows.reduce((s, r) => s + r.hoursSpent, 0)),
    },
  }
}

// Phase 67 §9.1 — Repair item 2: Turnaround by Technician, for the generic
// JobCard model (distinct from Electronics' own RepairTicket-based
// generateRepairTurnaroundByTechnicianReport() above, hence the
// JobCard-qualified name below to avoid colliding with it). Delivered
// JobCards only (an in-progress job has no real turnaround yet), grouped
// by assignedTo, sorted worst (slowest average) first — same worst-first
// convention every other ranked report in this phase already uses.
export interface JobCardTurnaroundByTechnicianRow {
  technicianName: string; jobCount: number; avgTurnaroundHours: number; fastestHours: number; slowestHours: number
}
export interface JobCardTurnaroundByTechnicianReport {
  dateFrom: string; dateTo: string; rows: JobCardTurnaroundByTechnicianRow[]
  summary: { totalDelivered: number; overallAvgTurnaroundHours: number }
}
async function generateJobCardTurnaroundByTechnicianReport(params: { dateFrom: string; dateTo: string }): Promise<JobCardTurnaroundByTechnicianReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const cards = await db.jobCard.findMany({
    where: { deliveredDate: { gte: from, lte: to, not: null } },
    select: { assignedTo: { select: { fullName: true } }, receivedDate: true, deliveredDate: true },
  })

  const byTech = new Map<string, number[]>()
  for (const c of cards) {
    if (!c.deliveredDate) continue
    const hours = (c.deliveredDate.getTime() - c.receivedDate.getTime()) / (60 * 60 * 1000)
    const key = c.assignedTo?.fullName?.trim() || 'Unassigned'
    const existing = byTech.get(key) ?? []
    existing.push(hours)
    byTech.set(key, existing)
  }

  const round1 = (n: number) => Math.round(n * 10) / 10
  const rows: JobCardTurnaroundByTechnicianRow[] = Array.from(byTech.entries()).map(([technicianName, hoursArr]) => ({
    technicianName, jobCount: hoursArr.length,
    avgTurnaroundHours: round1(hoursArr.reduce((s, h) => s + h, 0) / hoursArr.length),
    fastestHours: round1(Math.min(...hoursArr)), slowestHours: round1(Math.max(...hoursArr)),
  })).sort((a, b) => b.avgTurnaroundHours - a.avgTurnaroundHours)

  const allHours = cards.filter((c) => c.deliveredDate).map((c) => (c.deliveredDate!.getTime() - c.receivedDate.getTime()) / (60 * 60 * 1000))
  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, rows,
    summary: { totalDelivered: allHours.length, overallAvgTurnaroundHours: allHours.length > 0 ? round1(allHours.reduce((s, h) => s + h, 0) / allHours.length) : 0 },
  }
}

// Phase 67 §9.1 — Repair item 4: Repair Category Volume Trend — "informs
// parts stocking" per the audit's own item wording. Monthly-bucketed by
// JobCard.createdAt (when the job actually came in, not when it finished),
// falling back to "Uncategorized" the same way Service's own resolution-
// time report handles a missing category.
export interface RepairCategoryVolumeTrendRow { month: string; category: string; count: number }
export interface RepairCategoryVolumeTrendReport {
  dateFrom: string; dateTo: string; rows: RepairCategoryVolumeTrendRow[]
  categories: string[]
  summary: { totalJobs: number }
}
async function generateRepairCategoryVolumeTrendReport(params: { dateFrom: string; dateTo: string }): Promise<RepairCategoryVolumeTrendReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const cards = await db.jobCard.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { category: true, createdAt: true },
  })

  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  const byMonthCategory = new Map<string, number>()
  const categorySet = new Set<string>()
  for (const c of cards) {
    const category = c.category?.trim() || 'Uncategorized'
    categorySet.add(category)
    const key = `${monthKey(c.createdAt)}|${category}`
    byMonthCategory.set(key, (byMonthCategory.get(key) ?? 0) + 1)
  }

  const rows: RepairCategoryVolumeTrendRow[] = Array.from(byMonthCategory.entries())
    .map(([key, count]) => { const [month, category] = key.split('|'); return { month, category, count } })
    .sort((a, b) => a.month.localeCompare(b.month))

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, rows,
    categories: Array.from(categorySet).sort(),
    summary: { totalJobs: cards.length },
  }
}

// Phase 67 §9.1 — Distributor item 3: Field-Rep Performance Leaderboard —
// "orders booked, value, hit-rate vs. plan, per rep per beat." A leaderboard
// celebrates top performers, so sorted DESCENDING by value (best-first),
// deliberately the opposite of this phase's usual worst-first convention
// for problem-surfacing reports. hitRatePercent is null (not 0) for a rep
// with no active beat at all — an honest "not applicable," not a
// zero-performance score.
export interface FieldRepLeaderboardRow {
  repName: string; ordersBooked: number; totalValue: number
  plannedStops: number | null; distinctCustomersVisited: number; hitRatePercent: number | null
}
export interface FieldRepLeaderboardReport {
  dateFrom: string; dateTo: string; rows: FieldRepLeaderboardRow[]
  summary: { totalOrdersBooked: number; totalValue: number }
}
async function generateFieldRepLeaderboardReport(params: { dateFrom: string; dateTo: string }): Promise<FieldRepLeaderboardReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const requests = await db.fieldOrderRequest.findMany({
    where: { status: 'ACCEPTED', createdAt: { gte: from, lte: to } },
    select: { repName: true, customerId: true, invoiceId: true },
  })
  const invoiceIds = requests.map((r) => r.invoiceId).filter((id): id is string => !!id)
  const invoices = invoiceIds.length
    ? await db.invoice.findMany({ where: { id: { in: invoiceIds } }, select: { id: true, totalAmount: true } })
    : []
  const invoiceAmountById = new Map(invoices.map((inv) => [inv.id, inv.totalAmount]))

  const byRep = new Map<string, { ordersBooked: number; totalValue: number; customerIds: Set<string> }>()
  for (const r of requests) {
    const existing = byRep.get(r.repName) ?? { ordersBooked: 0, totalValue: 0, customerIds: new Set<string>() }
    existing.ordersBooked++
    if (r.invoiceId) existing.totalValue += invoiceAmountById.get(r.invoiceId) ?? 0
    if (r.customerId) existing.customerIds.add(r.customerId)
    byRep.set(r.repName, existing)
  }

  // Active beats per rep, to compute hit-rate vs. plan.
  const activeBeats = await db.distributorBeat.findMany({
    where: { isActive: true, repName: { in: Array.from(byRep.keys()) } },
    select: { repName: true, stops: { select: { customerId: true } } },
  })
  const plannedStopsByRep = new Map<string, Set<string>>()
  for (const b of activeBeats) {
    const set = plannedStopsByRep.get(b.repName) ?? new Set<string>()
    for (const s of b.stops) set.add(s.customerId)
    plannedStopsByRep.set(b.repName, set)
  }

  const round1 = (n: number) => Math.round(n * 10) / 10
  const rows: FieldRepLeaderboardRow[] = Array.from(byRep.entries()).map(([repName, stats]) => {
    const planned = plannedStopsByRep.get(repName)
    const plannedStops = planned ? planned.size : null
    // distinctCustomersVisited is the rep's real total — every distinct
    // customer they actually got an order from this period, regardless of
    // whether that customer happens to be on their formal beat plan (a rep
    // can genuinely pick up an off-plan customer). The hit-rate below needs
    // a NARROWER intersection (visited AND planned) to mean "% of planned
    // stops actually hit" — that's a separate figure, not this one; an
    // earlier version of this function wrongly reused the same filtered
    // count for both, silently undercounting a rep's own real activity
    // whenever they had an active beat and any off-plan customer.
    const plannedStopsHit = planned ? [...stats.customerIds].filter((cid) => planned.has(cid)).length : 0
    return {
      repName, ordersBooked: stats.ordersBooked, totalValue: round1(stats.totalValue),
      plannedStops, distinctCustomersVisited: stats.customerIds.size,
      hitRatePercent: plannedStops && plannedStops > 0 ? round1((plannedStopsHit / plannedStops) * 100) : null,
    }
  }).sort((a, b) => b.totalValue - a.totalValue)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, rows,
    summary: {
      totalOrdersBooked: rows.reduce((s, r) => s + r.ordersBooked, 0),
      totalValue: round1(rows.reduce((s, r) => s + r.totalValue, 0)),
    },
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
  const to = toDateEnd(params.dateTo)

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
      startDate: p.startDate ? toLocalISODate(p.startDate) : null,
      expectedEndDate: p.expectedEndDate ? toLocalISODate(p.expectedEndDate) : null,
      completedDate: p.completedDate ? toLocalISODate(p.completedDate) : null,
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
  const to = toDateEnd(params.dateTo)

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
      receivedDate: toLocalISODate(j.receivedDate),
      expectedDate: j.expectedDate ? toLocalISODate(j.expectedDate) : null,
      deliveredDate: j.deliveredDate ? toLocalISODate(j.deliveredDate) : null,
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
  const to = toDateEnd(params.dateTo)

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
      createdAt: toLocalISODate(j.createdAt),
      deliveredDate: j.deliveredDate ? toLocalISODate(j.deliveredDate) : null,
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
  const to = toDateEnd(params.dateTo)

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
      createdAt: toLocalISODate(o.createdAt),
      deliveryDate: o.deliveryDate ? toLocalISODate(o.deliveryDate) : null,
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
  const to = toDateEnd(params.dateTo)
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
      return { contractNumber: c.contractNumber, customerName: c.client.customerName, pestTypes, endDate: toLocalISODate(c.endDate!), daysUntilExpiry }
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
  const to = toDateEnd(params.dateTo)

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
      createdAt: toLocalISODate(d.createdAt),
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
  const to = toDateEnd(params.dateTo)
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

// Phase 68 §9.1 — Independent Consultant item 1: retainer-utilization-vs-
// billed tracking. RetainersScreen.tsx already shows a live per-retainer
// hours-used progress bar (item 2, "burn-down" — already covered, no
// changes needed there); this is the missing cross-cut view: utilization %
// for every HOURLY_BUCKET-style retainer (hoursPerMonth set) side-by-side
// with whether it's actually been billed for the current period, so a
// consultant can spot "high utilization but not yet invoiced" at a glance.
export interface RetainerUtilizationRow {
  title: string; clientName: string; hoursPerMonth: number; hoursUsed: number
  utilizationPercent: number; monthlyAmount: number; billedThisPeriod: boolean
}
export interface RetainerUtilizationReport {
  period: string
  rows: RetainerUtilizationRow[]
  summary: { totalRetainers: number; overUtilizedCount: number; unbilledCount: number }
}

async function generateRetainerUtilizationReport(): Promise<RetainerUtilizationReport> {
  const db = getPrisma()
  const now = new Date()
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const retainers = await db.retainerAgreement.findMany({
    where: { status: 'ACTIVE', hoursPerMonth: { not: null } },
    include: { client: { select: { customerName: true } } },
  })

  const round1 = (n: number) => Math.round(n * 10) / 10
  const rows: RetainerUtilizationRow[] = await Promise.all(retainers.map(async (r) => {
    const entries = await db.timeEntry.findMany({ where: { retainerId: r.id, date: { gte: periodStart, lte: periodEnd } }, select: { hours: true } })
    const hoursUsed = round1(entries.reduce((s, e) => s + Number(e.hours), 0))
    const hoursPerMonth = Number(r.hoursPerMonth)
    return {
      title: r.title, clientName: r.client.customerName, hoursPerMonth, hoursUsed,
      utilizationPercent: hoursPerMonth > 0 ? round1((hoursUsed / hoursPerMonth) * 100) : 0,
      monthlyAmount: Number(r.monthlyAmount), billedThisPeriod: r.lastInvoicedPeriod === period,
    }
  }))
  rows.sort((a, b) => b.utilizationPercent - a.utilizationPercent)

  return {
    period, rows,
    summary: {
      totalRetainers: rows.length,
      overUtilizedCount: rows.filter((r) => r.utilizationPercent > 100).length,
      unbilledCount: rows.filter((r) => !r.billedThisPeriod).length,
    },
  }
}

// Phase 68 §9.1 — Independent Consultant item 3: proposal win-rate
// tracking. A Quotation IS the proposal document in this system (no
// separate Proposal entity) — win rate is scoped to quotations that were
// actually SENT to the client (a DRAFT never reached anyone, so it isn't a
// "decided" proposal yet), ACCEPTED = won, EXPIRED = lost, still-SENT =
// pending (excluded from the rate denominator, shown separately).
export interface ProposalWinRateReport {
  dateFrom: string; dateTo: string
  summary: { wonCount: number; lostCount: number; pendingCount: number; winRatePercent: number; wonValue: number }
}

async function generateProposalWinRateReport(params: { dateFrom: string; dateTo: string }): Promise<ProposalWinRateReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const quotations = await db.quotation.findMany({
    where: { status: { in: ['SENT', 'ACCEPTED', 'EXPIRED'] }, createdAt: { gte: from, lte: to } },
    select: { status: true, totalAmount: true },
  })

  const wonCount = quotations.filter((q) => q.status === 'ACCEPTED').length
  const lostCount = quotations.filter((q) => q.status === 'EXPIRED').length
  const pendingCount = quotations.filter((q) => q.status === 'SENT').length
  const decidedCount = wonCount + lostCount
  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      wonCount, lostCount, pendingCount,
      winRatePercent: decidedCount > 0 ? Math.round((wonCount / decidedCount) * 1000) / 10 : 0,
      wonValue: roundCurrency(quotations.filter((q) => q.status === 'ACCEPTED').reduce((s, q) => s + q.totalAmount, 0)),
    },
  }
}

// Phase 68 §9.1 — Independent Consultant item 4: client revenue
// concentration. What share of total invoiced revenue comes from each
// client, ranked worst-concentration-first — a consultant with one client
// at 60%+ of revenue has a real, actionable dependency risk even though
// every individual invoice looks perfectly healthy on its own.
export interface ClientRevenueConcentrationRow {
  clientName: string; revenue: number; revenueSharePercent: number; cumulativeSharePercent: number
}
export interface ClientRevenueConcentrationReport {
  dateFrom: string; dateTo: string
  rows: ClientRevenueConcentrationRow[]
  summary: { totalRevenue: number; topClientSharePercent: number; top3SharePercent: number }
}

async function generateClientRevenueConcentrationReport(params: { dateFrom: string; dateTo: string }): Promise<ClientRevenueConcentrationReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const invoices = await db.invoice.findMany({
    where: { invoiceDate: { gte: from, lte: to }, status: { not: 'CANCELLED' } },
    select: { customerId: true, customer: { select: { customerName: true } }, totalAmount: true },
  })

  const byCustomer = new Map<string, { clientName: string; revenue: number }>()
  for (const inv of invoices) {
    if (!inv.customerId) continue
    const existing = byCustomer.get(inv.customerId) ?? { clientName: inv.customer?.customerName ?? 'Unknown', revenue: 0 }
    existing.revenue += inv.totalAmount
    byCustomer.set(inv.customerId, existing)
  }

  const totalRevenue = roundCurrency(Array.from(byCustomer.values()).reduce((s, c) => s + c.revenue, 0))
  const round1 = (n: number) => Math.round(n * 10) / 10
  let cumulative = 0
  const rows: ClientRevenueConcentrationRow[] = Array.from(byCustomer.values())
    .sort((a, b) => b.revenue - a.revenue)
    .map((c) => {
      const revenueSharePercent = totalRevenue > 0 ? round1((c.revenue / totalRevenue) * 100) : 0
      cumulative += revenueSharePercent
      return { clientName: c.clientName, revenue: roundCurrency(c.revenue), revenueSharePercent, cumulativeSharePercent: round1(cumulative) }
    })

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, rows,
    summary: {
      totalRevenue,
      topClientSharePercent: rows[0]?.revenueSharePercent ?? 0,
      top3SharePercent: round1(rows.slice(0, 3).reduce((s, r) => s + r.revenueSharePercent, 0)),
    },
  }
}

// Phase 68 §9.1 — Marketing Agency item 1: Campaign ROI/budget tracking.
// Deliberately a PLANNED-vs-ACTUAL spend + cost-efficiency report, not a
// fabricated dollar "ROI" — this system captures ad spend and conversions
// per campaign but has no attributed-revenue data (no e-commerce/sales
// linkage back to a specific campaign), so a real $-ROI figure would be
// invented, not measured. Budget variance + cost-per-conversion (from the
// same source getCampaignPerformanceSummary already computes) are the
// honest signals available: is this campaign overspending its planned
// budget, and is it converting efficiently.
export interface CampaignROIRow {
  projectName: string; clientName: string; targetChannel: string | null
  adSpendBudget: number | null; actualSpend: number; budgetVariancePercent: number | null
  conversions: number; costPerConversion: number | null
}
export interface CampaignROIReport {
  rows: CampaignROIRow[]
  summary: { totalCampaigns: number; totalBudget: number; totalActualSpend: number; overBudgetCount: number }
}

async function generateCampaignROIReport(): Promise<CampaignROIReport> {
  const db = getPrisma()
  const campaigns = await db.serviceProject.findMany({
    where: { projectType: 'MARKETING_CAMPAIGN' },
    include: { client: { select: { customerName: true } }, campaignPerformanceEntries: { select: { actualSpend: true, conversions: true } } },
  })

  const round1 = (n: number) => Math.round(n * 10) / 10
  const rows: CampaignROIRow[] = campaigns.map((c) => {
    const actualSpend = roundCurrency(c.campaignPerformanceEntries.reduce((s, e) => s + Number(e.actualSpend ?? 0), 0))
    const conversions = c.campaignPerformanceEntries.reduce((s, e) => s + (e.conversions ?? 0), 0)
    const adSpendBudget = c.adSpendBudget == null ? null : Number(c.adSpendBudget)
    return {
      projectName: c.projectName, clientName: c.client.customerName, targetChannel: c.targetChannel,
      adSpendBudget, actualSpend,
      budgetVariancePercent: adSpendBudget != null && adSpendBudget > 0 ? round1(((actualSpend - adSpendBudget) / adSpendBudget) * 100) : null,
      conversions, costPerConversion: conversions > 0 ? roundCurrency(actualSpend / conversions) : null,
    }
  }).sort((a, b) => (b.budgetVariancePercent ?? -Infinity) - (a.budgetVariancePercent ?? -Infinity))

  return {
    rows,
    summary: {
      totalCampaigns: rows.length,
      totalBudget: roundCurrency(rows.reduce((s, r) => s + (r.adSpendBudget ?? 0), 0)),
      totalActualSpend: roundCurrency(rows.reduce((s, r) => s + r.actualSpend, 0)),
      overBudgetCount: rows.filter((r) => (r.budgetVariancePercent ?? 0) > 0).length,
    },
  }
}

// Phase 68 §9.1 — Marketing Agency item 3: deliverable-status pipeline. A
// current-state distribution of every ContentCalendarItem's status, plus
// how many are overdue (scheduledDate already passed but still
// PLANNED/IN_PROGRESS — the real "stuck deliverable" signal, distinct from
// a raw status count).
export interface DeliverableStatusPipelineStage { status: string; count: number }
export interface DeliverableStatusPipelineReport {
  stages: DeliverableStatusPipelineStage[]
  summary: { totalDeliverables: number; overdueCount: number }
}

async function generateDeliverableStatusPipelineReport(): Promise<DeliverableStatusPipelineReport> {
  const db = getPrisma()
  const now = new Date()
  const items = await db.contentCalendarItem.findMany({ select: { status: true, scheduledDate: true } })

  const byStatus = new Map<string, number>()
  for (const i of items) byStatus.set(i.status, (byStatus.get(i.status) ?? 0) + 1)

  return {
    stages: Array.from(byStatus.entries()).map(([status, count]) => ({ status, count })),
    summary: {
      totalDeliverables: items.length,
      overdueCount: items.filter((i) => (i.status === 'PLANNED' || i.status === 'IN_PROGRESS') && i.scheduledDate < now).length,
    },
  }
}

// Phase 68 §9.1 — Marketing Agency item 4: channel performance. Aggregates
// CampaignPerformanceEntry data across ALL campaigns sharing the same
// ServiceProject.targetChannel — the missing cross-campaign view (the
// pre-existing getCampaignPerformanceSummary is per-project only).
export interface ChannelPerformanceRow {
  channel: string; campaignCount: number; totalImpressions: number; totalClicks: number
  totalConversions: number; totalActualSpend: number; ctrPercent: number | null; costPerConversion: number | null
}
export interface ChannelPerformanceReport {
  rows: ChannelPerformanceRow[]
}

async function generateChannelPerformanceReport(): Promise<ChannelPerformanceReport> {
  const db = getPrisma()
  const campaigns = await db.serviceProject.findMany({
    where: { projectType: 'MARKETING_CAMPAIGN', targetChannel: { not: null } },
    select: { targetChannel: true, campaignPerformanceEntries: { select: { impressions: true, clicks: true, conversions: true, actualSpend: true } } },
  })

  const byChannel = new Map<string, { campaignCount: number; impressions: number; clicks: number; conversions: number; actualSpend: number }>()
  for (const c of campaigns) {
    const channel = c.targetChannel as string
    const existing = byChannel.get(channel) ?? { campaignCount: 0, impressions: 0, clicks: 0, conversions: 0, actualSpend: 0 }
    existing.campaignCount += 1
    for (const e of c.campaignPerformanceEntries) {
      existing.impressions += e.impressions ?? 0
      existing.clicks += e.clicks ?? 0
      existing.conversions += e.conversions ?? 0
      existing.actualSpend += Number(e.actualSpend ?? 0)
    }
    byChannel.set(channel, existing)
  }

  const round1 = (n: number) => Math.round(n * 10) / 10
  const rows: ChannelPerformanceRow[] = Array.from(byChannel.entries())
    .map(([channel, v]) => ({
      channel, campaignCount: v.campaignCount, totalImpressions: v.impressions, totalClicks: v.clicks,
      totalConversions: v.conversions, totalActualSpend: roundCurrency(v.actualSpend),
      ctrPercent: v.impressions > 0 ? round1((v.clicks / v.impressions) * 100) : null,
      costPerConversion: v.conversions > 0 ? roundCurrency(v.actualSpend / v.conversions) : null,
    }))
    .sort((a, b) => b.totalActualSpend - a.totalActualSpend)

  return { rows }
}

// Phase 68 §9.1 — Marketing Agency item 5: retainer-vs-work-delivered
// tracker. For each ACTIVE retainer whose client has at least one
// MARKETING_CAMPAIGN project, how many deliverables were actually
// PUBLISHED this month against the fee being billed — a real "are we
// delivering what we're charging for" signal, distinct from Independent
// Consultant's hours-based utilization report (this is output-count based,
// since a marketing retainer isn't necessarily hourly).
export interface RetainerWorkDeliveredRow {
  title: string; clientName: string; monthlyAmount: number; deliveredCount: number; billedThisPeriod: boolean
}
export interface RetainerWorkDeliveredReport {
  period: string
  rows: RetainerWorkDeliveredRow[]
  summary: { totalRetainers: number; zeroDeliveredCount: number }
}

async function generateRetainerWorkDeliveredReport(): Promise<RetainerWorkDeliveredReport> {
  const db = getPrisma()
  const now = new Date()
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

  const retainers = await db.retainerAgreement.findMany({
    where: { status: 'ACTIVE' },
    include: { client: { select: { customerName: true, serviceProjects: { where: { projectType: 'MARKETING_CAMPAIGN' }, select: { id: true } } } } },
  })
  const marketingRetainers = retainers.filter((r) => r.client.serviceProjects.length > 0)

  const rows: RetainerWorkDeliveredRow[] = await Promise.all(marketingRetainers.map(async (r) => {
    const projectIds = r.client.serviceProjects.map((p) => p.id)
    const deliveredCount = await db.contentCalendarItem.count({
      where: { projectId: { in: projectIds }, status: 'PUBLISHED', scheduledDate: { gte: periodStart, lte: periodEnd } },
    })
    return { title: r.title, clientName: r.client.customerName, monthlyAmount: Number(r.monthlyAmount), deliveredCount, billedThisPeriod: r.lastInvoicedPeriod === period }
  }))
  rows.sort((a, b) => a.deliveredCount - b.deliveredCount)

  return {
    period, rows,
    summary: { totalRetainers: rows.length, zeroDeliveredCount: rows.filter((r) => r.deliveredCount === 0).length },
  }
}

// Phase 68 §9.1 — Software Agency item 1: issue/ticket aging with SLA
// breach flag. No stored SLA-deadline field exists on Issue — thresholds
// are a fixed, documented lookup by priority (a real, if simple, SLA
// policy) rather than a fabricated per-issue deadline. Current-state
// worklist of every OPEN/IN_PROGRESS issue, worst (most overdue) first.
const SLA_THRESHOLD_DAYS: Record<string, number> = { HIGH: 2, MED: 5, LOW: 10 }

export interface IssueAgingRow {
  issueId: string; title: string; projectName: string; priority: string; status: string
  daysOpen: number; slaThresholdDays: number; slaBreached: boolean
}
export interface IssueAgingReport {
  rows: IssueAgingRow[]
  summary: { totalOpenIssues: number; breachedCount: number }
}

async function generateIssueAgingReport(): Promise<IssueAgingReport> {
  const db = getPrisma()
  const now = new Date()
  const issues = await db.issue.findMany({
    where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
    include: { project: { select: { projectName: true } } },
  })

  const rows: IssueAgingRow[] = issues.map((i) => {
    const daysOpen = Math.floor((now.getTime() - i.reportedDate.getTime()) / 86400000)
    const slaThresholdDays = SLA_THRESHOLD_DAYS[i.priority] ?? SLA_THRESHOLD_DAYS.MED
    return {
      issueId: i.id, title: i.title, projectName: i.project.projectName, priority: i.priority, status: i.status,
      daysOpen, slaThresholdDays, slaBreached: daysOpen > slaThresholdDays,
    }
  }).sort((a, b) => (b.daysOpen - b.slaThresholdDays) - (a.daysOpen - a.slaThresholdDays))

  return {
    rows,
    summary: { totalOpenIssues: rows.length, breachedCount: rows.filter((r) => r.slaBreached).length },
  }
}

// Phase 68 §9.1 — Software Agency item 4: team utilization. Distinct from
// the pre-existing generateConsultantUtilizationReport, which is scoped to
// the OLDER WorkLog/Project models — Software Agency (and Architect/Civil/
// Consultant/Agency generally) logs hours via TimeEntry against
// ServiceProject, a completely different model the old report never
// queries. "Billable" = ratePerHour > 0, same convention as Lawyer's own
// billable-hours report.
export interface TeamUtilizationRow {
  employeeName: string; billableHours: number; nonBillableHours: number; totalHours: number; utilizationPercent: number
}
export interface TeamUtilizationReport {
  dateFrom: string; dateTo: string
  rows: TeamUtilizationRow[]
  summary: { totalBillableHours: number; totalNonBillableHours: number; overallUtilizationPercent: number }
}

async function generateTeamUtilizationReport(params: { dateFrom: string; dateTo: string }): Promise<TeamUtilizationReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const entries = await db.timeEntry.findMany({
    where: { projectId: { not: null }, date: { gte: from, lte: to } },
    select: { hours: true, ratePerHour: true, employeeId: true, employee: { select: { fullName: true } } },
  })

  const round1 = (n: number) => Math.round(n * 10) / 10
  const byEmployee = new Map<string, { employeeName: string; billable: number; nonBillable: number }>()
  for (const e of entries) {
    const key = e.employeeId ?? 'unassigned'
    const existing = byEmployee.get(key) ?? { employeeName: e.employee?.fullName ?? 'Unassigned', billable: 0, nonBillable: 0 }
    if (Number(e.ratePerHour) > 0) existing.billable += Number(e.hours)
    else existing.nonBillable += Number(e.hours)
    byEmployee.set(key, existing)
  }

  const rows: TeamUtilizationRow[] = Array.from(byEmployee.values()).map((e) => {
    const totalHours = e.billable + e.nonBillable
    return {
      employeeName: e.employeeName, billableHours: round1(e.billable), nonBillableHours: round1(e.nonBillable),
      totalHours: round1(totalHours), utilizationPercent: totalHours > 0 ? round1((e.billable / totalHours) * 100) : 0,
    }
  }).sort((a, b) => a.utilizationPercent - b.utilizationPercent)

  const totalBillableHours = round1(rows.reduce((s, r) => s + r.billableHours, 0))
  const totalNonBillableHours = round1(rows.reduce((s, r) => s + r.nonBillableHours, 0))
  const grandTotal = totalBillableHours + totalNonBillableHours
  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, rows,
    summary: { totalBillableHours, totalNonBillableHours, overallUtilizationPercent: grandTotal > 0 ? round1((totalBillableHours / grandTotal) * 100) : 0 },
  }
}

// Phase 68 §9.1 — Software Agency item 5: sprint/release-linked billing
// milestones. Every COMPLETED sprint across every project, whether it has
// a linked billing milestone yet and, if so, that milestone's own status —
// unlinked (nothing billed) sprints surface first, the real "delivered but
// not billed" signal.
export interface SprintBillingRow {
  projectName: string; sprintNumber: number; sprintName: string | null
  milestoneStatus: string | null; milestoneAmount: number | null
}
export interface SprintBillingReport {
  rows: SprintBillingRow[]
  summary: { totalCompletedSprints: number; unlinkedCount: number }
}

async function generateSprintBillingReport(): Promise<SprintBillingReport> {
  const db = getPrisma()
  const sprints = await db.sprint.findMany({
    where: { status: 'COMPLETED' },
    include: { project: { select: { projectName: true } }, milestone: { select: { status: true, milestoneAmount: true } } },
  })

  const rows: SprintBillingRow[] = sprints.map((s) => ({
    projectName: s.project.projectName, sprintNumber: s.sprintNumber, sprintName: s.name,
    milestoneStatus: s.milestone?.status ?? null,
    milestoneAmount: s.milestone?.milestoneAmount == null ? null : Number(s.milestone.milestoneAmount),
  })).sort((a, b) => Number(a.milestoneStatus !== null) - Number(b.milestoneStatus !== null))

  return {
    rows,
    summary: { totalCompletedSprints: rows.length, unlinkedCount: rows.filter((r) => r.milestoneStatus === null).length },
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
  const to = toDateEnd(params.dateTo)

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
      clientName: b.client.customerName, shootType: b.shootType, shootDate: toLocalISODate(b.shootDate),
      status: b.status, finalAmount: b.finalAmount != null ? Number(b.finalAmount) : null,
    })),
  }
}

// Phase 68 §9.1 — Photo Studio items 1/2/5: post-production/delivery
// pipeline status + revision-round tracker. "Stage" is derived from which
// DeliveryTracker date fields are actually set (never guessed from status
// alone — a booking can sit in EDITING for weeks with no dates logged yet).
// revisionRounds worklist (item 5) lives in the SAME report since it's the
// same underlying entity and both are "how is this delivery actually
// progressing" signals, not two independent data domains.
const PIPELINE_STAGE_ORDER = ['NOT_STARTED', 'PROOFS_SENT', 'SELECTION_RECEIVED', 'EDITING', 'ALBUM_PROOF_SENT', 'DELIVERED'] as const

function deliveryStage(d: { proofsSentDate: Date | null; selectionReceivedDate: Date | null; editingStartedDate: Date | null; albumProofSentDate: Date | null; finalDeliveredDate: Date | null } | null): string {
  if (!d) return 'NOT_STARTED'
  if (d.finalDeliveredDate) return 'DELIVERED'
  if (d.albumProofSentDate) return 'ALBUM_PROOF_SENT'
  if (d.editingStartedDate) return 'EDITING'
  if (d.selectionReceivedDate) return 'SELECTION_RECEIVED'
  if (d.proofsSentDate) return 'PROOFS_SENT'
  return 'NOT_STARTED'
}

export interface DeliveryPipelineStage { stage: string; count: number }
export interface DeliveryPipelineRevisionRow {
  bookingId: string; clientName: string; shootType: string; revisionRounds: number; stage: string
}
export interface DeliveryPipelineReport {
  stages: DeliveryPipelineStage[]
  revisionRows: DeliveryPipelineRevisionRow[]
  summary: { totalActive: number; deliveredCount: number; overdueCount: number; avgRevisionRounds: number }
}

async function generateDeliveryPipelineReport(): Promise<DeliveryPipelineReport> {
  const db = getPrisma()
  const now = new Date()
  const bookings = await db.shootBooking.findMany({
    where: { status: { not: 'CANCELLED' } },
    include: { client: { select: { customerName: true } }, delivery: true },
  })

  const byStage = new Map<string, number>()
  for (const s of PIPELINE_STAGE_ORDER) byStage.set(s, 0)
  let overdueCount = 0
  const revisionRows: DeliveryPipelineRevisionRow[] = []
  for (const b of bookings) {
    const stage = deliveryStage(b.delivery)
    byStage.set(stage, (byStage.get(stage) ?? 0) + 1)
    if (stage !== 'DELIVERED' && b.deliveryDeadline && b.deliveryDeadline < now) overdueCount += 1
    if (b.delivery && b.delivery.revisionRounds > 0) {
      revisionRows.push({ bookingId: b.id, clientName: b.client.customerName, shootType: b.shootType, revisionRounds: b.delivery.revisionRounds, stage })
    }
  }
  revisionRows.sort((a, b) => b.revisionRounds - a.revisionRounds)

  const round1 = (n: number) => Math.round(n * 10) / 10
  const withDelivery = bookings.filter((b) => b.delivery)
  const avgRevisionRounds = withDelivery.length > 0 ? round1(withDelivery.reduce((s, b) => s + (b.delivery?.revisionRounds ?? 0), 0) / withDelivery.length) : 0

  return {
    stages: PIPELINE_STAGE_ORDER.map((stage) => ({ stage, count: byStage.get(stage) ?? 0 })),
    revisionRows,
    summary: { totalActive: bookings.length, deliveredCount: byStage.get('DELIVERED') ?? 0, overdueCount, avgRevisionRounds },
  }
}

// Phase 68 §9.1 — Photo Studio item 4: shoot-type revenue mix. Revenue,
// booking count, and average ticket per shoot type, ranked by revenue
// share — distinct from the pre-existing generateShootBookingReport's
// byShootType (a plain count, no revenue cross-cut).
export interface ShootTypeRevenueMixRow {
  shootType: string; bookingCount: number; totalRevenue: number; avgTicket: number; revenueSharePercent: number
}
export interface ShootTypeRevenueMixReport {
  dateFrom: string; dateTo: string
  rows: ShootTypeRevenueMixRow[]
  summary: { totalRevenue: number; totalBookings: number }
}

async function generateShootTypeRevenueMixReport(params: { dateFrom: string; dateTo: string }): Promise<ShootTypeRevenueMixReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const bookings = await db.shootBooking.findMany({
    where: { createdAt: { gte: from, lte: to }, finalAmount: { not: null } },
    select: { shootType: true, finalAmount: true },
  })

  const byType = new Map<string, { count: number; revenue: number }>()
  for (const b of bookings) {
    const existing = byType.get(b.shootType) ?? { count: 0, revenue: 0 }
    existing.count += 1
    existing.revenue += Number(b.finalAmount)
    byType.set(b.shootType, existing)
  }

  const totalRevenue = roundCurrency(Array.from(byType.values()).reduce((s, v) => s + v.revenue, 0))
  const round1 = (n: number) => Math.round(n * 10) / 10
  const rows: ShootTypeRevenueMixRow[] = Array.from(byType.entries())
    .map(([shootType, v]) => ({
      shootType, bookingCount: v.count, totalRevenue: roundCurrency(v.revenue),
      avgTicket: v.count > 0 ? roundCurrency(v.revenue / v.count) : 0,
      revenueSharePercent: totalRevenue > 0 ? round1((v.revenue / totalRevenue) * 100) : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, rows,
    summary: { totalRevenue, totalBookings: bookings.length },
  }
}

// Phase 68 §9.1 — Photo Studio item 3: studio-owned equipment
// rental-and-return tracking. Every currently-outstanding checkout
// (actualReturnDate still null), overdue ones (past expectedReturnDate)
// first — the real "what's out and late" worklist.
export interface EquipmentCheckoutRow {
  checkoutId: string; assetName: string; checkedOutToName: string | null
  checkedOutDate: string; expectedReturnDate: string | null; daysOut: number; isOverdue: boolean
}
export interface EquipmentCheckoutReport {
  rows: EquipmentCheckoutRow[]
  summary: { totalOutstanding: number; overdueCount: number }
}

async function generateEquipmentCheckoutReport(): Promise<EquipmentCheckoutReport> {
  const db = getPrisma()
  const now = new Date()
  const checkouts = await db.equipmentCheckout.findMany({
    where: { actualReturnDate: null },
    include: { fixedAsset: { select: { assetName: true } }, checkedOutTo: { select: { fullName: true } } },
    orderBy: { checkedOutDate: 'asc' },
  })

  const rows: EquipmentCheckoutRow[] = checkouts.map((c) => ({
    checkoutId: c.id, assetName: c.fixedAsset.assetName, checkedOutToName: c.checkedOutTo?.fullName ?? null,
    checkedOutDate: toLocalISODate(c.checkedOutDate),
    expectedReturnDate: c.expectedReturnDate ? toLocalISODate(c.expectedReturnDate) : null,
    daysOut: Math.floor((now.getTime() - c.checkedOutDate.getTime()) / 86400000),
    isOverdue: !!c.expectedReturnDate && c.expectedReturnDate < now,
  })).sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue))

  return {
    rows,
    summary: { totalOutstanding: rows.length, overdueCount: rows.filter((r) => r.isOverdue).length },
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
  const to = toDateEnd(params.dateTo)

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
      eventDate: toLocalISODate(b.eventDate), status: b.status,
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
  const to = toDateEnd(params.dateTo)

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
      clientName: p.client.customerName, status: p.status, joiningDate: toLocalISODate(p.joiningDate),
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
  const to = toDateEnd(params.dateTo)

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
      issuedDate: d.issuedDate ? toLocalISODate(d.issuedDate) : null,
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
  const to = toDateEnd(params.dateTo)

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
      projectName: v.project.projectName, visitDate: toLocalISODate(v.visitDate), visitType: v.visitType,
      recordedByName: v.recordedBy?.fullName ?? null, findings: v.findings,
    })),
  }
}

// Phase 68 §9.1 — Civil Engineer items 1/2: visits billed vs. unbilled. A
// current-state worklist (like every other billed/unbilled-style report in
// this phase) of every site visit with a real billableAmount set —
// unbilled first, so the practice sees exactly what it can invoice today.
export interface SiteVisitBillingRow {
  siteVisitId: string; projectName: string; visitDate: string; visitType: string
  billableAmount: number; isBilled: boolean
}
export interface SiteVisitBillingReport {
  rows: SiteVisitBillingRow[]
  summary: { totalBillableAmount: number; totalBilledAmount: number; totalUnbilledAmount: number; unbilledCount: number }
}

async function generateSiteVisitBillingReport(): Promise<SiteVisitBillingReport> {
  const db = getPrisma()
  const visits = await db.siteVisit.findMany({
    where: { billableAmount: { not: null } },
    include: { project: { select: { projectName: true } } },
    orderBy: { visitDate: 'desc' },
  })

  const rows: SiteVisitBillingRow[] = visits.map((v) => ({
    siteVisitId: v.id, projectName: v.project.projectName, visitDate: toLocalISODate(v.visitDate), visitType: v.visitType,
    billableAmount: roundCurrency(Number(v.billableAmount)),
    isBilled: !!v.invoiceId,
  })).sort((a, b) => Number(a.isBilled) - Number(b.isBilled))

  const totalBillableAmount = roundCurrency(rows.reduce((s, r) => s + r.billableAmount, 0))
  const totalBilledAmount = roundCurrency(rows.filter((r) => r.isBilled).reduce((s, r) => s + r.billableAmount, 0))
  return {
    rows,
    summary: {
      totalBillableAmount, totalBilledAmount,
      totalUnbilledAmount: roundCurrency(totalBillableAmount - totalBilledAmount),
      unbilledCount: rows.filter((r) => !r.isBilled).length,
    },
  }
}

// Phase 68 §9.1 — Civil Engineer item 5: material-testing results. Every
// recorded test, FAILED ones surfaced first (the actionable signal — a
// PASS needs no follow-up, a FAIL does), with a plain pass-rate summary.
export interface MaterialTestResultsRow {
  projectName: string; testType: string; materialDescription: string | null
  testValue: number | null; unit: string | null; requiredMinValue: number | null
  result: string; testedDate: string | null
}
export interface MaterialTestResultsReport {
  rows: MaterialTestResultsRow[]
  summary: { totalTests: number; passCount: number; failCount: number; pendingCount: number; passRatePercent: number }
}

async function generateMaterialTestResultsReport(): Promise<MaterialTestResultsReport> {
  const db = getPrisma()
  const results = await db.materialTestResult.findMany({
    include: { siteVisit: { select: { project: { select: { projectName: true } } } } },
    orderBy: { createdAt: 'desc' },
  })

  const RESULT_PRIORITY: Record<string, number> = { FAIL: 0, PENDING: 1, PASS: 2 }
  const rows: MaterialTestResultsRow[] = results.map((r) => ({
    projectName: r.siteVisit.project.projectName, testType: r.testType, materialDescription: r.materialDescription,
    testValue: r.testValue == null ? null : Number(r.testValue),
    unit: r.unit, requiredMinValue: r.requiredMinValue == null ? null : Number(r.requiredMinValue),
    result: r.result, testedDate: r.testedDate ? toLocalISODate(r.testedDate) : null,
  })).sort((a, b) => (RESULT_PRIORITY[a.result] ?? 3) - (RESULT_PRIORITY[b.result] ?? 3))

  const passCount = rows.filter((r) => r.result === 'PASS').length
  const failCount = rows.filter((r) => r.result === 'FAIL').length
  const pendingCount = rows.filter((r) => r.result === 'PENDING').length
  const decidedCount = passCount + failCount
  return {
    rows,
    summary: { totalTests: rows.length, passCount, failCount, pendingCount, passRatePercent: decidedCount > 0 ? Math.round((passCount / decidedCount) * 1000) / 10 : 0 },
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
// Phase 67 §9.1 — Pharmacy's "Doctor-wise prescription volume" signature-win
// report extends this EXISTING flat-table report with a doctor-grouped
// aggregation rather than building a new report — see the master prompt's
// own corrected grounding note.
export interface PrescriptionDrugSalesByDoctor { doctorName: string; salesCount: number; totalAmount: number }
export interface PrescriptionDrugSalesReport {
  dateFrom: string; dateTo: string
  summary: { totalSales: number; totalAmount: number; missingPrescriptionDetails: number }
  byDoctor: PrescriptionDrugSalesByDoctor[]
  rows: PrescriptionDrugSalesReportRow[]
}

async function generatePrescriptionDrugSalesReport(params: { dateFrom: string; dateTo: string }): Promise<PrescriptionDrugSalesReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

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
    byDoctor: (() => {
      const byDoctor = new Map<string, { salesCount: number; totalAmount: number }>()
      for (const i of items) {
        const name = i.prescriptionDoctorName
        if (!name) continue
        const existing = byDoctor.get(name) ?? { salesCount: 0, totalAmount: 0 }
        existing.salesCount += 1
        existing.totalAmount += i.lineTotal
        byDoctor.set(name, existing)
      }
      return Array.from(byDoctor.entries())
        .map(([doctorName, v]) => ({ doctorName, ...v }))
        .sort((a, b) => b.salesCount - a.salesCount)
    })(),
    rows: items.map(i => ({
      invoiceNumber: i.invoice.invoiceNumber, invoiceDate: toLocalISODate(i.invoice.createdAt),
      productName: i.productName, quantity: i.quantity,
      patientName: i.prescriptionPatientName, doctorName: i.prescriptionDoctorName,
      prescriptionDate: i.prescriptionDate ? toLocalISODate(i.prescriptionDate) : null,
      customerName: i.invoice.customer?.customerName ?? null, lineTotal: i.lineTotal,
    })),
  }
}

// Phase 67 §9.1 — Pharmacy item 1: Schedule H1/X Narcotic Register.
// "The feature that makes an inspector trust the software, not a
// nice-to-have." Schedule H1/X (narcotic/psychotropic) drugs are a
// STRICTER subcategory of the broader Schedule H/H1 prescription-required
// flag the platform already had (see generatePrescriptionDrugSalesReport
// just above) — every Schedule H1/X sale is also prescription-required,
// but not every prescription-required sale is Schedule H1/X, so this is a
// deliberately NARROWER register, not a duplicate of the existing one.
// Sourced the same way — InvoiceItem's own prescription snapshot fields,
// filtered to Product.isScheduleH1X — never a separate capture mechanism.
// Deliberately does NOT claim full statutory register-field completeness
// (e.g. no doctor registration number or patient address are captured
// anywhere in this platform) — it surfaces exactly what Sarang actually
// records, honestly, not a compliance guarantee.
export interface ScheduleH1XRegisterRow {
  invoiceNumber: string; invoiceDate: string; productName: string; quantity: number
  patientName: string | null; doctorName: string | null; prescriptionDate: string | null
  customerName: string | null
}
export interface ScheduleH1XRegisterReport {
  dateFrom: string; dateTo: string
  summary: { totalSales: number; totalQuantity: number; missingPrescriptionDetails: number }
  rows: ScheduleH1XRegisterRow[]
}

async function generateScheduleH1XRegisterReport(params: { dateFrom: string; dateTo: string }): Promise<ScheduleH1XRegisterReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const items = await db.invoiceItem.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      product: { isScheduleH1X: true },
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
      totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
      missingPrescriptionDetails: items.filter(i => !i.prescriptionPatientName || !i.prescriptionDoctorName).length,
    },
    rows: items.map(i => ({
      invoiceNumber: i.invoice.invoiceNumber, invoiceDate: toLocalISODate(i.invoice.createdAt),
      productName: i.productName, quantity: i.quantity,
      patientName: i.prescriptionPatientName, doctorName: i.prescriptionDoctorName,
      prescriptionDate: i.prescriptionDate ? toLocalISODate(i.prescriptionDate) : null,
      customerName: i.invoice.customer?.customerName ?? null,
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

export interface RentalOverdueAgingBucket { bucket: string; count: number }
export interface RentalStatusReport {
  rows: RentalStatusRow[]
  summary: { totalCheckedOut: number; overdueCount: number }
  // Phase 67 §9.1 — Rental item 4: Overdue Returns aging bar. The list
  // itself (rows above) already existed; this is the missing "by how long"
  // breakdown the audit's own item wording specifically named — one
  // overdue BOOKING per bucket (not one row per item), since a booking with
  // 3 items overdue by the same amount is one real-world follow-up call,
  // not three.
  agingBuckets: RentalOverdueAgingBucket[]
}

const OVERDUE_AGING_BUCKETS = [
  { label: '1-3 days', min: 1, max: 3 },
  { label: '4-7 days', min: 4, max: 7 },
  { label: '8-14 days', min: 8, max: 14 },
  { label: '15+ days', min: 15, max: Infinity },
]

async function generateRentalStatusReport(): Promise<RentalStatusReport> {
  const db = getPrisma()
  const bookings = await db.rentalBooking.findMany({
    where: { status: 'CHECKED_OUT' },
    include: { customer: { select: { customerName: true } }, items: { include: { product: { select: { productName: true } }, rentalUnit: { select: { unitLabel: true } } } } },
    orderBy: { endDateTime: 'asc' },
  })

  const now = new Date()
  const rows: RentalStatusRow[] = []
  const bookingDaysOverdue: number[] = []
  for (const b of bookings) {
    const isOverdue = b.endDateTime < now
    const daysOverdue = isOverdue ? Math.ceil((now.getTime() - b.endDateTime.getTime()) / 86_400_000) : 0
    if (isOverdue) bookingDaysOverdue.push(daysOverdue)
    for (const item of b.items) {
      rows.push({
        bookingNumber: b.bookingNumber, customerName: b.customer.customerName,
        productName: item.product.productName, unitLabel: item.rentalUnit?.unitLabel ?? null,
        startDateTime: b.startDateTime.toISOString(), endDateTime: b.endDateTime.toISOString(),
        isOverdue, daysOverdue,
      })
    }
  }

  const agingBuckets: RentalOverdueAgingBucket[] = OVERDUE_AGING_BUCKETS.map(({ label, min, max }) => ({
    bucket: label, count: bookingDaysOverdue.filter(d => d >= min && d <= max).length,
  }))

  return {
    rows,
    summary: { totalCheckedOut: bookings.length, overdueCount: bookingDaysOverdue.length },
    agingBuckets,
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
  const to = toDateEnd(params.dateTo)
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

// Phase 67 §9.1 — Rental item 3: Asset Utilization Rate, per individual
// physical unit (not per product). generateRentalRevenueReport's own
// utilizationPercent above already exists but is averaged ACROSS every unit
// of a product — it can't tell you that one specific unit is idle 90% of
// the time while a sibling unit of the exact same product is rented
// constantly, which is the real "which assets actually earn their keep"
// question the audit's own item names. Deliberately a separate report, not
// an extension of generateRentalRevenueReport, matching this phase's own
// precedent of keeping a coarser existing report and a finer new one
// distinct rather than merging different grains into one.
export interface AssetUtilizationRow {
  rentalUnitId: string; unitLabel: string; productName: string; status: string
  rentedDays: number; availableDays: number; utilizationPercent: number
}
export interface AssetUtilizationReport {
  dateFrom: string; dateTo: string
  rows: AssetUtilizationRow[]
  summary: { totalUnits: number; avgUtilizationPercent: number; idleUnitCount: number }
}

async function generateAssetUtilizationReport(params: { dateFrom: string; dateTo: string }): Promise<AssetUtilizationReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)
  const rangeDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / 86_400_000))

  const units = await db.rentalUnit.findMany({
    where: { status: { not: 'RETIRED' } },
    include: { product: { select: { productName: true } } },
    orderBy: { unitLabel: 'asc' },
  })
  if (units.length === 0) return { dateFrom: params.dateFrom, dateTo: params.dateTo, rows: [], summary: { totalUnits: 0, avgUtilizationPercent: 0, idleUnitCount: 0 } }

  const items = await db.rentalBookingItem.findMany({
    where: {
      rentalUnitId: { in: units.map(u => u.id) },
      booking: { status: { in: ['CHECKED_OUT', 'RETURNED'] }, startDateTime: { lte: to }, endDateTime: { gte: from } },
    },
    select: { rentalUnitId: true, booking: { select: { startDateTime: true, endDateTime: true } } },
  })

  const rentedDaysByUnit = new Map<string, number>()
  for (const item of items) {
    if (!item.rentalUnitId) continue
    // Same overlap-days-within-range calculation generateRentalRevenueReport
    // already established — a booking spanning the full range counts fully,
    // one spanning just a slice of it counts only that slice.
    const overlapStart = item.booking.startDateTime > from ? item.booking.startDateTime : from
    const overlapEnd = item.booking.endDateTime < to ? item.booking.endDateTime : to
    const overlapMs = overlapEnd.getTime() - overlapStart.getTime()
    if (overlapMs > 0) rentedDaysByUnit.set(item.rentalUnitId, (rentedDaysByUnit.get(item.rentalUnitId) ?? 0) + overlapMs / 86_400_000)
  }

  const round1 = (n: number) => Math.round(n * 10) / 10
  const rows: AssetUtilizationRow[] = units.map(u => {
    const rentedDays = round1(Math.min(rangeDays, rentedDaysByUnit.get(u.id) ?? 0))
    return {
      rentalUnitId: u.id, unitLabel: u.unitLabel, productName: u.product.productName, status: u.status,
      rentedDays, availableDays: rangeDays,
      utilizationPercent: round1((rentedDays / rangeDays) * 100),
    }
  }).sort((a, b) => a.utilizationPercent - b.utilizationPercent) // worst-earning assets first — the actionable list

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, rows,
    summary: {
      totalUnits: rows.length,
      avgUtilizationPercent: round1(rows.reduce((s, r) => s + r.utilizationPercent, 0) / rows.length),
      idleUnitCount: rows.filter(r => r.utilizationPercent === 0).length,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 67 §9.1 — Distributor: Scheme Cost vs. Incremental Volume Report.
// The one piece of Phase 63's already-shipped PricingScheme engine that was
// never finished — schemes could be created and applied at billing, but
// nothing ever measured whether a scheme actually moved volume or just gave
// away margin. IMPORTANT SCOPE NOTE, confirmed via a dedicated research pass
// before writing this: this codebase has no counterfactual/baseline
// mechanism anywhere (no "what would volume have been without the scheme"
// concept) — this report is a CORRELATION view (scheme cost plotted
// alongside covered-product volume, by week), not a causal "this scheme
// created N incremental units" claim. The UI copy and this comment both say
// so explicitly rather than implying more certainty than the data supports.
// ─────────────────────────────────────────────────────────────────────────────

export interface SchemeCostVsVolumePoint { period: string; schemeCost: number; totalVolume: number }
export interface SchemeCostVsVolumeSchemeRow {
  schemeId: string; schemeName: string; ruleType: string
  totalCost: number; focUnitsGiven: number
}
export interface SchemeCostVsVolumeReport {
  dateFrom: string; dateTo: string
  summary: { totalSchemeCost: number; totalFocUnitsGiven: number; activeSchemeCount: number; coveredProductCount: number }
  byPeriod: SchemeCostVsVolumePoint[]
  rows: SchemeCostVsVolumeSchemeRow[]
}

// ISO-week bucket key (Monday start), local calendar — matches this
// project's own toLocalISODate() convention (never toISOString() for a
// date-only value, see harness.js's own documented UTC-lag bug class).
function weekStartKey(d: Date): string {
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = local.getDay() // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day
  local.setDate(local.getDate() + diffToMonday)
  return toLocalISODate(local)
}

// Phase 67 §9.1 item 19.2 (GP Clinic) — Recall Compliance report, feeding the
// Reports screen's own date-range-picker convention. The real logic lives in
// chronic-condition-record.service.ts (already unit-tested there, already
// reused by the GP Clinic list screen's own header figure) — this is a thin
// adapter unwrapping that function's `{success,data,error}` shape into the
// bare object every other function in this file returns, matching this
// file's own convention rather than duplicating the query.
async function generateChronicRecallComplianceReport(params: { dateFrom: string; dateTo: string }) {
  const res = await generateChronicRecallComplianceReportImpl(params)
  if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Could not generate chronic recall compliance report.')
  return res.data
}

// Phase 67 §9.1 item 21.4 — Dental Clinic: Recall Compliance report. Same
// thin-adapter shape as generateChronicRecallComplianceReport above — the
// real query lives in recall-record.service.ts (already unit-tested there,
// already reused by the Dental recall list screen's own header figure).
export interface DentalRecallComplianceByType { recallType: string; total: number; onTime: number; percent: number }
export interface DentalRecallComplianceReport {
  totalRecallsClosed: number; overallOnTime: number; overallPercent: number | null
  byRecallType: DentalRecallComplianceByType[]
}
async function generateDentalRecallComplianceReport(params: { dateFrom: string; dateTo: string }): Promise<DentalRecallComplianceReport> {
  const res = await generateDentalRecallComplianceReportImpl(params)
  if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Could not generate dental recall compliance report.')
  return res.data
}

// Phase 67 §9.1 item 19.3 (GP Clinic) — Walk-in vs. Appointment Ratio.
// TokenQueue (walk-ins) and Appointment (booked visits) are the two real,
// already-captured sources — confirmed via a grounding-check code read that
// TokenQueue.appointmentId is never actually set by the real "Add Walk-in"
// UI (TokenQueueScreen.tsx never passes it), so every TokenQueue row in
// practice IS a genuine walk-in, not a check-in for an existing booking.
// Counting Appointment separately (regardless of whether it happens to have
// a linked TokenQueue row) avoids any double-counting risk if that ever
// changes.
export interface WalkInVsAppointmentDayPoint { date: string; walkIns: number; appointments: number }
export interface WalkInVsAppointmentRatioReport {
  dateFrom: string; dateTo: string
  summary: { totalWalkIns: number; totalAppointments: number; walkInPercent: number }
  byDay: WalkInVsAppointmentDayPoint[]
}

async function generateWalkInVsAppointmentRatioReport(params: { dateFrom: string; dateTo: string }): Promise<WalkInVsAppointmentRatioReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const [walkIns, appointments] = await Promise.all([
    db.tokenQueue.findMany({ where: { queueDate: { gte: from, lte: to } }, select: { queueDate: true } }),
    db.appointment.findMany({ where: { scheduledDate: { gte: from, lte: to } }, select: { scheduledDate: true } }),
  ])

  const dayMap = new Map<string, WalkInVsAppointmentDayPoint>()
  for (const w of walkIns) {
    const day = toLocalISODate(w.queueDate)
    const existing = dayMap.get(day) ?? { date: day, walkIns: 0, appointments: 0 }
    existing.walkIns += 1
    dayMap.set(day, existing)
  }
  for (const a of appointments) {
    const day = toLocalISODate(a.scheduledDate)
    const existing = dayMap.get(day) ?? { date: day, walkIns: 0, appointments: 0 }
    existing.appointments += 1
    dayMap.set(day, existing)
  }
  const byDay = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  const totalWalkIns = walkIns.length
  const totalAppointments = appointments.length
  const totalEncounters = totalWalkIns + totalAppointments
  const walkInPercent = totalEncounters > 0 ? Math.round((totalWalkIns / totalEncounters) * 100) : 0

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: { totalWalkIns, totalAppointments, walkInPercent },
    byDay,
  }
}

// Phase 67 §9.1 item 19.4 (GP Clinic) — Diagnosis-Category Trend report.
// Grounding check confirmed `VisitNote.assessment` (the SOAP note's own
// diagnosis field) is unstructured free text with no existing categorization
// anywhere in the schema — the roadmap's own "if categorized" condition was
// false, so the new `VisitNote.diagnosisCategory` free-text tag field (added
// this same session) is what this report actually reads. `byMonth` is a
// pivoted/"wide" shape (one row per month, one column per category) so the
// renderer can draw one dynamic `<Line>` per category without a second query.
export interface DiagnosisCategoryTrendReport {
  dateFrom: string; dateTo: string
  summary: { totalVisits: number; categorizedCount: number; uncategorizedCount: number; distinctCategoryCount: number }
  categories: string[]
  byMonth: Record<string, number | string>[]
}

async function generateDiagnosisCategoryTrendReport(params: { dateFrom: string; dateTo: string }): Promise<DiagnosisCategoryTrendReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const notes = await db.visitNote.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { createdAt: true, diagnosisCategory: true },
  })

  let categorizedCount = 0
  const categorySet = new Set<string>()
  const monthMap = new Map<string, Map<string, number>>()

  for (const n of notes) {
    const month = groupLabel(n.createdAt, 'month')
    if (!monthMap.has(month)) monthMap.set(month, new Map())
    const category = n.diagnosisCategory?.trim() || null
    if (category) {
      categorizedCount += 1
      categorySet.add(category)
      const monthEntry = monthMap.get(month)!
      monthEntry.set(category, (monthEntry.get(category) ?? 0) + 1)
    }
  }

  const categories = Array.from(categorySet).sort()
  const byMonth = Array.from(monthMap.keys()).sort().map((month) => {
    const row: Record<string, number | string> = { month }
    const monthEntry = monthMap.get(month)!
    for (const category of categories) row[category] = monthEntry.get(category) ?? 0
    return row
  })

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      totalVisits: notes.length,
      categorizedCount,
      uncategorizedCount: notes.length - categorizedCount,
      distinctCategoryCount: categories.length,
    },
    categories, byMonth,
  }
}

// Phase 67 §9.1 item 19.5 (GP Clinic) — Referral-Out Tracking with Outcome
// Follow-up. Reads real in-app referrals (Appointment.referredFromVisitNoteId,
// Phase 54F) — the "outcome" is the referred-to provider's own finalized
// VisitNote.assessment, the same field `listReferralsForVisitNote()` now also
// surfaces inline on the referring note itself (one underlying fact, two
// callers). Gated by the `specialist_referral` module rather than a
// GP_CLINIC-only check, since SPECIALIST_CLINIC shares the exact same
// mechanism and data shape — not scope creep, just not artificially
// excluding a vertical the report already correctly applies to.
export interface ReferralOutcomeRow {
  appointmentNumber: string
  patientName: string
  referredToProviderName: string | null
  scheduledDate: string
  status: string
  outcomeSummary: string | null
}
export interface ReferralOutcomeReport {
  dateFrom: string; dateTo: string
  summary: { totalReferrals: number; completedCount: number; outcomeRecordedCount: number; pendingCount: number }
  rows: ReferralOutcomeRow[]
}

async function generateReferralOutcomeReport(params: { dateFrom: string; dateTo: string }): Promise<ReferralOutcomeReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const referrals = await db.appointment.findMany({
    where: { referredFromVisitNoteId: { not: null }, scheduledDate: { gte: from, lte: to } },
    select: {
      appointmentNumber: true, customerName: true, scheduledDate: true, status: true,
      provider: { select: { fullName: true } },
      visitNote: { select: { assessment: true, isFinalized: true } },
    },
    orderBy: { scheduledDate: 'desc' },
  })

  const rows: ReferralOutcomeRow[] = referrals.map((r) => ({
    appointmentNumber: r.appointmentNumber,
    patientName: r.customerName ?? 'Unknown',
    referredToProviderName: r.provider?.fullName ?? null,
    scheduledDate: toLocalISODate(r.scheduledDate),
    status: r.status,
    outcomeSummary: r.visitNote?.isFinalized ? r.visitNote.assessment : null,
  }))

  const completedCount = rows.filter((r) => r.status === 'COMPLETED').length
  const outcomeRecordedCount = rows.filter((r) => r.outcomeSummary).length
  const pendingCount = rows.filter((r) => r.status === 'SCHEDULED' || r.status === 'CONFIRMED').length

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: { totalReferrals: rows.length, completedCount, outcomeRecordedCount, pendingCount },
    rows,
  }
}

// Phase 67 §9.1 item 22.4 (Physio Clinic) — Pack Utilization report. Tagged
// in the roadmap as a literal shared-component candidate with Gym/Studio
// (both use the exact same ClientSessionPack model, Phase 27/41) — gated by
// the `session_packs` module rather than a single business type, matching
// this file's own established convention (e.g. Referral-Out Outcome above).
// Reads packs purchased in the date range, regardless of active/inactive
// status — a pack that got fully used up and deactivated is still real
// utilization history, not something to silently drop from the report.
export interface PackUtilizationRow {
  packId: string; customerName: string; packName: string
  totalSessions: number; usedSessions: number; remainingSessions: number
  utilizationPercent: number; expiryDate: string | null; isActive: boolean
}
export interface PackUtilizationReport {
  dateFrom: string; dateTo: string
  summary: { totalPacks: number; totalSessionsSold: number; totalSessionsUsed: number; overallUtilizationPercent: number }
  rows: PackUtilizationRow[]
}

async function generatePackUtilizationReport(params: { dateFrom: string; dateTo: string }): Promise<PackUtilizationReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const packs = await db.clientSessionPack.findMany({
    where: { purchaseDate: { gte: from, lte: to } },
    select: {
      id: true, packName: true, totalSessions: true, usedSessions: true, expiryDate: true, isActive: true,
      customer: { select: { customerName: true } },
    },
    orderBy: { totalSessions: 'desc' },
  })

  const rows: PackUtilizationRow[] = packs.map((p) => ({
    packId: p.id,
    customerName: p.customer.customerName,
    packName: p.packName,
    totalSessions: p.totalSessions,
    usedSessions: p.usedSessions,
    remainingSessions: Math.max(0, p.totalSessions - p.usedSessions),
    utilizationPercent: p.totalSessions > 0 ? Math.round((p.usedSessions / p.totalSessions) * 100) : 0,
    expiryDate: p.expiryDate ? toLocalISODate(p.expiryDate) : null,
    isActive: p.isActive,
  }))

  const totalSessionsSold = rows.reduce((sum, r) => sum + r.totalSessions, 0)
  const totalSessionsUsed = rows.reduce((sum, r) => sum + r.usedSessions, 0)
  const overallUtilizationPercent = totalSessionsSold > 0 ? Math.round((totalSessionsUsed / totalSessionsSold) * 100) : 0

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: { totalPacks: rows.length, totalSessionsSold, totalSessionsUsed, overallUtilizationPercent },
    rows,
  }
}

// Phase 67 §9.1 item 23.1 (Diagnostic Lab) — Per-test TAT target vs. actual.
// Actual TAT is measured from the ORDER's own sampleCollectedAt (the one
// recorded collection moment for the whole visit — items ordered together
// are collected together) to each ITEM's own resultReadyAt (Phase 67 §9.1,
// set exactly once by updateTestResult(), see schema comment). Only items
// with BOTH timestamps present are counted at all; only items that also
// carry a targetTATHours snapshot count toward on-time/late, since there's
// nothing to compare against otherwise.
export interface LabTATRow {
  testName: string
  category: string | null
  ordersCount: number
  avgActualTATHours: number
  targetTATHours: number | null
  onTimeCount: number
  lateCount: number
  onTimePercent: number
}
export interface LabTATReport {
  dateFrom: string; dateTo: string
  summary: { totalCompleted: number; withTargetCount: number; onTimeCount: number; overallOnTimePercent: number }
  rows: LabTATRow[]
}

async function generateLabTATReport(params: { dateFrom: string; dateTo: string }): Promise<LabTATReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const items = await db.labTestOrderItem.findMany({
    where: { resultReadyAt: { gte: from, lte: to } },
    select: {
      testName: true, category: true, targetTATHours: true, resultReadyAt: true,
      labTestOrder: { select: { sampleCollectedAt: true } },
    },
  })

  const byTest = new Map<string, { category: string | null; targetTATHours: number | null; actualHours: number[]; onTime: number; late: number }>()
  for (const item of items) {
    if (!item.labTestOrder.sampleCollectedAt || !item.resultReadyAt) continue
    const actualHours = (item.resultReadyAt.getTime() - item.labTestOrder.sampleCollectedAt.getTime()) / (1000 * 60 * 60)
    if (!byTest.has(item.testName)) byTest.set(item.testName, { category: item.category, targetTATHours: item.targetTATHours, actualHours: [], onTime: 0, late: 0 })
    const bucket = byTest.get(item.testName)!
    bucket.actualHours.push(actualHours)
    if (item.targetTATHours != null) {
      if (actualHours <= item.targetTATHours) bucket.onTime++
      else bucket.late++
    }
  }

  const rows: LabTATRow[] = [...byTest.entries()]
    .map(([testName, b]) => {
      const withTarget = b.onTime + b.late
      return {
        testName,
        category: b.category,
        ordersCount: b.actualHours.length,
        avgActualTATHours: b.actualHours.length > 0 ? Math.round((b.actualHours.reduce((s, v) => s + v, 0) / b.actualHours.length) * 10) / 10 : 0,
        targetTATHours: b.targetTATHours,
        onTimeCount: b.onTime,
        lateCount: b.late,
        onTimePercent: withTarget > 0 ? Math.round((b.onTime / withTarget) * 100) : 0,
      }
    })
    .sort((a, b) => b.ordersCount - a.ordersCount)

  const withTargetCount = rows.reduce((s, r) => s + r.onTimeCount + r.lateCount, 0)
  const onTimeCount = rows.reduce((s, r) => s + r.onTimeCount, 0)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      totalCompleted: items.length,
      withTargetCount,
      onTimeCount,
      overallOnTimePercent: withTargetCount > 0 ? Math.round((onTimeCount / withTargetCount) * 100) : 0,
    },
    rows,
  }
}

// Phase 67 §9.1 item 23.4 (Diagnostic Lab) — Test volume by panel report.
// Pivots into a month × panel "wide" table using the same groupLabel()
// helper and dynamic-category shape as generateDiagnosisCategoryTrendReport
// above (categories/panels are free text per install, so the series count
// isn't known ahead of time) — same established pattern, different vertical.
export interface TestVolumeByPanelReport {
  dateFrom: string; dateTo: string
  summary: { totalTests: number; distinctPanelCount: number }
  panels: string[]
  byMonth: Record<string, number | string>[]
}

async function generateTestVolumeByPanelReport(params: { dateFrom: string; dateTo: string }): Promise<TestVolumeByPanelReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const items = await db.labTestOrderItem.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { category: true, createdAt: true },
  })

  const panelSet = new Set<string>()
  const monthMap = new Map<string, Map<string, number>>()
  for (const item of items) {
    const panel = item.category?.trim() || 'Uncategorized'
    panelSet.add(panel)
    const month = groupLabel(item.createdAt, 'month')
    if (!monthMap.has(month)) monthMap.set(month, new Map())
    const m = monthMap.get(month)!
    m.set(panel, (m.get(panel) ?? 0) + 1)
  }

  const panels = [...panelSet].sort()
  const byMonth = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, counts]) => {
      const row: Record<string, number | string> = { month }
      for (const p of panels) row[p] = counts.get(p) ?? 0
      return row
    })

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: { totalTests: items.length, distinctPanelCount: panels.length },
    panels, byMonth,
  }
}

// Phase 67 §9.1 item 23.5 (Diagnostic Lab) + item 20.1 (Specialist Clinic) —
// Referral leaderboard. Roadmap tags item 23.5 as "literally the same
// mechanism ... build once, apply to both", which is true of the REPORT
// SHAPE and its UI/AI-intent surface — but the two verticals' underlying
// referral data is NOT identically shaped (Specialist's is
// VisitNote.referredBy, free text; Lab's is LabTestOrder.referredByProviderId,
// a real Employee FK), so honestly "build once" here means one shared
// ranking helper + one shared report/view/AI-intent, fed by two small
// per-vertical queries — not one literal query reused verbatim, unlike Pack
// Utilization/Referral-Out Outcome above where the source table really was
// identical. `businessType` is passed explicitly by the caller (the same
// convention dashboard-spotlight.service.ts already uses), since a Sarang
// install is always exactly one business type at a time.
export interface ReferralLeaderboardRow { referrerName: string; count: number }
export interface ReferralLeaderboardReport {
  dateFrom: string; dateTo: string
  summary: { totalReferrals: number; distinctReferrerCount: number; topReferrerName: string | null }
  rows: ReferralLeaderboardRow[]
}

function rankReferrers(names: Array<string | null | undefined>): ReferralLeaderboardReport {
  const counts = new Map<string, number>()
  for (const raw of names) {
    const name = raw?.trim()
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  const rows: ReferralLeaderboardRow[] = [...counts.entries()]
    .map(([referrerName, count]) => ({ referrerName, count }))
    .sort((a, b) => b.count - a.count)
  return {
    dateFrom: '', dateTo: '',
    summary: { totalReferrals: rows.reduce((s, r) => s + r.count, 0), distinctReferrerCount: rows.length, topReferrerName: rows[0]?.referrerName ?? null },
    rows,
  }
}

async function generateReferralLeaderboardReport(params: { dateFrom: string; dateTo: string; businessType: string }): Promise<ReferralLeaderboardReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  let names: Array<string | null | undefined>
  if (params.businessType === 'DIAGNOSTIC_LAB') {
    const orders = await db.labTestOrder.findMany({
      where: { createdAt: { gte: from, lte: to } },
      select: { referredByProvider: { select: { fullName: true } } },
    })
    names = orders.map((o) => o.referredByProvider?.fullName)
  } else {
    const notes = await db.visitNote.findMany({
      where: { referredBy: { not: null }, appointment: { scheduledDate: { gte: from, lte: to } } },
      select: { referredBy: true },
    })
    names = notes.map((n) => n.referredBy)
  }

  const ranked = rankReferrers(names)
  return { ...ranked, dateFrom: params.dateFrom, dateTo: params.dateTo }
}

// Phase 67 §9.1 item 20.2 — Specialist Clinic: Second-Opinion Conversion.
// "Conversion" here means the patient went on to book a LATER completed
// appointment after their second-opinion visit — i.e. became an ongoing
// patient rather than a one-off. Only patients linked to a real Customer
// record can be tracked this way (a walk-in with no customerId has no
// identity to match a later visit against), same limitation this app's
// other cross-visit patient-history features already accept.
export interface SecondOpinionConversionRow {
  patientName: string
  visitDate: string
  converted: boolean
  nextVisitDate: string | null
}
export interface SecondOpinionConversionReport {
  dateFrom: string; dateTo: string
  summary: { totalSecondOpinionVisits: number; convertedCount: number; conversionPercent: number | null; distinctPatientCount: number }
  rows: SecondOpinionConversionRow[]
}

async function generateSecondOpinionConversionReport(params: { dateFrom: string; dateTo: string }): Promise<SecondOpinionConversionReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const notes = await db.visitNote.findMany({
    where: { isSecondOpinion: true, appointment: { scheduledDate: { gte: from, lte: to } } },
    select: { patientName: true, appointment: { select: { customerId: true, scheduledDate: true } } },
    orderBy: { appointment: { scheduledDate: 'asc' } },
  })
  const trackable = notes.filter((n) => n.appointment?.customerId)

  const rows: SecondOpinionConversionRow[] = []
  let convertedCount = 0
  const patientSet = new Set<string>()
  for (const n of trackable) {
    const customerId = n.appointment!.customerId!
    const visitDate = n.appointment!.scheduledDate
    patientSet.add(customerId)
    const nextAppointment = await db.appointment.findFirst({
      where: { customerId, status: 'COMPLETED', scheduledDate: { gt: visitDate } },
      orderBy: { scheduledDate: 'asc' },
      select: { scheduledDate: true },
    })
    if (nextAppointment) convertedCount++
    rows.push({
      patientName: n.patientName,
      visitDate: toLocalISODate(visitDate),
      converted: !!nextAppointment,
      nextVisitDate: nextAppointment ? toLocalISODate(nextAppointment.scheduledDate) : null,
    })
  }

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      totalSecondOpinionVisits: trackable.length,
      convertedCount,
      conversionPercent: trackable.length > 0 ? Math.round((convertedCount / trackable.length) * 100) : null,
      distinctPatientCount: patientSet.size,
    },
    rows,
  }
}

// Phase 67 §9.1 item 20.3 — Specialist Clinic: Case-Complexity Mix report.
// Only notes with a real `caseComplexity` tag are counted — an untagged
// note isn't assumed Routine, it's simply excluded, same "only count what's
// genuinely comparable" precedent as the chronic-recall and vaccination
// compliance reports above. Month pivot via the same `groupLabel()` pattern
// generateVetCaseTypeVolumeReport/generateTestVolumeByPanelReport use.
export interface CaseComplexityMixReport {
  dateFrom: string; dateTo: string
  summary: { totalTagged: number; routineCount: number; complexCount: number; complexPercent: number | null }
  byMonth: Array<{ month: string; ROUTINE: number; COMPLEX: number }>
}

async function generateCaseComplexityMixReport(params: { dateFrom: string; dateTo: string }): Promise<CaseComplexityMixReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const notes = await db.visitNote.findMany({
    where: { caseComplexity: { in: ['ROUTINE', 'COMPLEX'] }, appointment: { scheduledDate: { gte: from, lte: to } } },
    select: { caseComplexity: true, appointment: { select: { scheduledDate: true } } },
  })

  const monthMap = new Map<string, { ROUTINE: number; COMPLEX: number }>()
  let routineCount = 0
  let complexCount = 0
  for (const n of notes) {
    const complexity = n.caseComplexity as 'ROUTINE' | 'COMPLEX'
    if (complexity === 'ROUTINE') routineCount++
    else complexCount++
    const month = groupLabel(n.appointment!.scheduledDate, 'month')
    const entry = monthMap.get(month) ?? { ROUTINE: 0, COMPLEX: 0 }
    entry[complexity]++
    monthMap.set(month, entry)
  }

  const byMonth = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, counts]) => ({ month, ...counts }))

  const totalTagged = routineCount + complexCount
  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      totalTagged, routineCount, complexCount,
      complexPercent: totalTagged > 0 ? Math.round((complexCount / totalTagged) * 100) : null,
    },
    byMonth,
  }
}

// Phase 67 §9.1 item 21.2 — Dental Clinic: Treatment Acceptance Rate report
// (funnel chart). Depends on item 21.1's TreatmentPlan.invoiceId — a
// 3-stage funnel: every plan proposed in the range, how many were accepted
// (ACCEPTED/IN_PROGRESS/COMPLETED — genuinely moved past PROPOSED/DECLINED),
// and how many of THOSE were actually billed (invoiceId set). This is a
// funnel of the SAME cohort narrowing at each stage, not three independent
// counts, so billedCount is always <= acceptedCount <= proposedCount.
export interface TreatmentAcceptanceRateReport {
  dateFrom: string; dateTo: string
  summary: { proposedCount: number; acceptedCount: number; billedCount: number; acceptanceRatePercent: number | null; billedRatePercent: number | null }
  funnel: Array<{ stage: string; count: number }>
}

async function generateTreatmentAcceptanceRateReport(params: { dateFrom: string; dateTo: string }): Promise<TreatmentAcceptanceRateReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const plans = await db.treatmentPlan.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { status: true, invoiceId: true },
  })

  const proposedCount = plans.length
  const acceptedPlans = plans.filter((p) => p.status !== 'PROPOSED' && p.status !== 'DECLINED')
  const acceptedCount = acceptedPlans.length
  const billedCount = acceptedPlans.filter((p) => !!p.invoiceId).length

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      proposedCount, acceptedCount, billedCount,
      acceptanceRatePercent: proposedCount > 0 ? Math.round((acceptedCount / proposedCount) * 100) : null,
      billedRatePercent: proposedCount > 0 ? Math.round((billedCount / proposedCount) * 100) : null,
    },
    funnel: [
      { stage: 'Proposed', count: proposedCount },
      { stage: 'Accepted', count: acceptedCount },
      { stage: 'Billed', count: billedCount },
    ],
  }
}

// Phase 67 §9.1 item 18.2 (Vet Clinic) — Vaccination compliance report. A
// genuinely different question from the Dashboard's own `vaccination`
// spotlight card (dashboard-spotlight.service.ts): that card is a live "is
// anything overdue right now" snapshot; this is a historical, date-ranged
// report — of the follow-up doses actually GIVEN in this period, how many
// were given on or before the due date the PRIOR dose in that same
// pet+vaccine series set. A pet's first-ever dose of a vaccine has no prior
// due date to compare against, so it's excluded from on-time/late counting
// entirely, not counted as either — same "only count what's genuinely
// comparable" precedent as GP's own chronic-recall compliance report
// (item 19.2). No new schema needed: `VaccinationRecord` is already an
// append-only per-dose history, so a prior dose's own `nextDueDate` is
// already there to compare the next dose against.
export interface VaccinationComplianceByVaccine { vaccineName: string; total: number; onTime: number; percent: number }
export interface VaccinationComplianceReport {
  dateFrom: string; dateTo: string
  totalDosesEvaluated: number; overallOnTime: number; overallPercent: number | null
  byVaccine: VaccinationComplianceByVaccine[]
}

async function generateVaccinationComplianceReport(params: { dateFrom: string; dateTo: string }): Promise<VaccinationComplianceReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const dosesInRange = await db.vaccinationRecord.findMany({
    where: { administeredAt: { gte: from, lte: to } },
    select: { petId: true, vaccineName: true, administeredAt: true },
  })

  const evaluated: Array<{ vaccineName: string; onTime: boolean }> = []
  for (const dose of dosesInRange) {
    const prior = await db.vaccinationRecord.findFirst({
      where: { petId: dose.petId, vaccineName: dose.vaccineName, administeredAt: { lt: dose.administeredAt } },
      orderBy: { administeredAt: 'desc' },
      select: { nextDueDate: true },
    })
    if (!prior || !prior.nextDueDate) continue
    evaluated.push({ vaccineName: dose.vaccineName, onTime: dose.administeredAt <= prior.nextDueDate })
  }

  const overallOnTime = evaluated.filter((e) => e.onTime).length
  const overallPercent = evaluated.length > 0 ? Math.round((overallOnTime / evaluated.length) * 100) : null

  const byVaccineMap = new Map<string, { total: number; onTime: number }>()
  for (const e of evaluated) {
    const entry = byVaccineMap.get(e.vaccineName) ?? { total: 0, onTime: 0 }
    entry.total++
    if (e.onTime) entry.onTime++
    byVaccineMap.set(e.vaccineName, entry)
  }
  const byVaccine: VaccinationComplianceByVaccine[] = Array.from(byVaccineMap.entries())
    .map(([vaccineName, v]) => ({ vaccineName, total: v.total, onTime: v.onTime, percent: v.total > 0 ? Math.round((v.onTime / v.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    totalDosesEvaluated: evaluated.length, overallOnTime, overallPercent,
    byVaccine,
  }
}

// Phase 67 §9.1 item 18.4 (Vet Clinic) — Case-Type Volume Trend report. The
// item's own spec names "surgeries/consults/vaccinations" as example case
// types, but grounding found no dedicated case-type field or Surgery
// category in this codebase's own seed data — real case types come from
// whatever categories a clinic's own Service Catalog actually has (via
// Appointment.serviceCatalogId), same dynamic-category convention as
// generateDiagnosisCategoryTrendReport (item 19.4) and
// generateTestVolumeByPanelReport (item 23.4). Vaccinations get their own
// dedicated series sourced from VaccinationRecord directly — a real
// administered dose, not merely a booked appointment — since that's the
// authoritative source of "a vaccination actually happened," the same
// reasoning behind item 18.2's own compliance report. Only pet-linked,
// non-cancelled appointments count as a real "case."
export interface VetCaseTypeVolumeReport {
  dateFrom: string; dateTo: string
  summary: { totalCases: number; distinctCaseTypeCount: number }
  caseTypes: string[]
  byMonth: Record<string, number | string>[]
}

async function generateVetCaseTypeVolumeReport(params: { dateFrom: string; dateTo: string }): Promise<VetCaseTypeVolumeReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const [appointments, vaccinations] = await Promise.all([
    db.appointment.findMany({
      where: { scheduledDate: { gte: from, lte: to }, petId: { not: null }, status: { not: 'CANCELLED' } },
      select: { scheduledDate: true, serviceCatalog: { select: { category: true } } },
    }),
    db.vaccinationRecord.findMany({
      where: { administeredAt: { gte: from, lte: to } },
      select: { administeredAt: true },
    }),
  ])

  const caseTypeSet = new Set<string>()
  const monthMap = new Map<string, Map<string, number>>()
  for (const appt of appointments) {
    const caseType = appt.serviceCatalog?.category?.trim() || 'Other'
    caseTypeSet.add(caseType)
    const month = groupLabel(appt.scheduledDate, 'month')
    if (!monthMap.has(month)) monthMap.set(month, new Map())
    const m = monthMap.get(month)!
    m.set(caseType, (m.get(caseType) ?? 0) + 1)
  }
  if (vaccinations.length > 0) caseTypeSet.add('Vaccinations')
  for (const vac of vaccinations) {
    const month = groupLabel(vac.administeredAt, 'month')
    if (!monthMap.has(month)) monthMap.set(month, new Map())
    const m = monthMap.get(month)!
    m.set('Vaccinations', (m.get('Vaccinations') ?? 0) + 1)
  }

  const caseTypes = [...caseTypeSet].sort()
  const byMonth = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, counts]) => {
      const row: Record<string, number | string> = { month }
      for (const c of caseTypes) row[c] = counts.get(c) ?? 0
      return row
    })

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: { totalCases: appointments.length + vaccinations.length, distinctCaseTypeCount: caseTypes.length },
    caseTypes, byMonth,
  }
}

async function generateSchemeCostVsVolumeReport(params: { dateFrom: string; dateTo: string }): Promise<SchemeCostVsVolumeReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  // Schemes that overlapped this window at all (not just currently-active
  // ones) — a report looking back at last month should still show a scheme
  // that has since ended.
  const schemes = await db.pricingScheme.findMany({
    where: {
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: to } }] },
        { OR: [{ endDate: null }, { endDate: { gte: from } }] },
      ],
    },
    include: { category: { select: { products: { select: { id: true } } } } },
  })

  const coveredProductIds = new Set<string>()
  for (const s of schemes) {
    if (s.productId) coveredProductIds.add(s.productId)
    for (const p of s.category?.products ?? []) coveredProductIds.add(p.id)
  }
  const coveredIdsArr = [...coveredProductIds]

  // Total volume (paid + FOC) of every scheme-covered product in range,
  // regardless of whether a given line actually carried a schemeId — this is
  // the "did the covered product sell more" half of the correlation.
  const volumeItems = coveredIdsArr.length > 0
    ? await db.invoiceItem.findMany({
        where: { productId: { in: coveredIdsArr }, invoice: { invoiceDate: { gte: from, lte: to }, status: { not: 'CANCELLED' } } },
        select: { quantity: true, invoice: { select: { invoiceDate: true } } },
      })
    : []

  // Scheme-tagged lines only, for the cost half — FOC lines valued at each
  // product's current cost basis (getProductCostsBatch, the same
  // valuation-method-aware selector Phase 64 formalized), slab-discount
  // lines valued at their own real discountAmount. Current cost basis is a
  // documented simplification (no historical-cost-at-sale-date lookup, same
  // "computed at current cost, framed as such" precedent Phase 63's own
  // pricing.schemeCostThisMonth AI intent already established for FOC lines).
  const schemeItems = await db.invoiceItem.findMany({
    where: { schemeId: { not: null }, invoice: { invoiceDate: { gte: from, lte: to }, status: { not: 'CANCELLED' } } },
    select: {
      productId: true, quantity: true, isFreeOfCost: true, discountAmount: true, schemeId: true,
      invoice: { select: { invoiceDate: true } }, scheme: { select: { name: true, ruleType: true } },
    },
  })
  const focProductIds = [...new Set(schemeItems.filter(i => i.isFreeOfCost).map(i => i.productId))]
  const costBasisByProduct = await getProductCostsBatch(focProductIds)

  const periodMap = new Map<string, { schemeCost: number; totalVolume: number }>()
  for (const item of volumeItems) {
    const key = weekStartKey(item.invoice.invoiceDate)
    const p = periodMap.get(key) ?? { schemeCost: 0, totalVolume: 0 }
    p.totalVolume += item.quantity
    periodMap.set(key, p)
  }

  let totalSchemeCost = 0
  let totalFocUnitsGiven = 0
  const bySchemeMap = new Map<string, SchemeCostVsVolumeSchemeRow>()
  for (const item of schemeItems) {
    const cost = item.isFreeOfCost ? item.quantity * (costBasisByProduct.get(item.productId) ?? 0) : item.discountAmount
    const key = weekStartKey(item.invoice.invoiceDate)
    const p = periodMap.get(key) ?? { schemeCost: 0, totalVolume: 0 }
    p.schemeCost += cost
    periodMap.set(key, p)
    totalSchemeCost += cost
    if (item.isFreeOfCost) totalFocUnitsGiven += item.quantity

    const sid = item.schemeId as string
    const row = bySchemeMap.get(sid) ?? { schemeId: sid, schemeName: item.scheme?.name ?? '—', ruleType: item.scheme?.ruleType ?? '', totalCost: 0, focUnitsGiven: 0 }
    row.totalCost += cost
    if (item.isFreeOfCost) row.focUnitsGiven += item.quantity
    bySchemeMap.set(sid, row)
  }

  const byPeriod: SchemeCostVsVolumePoint[] = Array.from(periodMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, v]) => ({ period, schemeCost: roundCurrency(v.schemeCost), totalVolume: v.totalVolume }))

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo,
    summary: {
      totalSchemeCost: roundCurrency(totalSchemeCost),
      totalFocUnitsGiven,
      activeSchemeCount: schemes.filter(s => s.isActive).length,
      coveredProductCount: coveredProductIds.size,
    },
    byPeriod,
    rows: Array.from(bySchemeMap.values()).map(r => ({ ...r, totalCost: roundCurrency(r.totalCost) })).sort((a, b) => b.totalCost - a.totalCost),
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Phase 68 §9.1 — Beauty Salon items 1/2: stylist-wise repeat-client
// tracking + repeat-rate, in one function (the per-stylist repeat-client
// list IS the drill-down behind each row's own rate). "Repeat" is judged
// PER STYLIST, not per-salon — a client who always books the same stylist
// twice counts once for that stylist, distinct from the salon's OWN overall
// repeat-customer concept (which doesn't care who performed the service).
// Sorted best-first (highest repeat rate) — a leaderboard celebrating which
// stylists build real client loyalty, same convention as Distributor's own
// Field-Rep Leaderboard, not this phase's usual worst-first problem list.
// ─────────────────────────────────────────────────────────────────────────────

export interface StylistRepeatClientRow {
  providerName: string; totalClients: number; repeatClients: number; repeatRatePercent: number
}
export interface StylistRepeatClientReport {
  dateFrom: string; dateTo: string
  rows: StylistRepeatClientRow[]
  summary: { totalStylists: number; overallRepeatRatePercent: number }
}

async function generateStylistRepeatClientReport(params: { dateFrom: string; dateTo: string }): Promise<StylistRepeatClientReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const appts = await db.appointment.findMany({
    where: { status: 'COMPLETED', customerId: { not: null }, providerId: { not: null }, scheduledDate: { gte: from, lte: to } },
    select: { providerId: true, customerId: true, provider: { select: { fullName: true } } },
  })

  const byProvider = new Map<string, { providerName: string; customerCounts: Map<string, number> }>()
  for (const a of appts) {
    const providerId = a.providerId!
    const entry = byProvider.get(providerId) ?? { providerName: a.provider?.fullName ?? 'Unassigned', customerCounts: new Map<string, number>() }
    const cid = a.customerId!
    entry.customerCounts.set(cid, (entry.customerCounts.get(cid) ?? 0) + 1)
    byProvider.set(providerId, entry)
  }

  const round1 = (n: number) => Math.round(n * 10) / 10
  const rows: StylistRepeatClientRow[] = Array.from(byProvider.values()).map((p) => {
    const totalClients = p.customerCounts.size
    const repeatClients = Array.from(p.customerCounts.values()).filter((c) => c >= 2).length
    return {
      providerName: p.providerName, totalClients, repeatClients,
      repeatRatePercent: totalClients > 0 ? round1((repeatClients / totalClients) * 100) : 0,
    }
  }).sort((a, b) => b.repeatRatePercent - a.repeatRatePercent)

  const totalClientsAll = rows.reduce((s, r) => s + r.totalClients, 0)
  const totalRepeatAll = rows.reduce((s, r) => s + r.repeatClients, 0)
  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, rows,
    summary: { totalStylists: rows.length, overallRepeatRatePercent: totalClientsAll > 0 ? round1((totalRepeatAll / totalClientsAll) * 100) : 0 },
  }
}

// Phase 68 §9.1 — Beauty Salon items 3/4: retail-product attach at checkout
// (the FEATURE already shipped in Phase 58 §2 as generateAppointmentInvoice's
// own `retailItems` option — resolveRetailInvoiceItems in
// appointment.service.ts) — this closes the missing REPORT half, measuring
// how often staff actually use it. An "attach" is any appointment-generated
// invoice whose items include at least one line where the underlying
// Product is NOT the synthetic SERVICE-type placeholder
// findOrCreateServiceCatalogProduct creates (a real retail Product, i.e.
// productType !== 'SERVICE') — the same distinction that mechanism itself
// already encodes, not a new convention invented here.
export interface RetailAttachRateByProviderRow { providerName: string; totalInvoices: number; withAttach: number; attachRatePercent: number }
export interface RetailAttachRateReport {
  dateFrom: string; dateTo: string
  byProvider: RetailAttachRateByProviderRow[]
  summary: { totalAppointmentInvoices: number; withRetailAttach: number; attachRatePercent: number }
}

async function generateRetailAttachRateReport(params: { dateFrom: string; dateTo: string }): Promise<RetailAttachRateReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const appts = await db.appointment.findMany({
    where: { status: 'COMPLETED', invoiceId: { not: null }, scheduledDate: { gte: from, lte: to } },
    select: { providerId: true, invoiceId: true, provider: { select: { fullName: true } } },
  })
  // Appointment.invoiceId is an unenforced FK (the atomic claim-sentinel
  // pattern generateAppointmentInvoice uses, same as every other
  // claim-then-invoice flow in this codebase) — no Prisma relation exists,
  // so the invoice+items lookup is a separate query, joined here in JS.
  const invoiceIds = appts.map((a) => a.invoiceId).filter((id): id is string => !!id)
  const invoices = invoiceIds.length
    ? await db.invoice.findMany({ where: { id: { in: invoiceIds } }, select: { id: true, items: { select: { product: { select: { productType: true } } } } } })
    : []
  const invoiceById = new Map(invoices.map((inv) => [inv.id, inv]))

  const round1 = (n: number) => Math.round(n * 10) / 10
  const byProviderMap = new Map<string, { providerName: string; total: number; withAttach: number }>()
  let totalWithAttach = 0
  let totalAppointmentInvoices = 0
  for (const a of appts) {
    const invoice = a.invoiceId ? invoiceById.get(a.invoiceId) : undefined
    if (!invoice) continue
    totalAppointmentInvoices++
    const hasRetailLine = invoice.items.some((i) => i.product?.productType !== 'SERVICE')
    if (hasRetailLine) totalWithAttach++
    const key = a.providerId ?? 'unassigned'
    const entry = byProviderMap.get(key) ?? { providerName: a.provider?.fullName ?? 'Unassigned', total: 0, withAttach: 0 }
    entry.total += 1
    if (hasRetailLine) entry.withAttach += 1
    byProviderMap.set(key, entry)
  }

  const byProvider: RetailAttachRateByProviderRow[] = Array.from(byProviderMap.values())
    .map((p) => ({ providerName: p.providerName, totalInvoices: p.total, withAttach: p.withAttach, attachRatePercent: p.total > 0 ? round1((p.withAttach / p.total) * 100) : 0 }))
    .sort((a, b) => b.attachRatePercent - a.attachRatePercent)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, byProvider,
    summary: {
      totalAppointmentInvoices, withRetailAttach: totalWithAttach,
      attachRatePercent: totalAppointmentInvoices > 0 ? round1((totalWithAttach / totalAppointmentInvoices) * 100) : 0,
    },
  }
}

// Phase 68 §9.1 — Driving School item 4: Learner Progress Funnel. A
// CURRENT-STATE snapshot across every learner ever enrolled (no date range —
// a funnel counts stage reach, not a trend over time, same reasoning
// generateSizeAvailabilityHeatmapReport's own current-state stock snapshot
// already established). Each stage is cumulative-distinct-learner-count,
// strictly monotonically non-increasing by construction (a learner counted
// at a later stage necessarily has a LearnerProfile row too).
export interface LearnerProgressFunnelStage { stage: string; learnerCount: number }
export interface LearnerProgressFunnelReport {
  stages: LearnerProgressFunnelStage[]
  summary: { totalEnrolled: number; dlPassedCount: number; overallCompletionPercent: number }
}

async function generateLearnerProgressFunnelReport(): Promise<LearnerProgressFunnelReport> {
  const db = getPrisma()

  const [profiles, sessions, tests] = await Promise.all([
    db.learnerProfile.findMany({ select: { customerId: true } }),
    db.drivingSession.findMany({ select: { learnerId: true }, distinct: ['learnerId'] }),
    db.drivingTest.findMany({ select: { learnerId: true, testType: true, result: true } }),
  ])

  const enrolledIds = new Set(profiles.map((p) => p.customerId))
  const sessionsStartedIds = new Set(sessions.map((s) => s.learnerId).filter((id) => enrolledIds.has(id)))
  const llTakenIds = new Set(tests.filter((t) => t.testType === 'LL_TEST').map((t) => t.learnerId))
  const llPassedIds = new Set(tests.filter((t) => t.testType === 'LL_TEST' && t.result === 'PASSED').map((t) => t.learnerId))
  const dlPassedIds = new Set(tests.filter((t) => t.testType === 'DL_TEST' && t.result === 'PASSED').map((t) => t.learnerId))

  const stages: LearnerProgressFunnelStage[] = [
    { stage: 'Enrolled', learnerCount: enrolledIds.size },
    { stage: 'Sessions Started', learnerCount: sessionsStartedIds.size },
    { stage: 'LL Test Taken', learnerCount: llTakenIds.size },
    { stage: 'LL Test Passed', learnerCount: llPassedIds.size },
    { stage: 'DL Test Passed', learnerCount: dlPassedIds.size },
  ]

  const round1 = (n: number) => Math.round(n * 10) / 10
  return {
    stages,
    summary: {
      totalEnrolled: enrolledIds.size, dlPassedCount: dlPassedIds.size,
      overallCompletionPercent: enrolledIds.size > 0 ? round1((dlPassedIds.size / enrolledIds.size) * 100) : 0,
    },
  }
}

// Phase 68 §9.1 — Lawyer item 4: Case Aging. A live current-state worklist
// (no date range — same "current-state, not a trend" reasoning every other
// aging-style report in this phase already uses) — every non-CLOSED/
// DISPOSED case, ranked by days stuck in its CURRENT stage
// (LegalCase.caseStageUpdatedAt), worst-first. Distinct from days-since-
// filing (also shown, but not the sort key) — a case can be old overall yet
// moving fine, or young overall yet badly stalled in one stage; the stage-
// aging number is the real "needs attention" signal.
export interface CaseAgingRow {
  caseId: string; caseNumber: string; caseTitle: string; clientName: string
  caseStage: string; daysInCurrentStage: number; daysSinceFiling: number | null
}
export interface CaseAgingReport {
  rows: CaseAgingRow[]
  summary: { totalOpenCases: number; avgDaysInCurrentStage: number; staleCaseCount: number }
}

async function generateCaseAgingReport(): Promise<CaseAgingReport> {
  const db = getPrisma()
  const now = new Date()
  const STALE_THRESHOLD_DAYS = 90

  const cases = await db.legalCase.findMany({
    where: { status: { notIn: ['CLOSED', 'DISPOSED'] } },
    select: {
      id: true, caseNumber: true, caseTitle: true, caseStage: true, caseStageUpdatedAt: true, filingDate: true,
      client: { select: { customerName: true } },
    },
  })

  const round1 = (n: number) => Math.round(n * 10) / 10
  const rows: CaseAgingRow[] = cases.map((c) => ({
    caseId: c.id, caseNumber: c.caseNumber, caseTitle: c.caseTitle, clientName: c.client.customerName,
    caseStage: c.caseStage,
    daysInCurrentStage: Math.floor((now.getTime() - c.caseStageUpdatedAt.getTime()) / 86400000),
    daysSinceFiling: c.filingDate ? Math.floor((now.getTime() - c.filingDate.getTime()) / 86400000) : null,
  })).sort((a, b) => b.daysInCurrentStage - a.daysInCurrentStage)

  const avgDaysInCurrentStage = rows.length > 0 ? round1(rows.reduce((s, r) => s + r.daysInCurrentStage, 0) / rows.length) : 0
  return {
    rows,
    summary: { totalOpenCases: rows.length, avgDaysInCurrentStage, staleCaseCount: rows.filter((r) => r.daysInCurrentStage >= STALE_THRESHOLD_DAYS).length },
  }
}

// Phase 68 §9.1 — Lawyer item 2: Billable Hours. TimeEntry rows linked to a
// LegalCase specifically (caseId not null — the same field that
// distinguishes a Lawyer time entry from a CA/Architect/Consultant one
// logged against the generic ServiceProject instead), grouped by advocate.
// "Billable" here means ratePerHour > 0 — a genuinely pro-bono/non-
// chargeable entry logged at a 0 rate is real hours worked but never
// billable revenue, so it's counted separately rather than inflating the
// billable total.
export interface LawyerBillableHoursRow {
  advocateName: string; billableHours: number; nonBillableHours: number
  billableAmount: number; billedAmount: number; unbilledAmount: number
}
export interface LawyerBillableHoursReport {
  dateFrom: string; dateTo: string
  rows: LawyerBillableHoursRow[]
  summary: { totalBillableHours: number; totalBillableAmount: number; totalUnbilledAmount: number }
}

async function generateLawyerBillableHoursReport(params: { dateFrom: string; dateTo: string }): Promise<LawyerBillableHoursReport> {
  const db = getPrisma()
  const from = toDate(params.dateFrom)
  const to = toDateEnd(params.dateTo)

  const entries = await db.timeEntry.findMany({
    where: { caseId: { not: null }, date: { gte: from, lte: to } },
    select: { hours: true, ratePerHour: true, amount: true, isBilled: true, employee: { select: { fullName: true } } },
  })

  const round1 = (n: number) => Math.round(n * 10) / 10
  const byAdvocate = new Map<string, { billableHours: number; nonBillableHours: number; billableAmount: number; billedAmount: number; unbilledAmount: number }>()
  for (const e of entries) {
    const key = e.employee?.fullName ?? 'Unassigned'
    const entry = byAdvocate.get(key) ?? { billableHours: 0, nonBillableHours: 0, billableAmount: 0, billedAmount: 0, unbilledAmount: 0 }
    const hours = Number(e.hours)
    const amount = Number(e.amount)
    if (Number(e.ratePerHour) > 0) {
      entry.billableHours += hours
      entry.billableAmount += amount
      if (e.isBilled) entry.billedAmount += amount
      else entry.unbilledAmount += amount
    } else {
      entry.nonBillableHours += hours
    }
    byAdvocate.set(key, entry)
  }

  const rows: LawyerBillableHoursRow[] = Array.from(byAdvocate.entries())
    .map(([advocateName, v]) => ({
      advocateName, billableHours: round1(v.billableHours), nonBillableHours: round1(v.nonBillableHours),
      billableAmount: roundCurrency(v.billableAmount), billedAmount: roundCurrency(v.billedAmount), unbilledAmount: roundCurrency(v.unbilledAmount),
    }))
    .sort((a, b) => b.billableAmount - a.billableAmount)

  return {
    dateFrom: params.dateFrom, dateTo: params.dateTo, rows,
    summary: {
      totalBillableHours: round1(rows.reduce((s, r) => s + r.billableHours, 0)),
      totalBillableAmount: roundCurrency(rows.reduce((s, r) => s + r.billableAmount, 0)),
      totalUnbilledAmount: roundCurrency(rows.reduce((s, r) => s + r.unbilledAmount, 0)),
    },
  }
}

// Phase 68 §9.1 — CA Firm item 4: Fee Realization. A live current-state
// snapshot for THIS calendar month (no date-range param — "realization"
// means "have we actually billed what we expected to bill this period,"
// not a historical trend) across every ACTIVE, priced engagement.
// Deliberately uses `lastInvoicedPeriod` (the same real, reliable claim key
// generateEngagementInvoice's own atomic claim already relies on) rather
// than trying to join back to Invoice via the truncated-cuid
// `referenceNumber` string generateEngagementInvoice stamps on the invoice
// — that field is a display/audit trail, never designed as a queryable
// join key, and treating it as one would be fragile.
export interface FeeRealizationRow { engagementTitle: string; clientName: string; expectedFee: number; isInvoicedThisPeriod: boolean }
export interface FeeRealizationReport {
  period: string
  rows: FeeRealizationRow[]
  summary: { totalExpectedFee: number; totalRealizedFee: number; realizationPercent: number }
}

async function generateFeeRealizationReport(): Promise<FeeRealizationReport> {
  const db = getPrisma()
  const now = new Date()
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const engagements = await db.engagement.findMany({
    where: { status: 'ACTIVE', feeAmount: { not: null } },
    select: { title: true, feeAmount: true, lastInvoicedPeriod: true, client: { select: { customerName: true } } },
  })

  const rows: FeeRealizationRow[] = engagements.map((e) => ({
    engagementTitle: e.title, clientName: e.client.customerName,
    expectedFee: roundCurrency(Number(e.feeAmount)), isInvoicedThisPeriod: e.lastInvoicedPeriod === period,
  })).sort((a, b) => Number(a.isInvoicedThisPeriod) - Number(b.isInvoicedThisPeriod))

  const totalExpectedFee = roundCurrency(rows.reduce((s, r) => s + r.expectedFee, 0))
  const totalRealizedFee = roundCurrency(rows.filter((r) => r.isInvoicedThisPeriod).reduce((s, r) => s + r.expectedFee, 0))
  return {
    period, rows,
    summary: { totalExpectedFee, totalRealizedFee, realizationPercent: totalExpectedFee > 0 ? Math.round((totalRealizedFee / totalExpectedFee) * 1000) / 10 : 0 },
  }
}

// Phase 68 §9.1 — Architect items 1/2: drawing approval-cycle time. The live
// per-drawing "awaiting approval Xd" timer (item 1) is a pure client-side
// computation on DrawingRegisterScreen.tsx (no backend needed — it's just
// now-minus-issuedDate for an ISSUED_FOR_REVIEW row). This report is item 2:
// the aggregate — for every APPROVED drawing, how many days actually elapsed
// from issue to approval, so a practice can see whether its review cycle is
// getting faster or slower, broken down by discipline. Falls back to
// createdAt when issuedDate was never recorded (an APPROVED drawing must
// have an approvedDate by construction — see updateDrawingRevision's
// approvedByName+approvedDate requirement — but issuedDate is optional).
export interface DrawingApprovalCycleRow {
  drawingNumber: string; revisionNumber: string; discipline: string; projectName: string
  issuedDate: string; approvedDate: string; daysToApprove: number
}
export interface DrawingApprovalCycleByDiscipline { discipline: string; avgDaysToApprove: number; count: number }
export interface DrawingApprovalCycleTimeReport {
  rows: DrawingApprovalCycleRow[]
  byDiscipline: DrawingApprovalCycleByDiscipline[]
  summary: { totalApproved: number; avgDaysToApprove: number }
}

async function generateDrawingApprovalCycleTimeReport(): Promise<DrawingApprovalCycleTimeReport> {
  const db = getPrisma()
  const drawings = await db.drawingRevision.findMany({
    where: { status: 'APPROVED', approvedDate: { not: null } },
    include: { project: { select: { projectName: true } } },
    orderBy: { approvedDate: 'desc' },
  })

  const rows: DrawingApprovalCycleRow[] = drawings.map((d) => {
    const from = d.issuedDate ?? d.createdAt
    const daysToApprove = Math.max(0, Math.floor((d.approvedDate!.getTime() - from.getTime()) / 86400000))
    return {
      drawingNumber: d.drawingNumber, revisionNumber: d.revisionNumber, discipline: d.discipline, projectName: d.project.projectName,
      issuedDate: toLocalISODate(from), approvedDate: toLocalISODate(d.approvedDate!),
      daysToApprove,
    }
  })

  const round1 = (n: number) => Math.round(n * 10) / 10
  const byDisciplineMap = new Map<string, number[]>()
  for (const r of rows) byDisciplineMap.set(r.discipline, [...(byDisciplineMap.get(r.discipline) ?? []), r.daysToApprove])
  const byDiscipline: DrawingApprovalCycleByDiscipline[] = Array.from(byDisciplineMap.entries())
    .map(([discipline, days]) => ({ discipline, avgDaysToApprove: round1(days.reduce((s, d) => s + d, 0) / days.length), count: days.length }))
    .sort((a, b) => b.avgDaysToApprove - a.avgDaysToApprove)

  return {
    rows, byDiscipline,
    summary: { totalApproved: rows.length, avgDaysToApprove: rows.length > 0 ? round1(rows.reduce((s, r) => s + r.daysToApprove, 0) / rows.length) : 0 },
  }
}

// Phase 68 §9.1 — Architect/Civil item 4: project stage progress. A live
// current-state worklist across every ACTIVE project on a recognized stage
// pipeline, worst-first by days stuck in the CURRENT stage
// (ServiceProject.stageUpdatedAt — only reset on an actual stage change, see
// updateServiceProject) — same "aging, not just a status label" shape as
// Lawyer's generateCaseAgingReport. stageProgressPercent is a plain
// index-in-pipeline count, not a fabricated weighted score.
const ARCHITECT_STAGE_PIPELINE = ['CONCEPT', 'SCHEMATIC', 'DESIGN_DEVELOPMENT', 'DRAWINGS', 'APPROVALS', 'CONSTRUCTION', 'HANDOVER']
const CIVIL_STAGE_PIPELINE = ['SURVEY', 'DESIGN', 'FOUNDATION', 'STRUCTURE', 'FINISHING', 'HANDOVER']

function stagePipelineFor(stage: string): string[] | null {
  if (ARCHITECT_STAGE_PIPELINE.includes(stage)) return ARCHITECT_STAGE_PIPELINE
  if (CIVIL_STAGE_PIPELINE.includes(stage)) return CIVIL_STAGE_PIPELINE
  return null
}

export interface ProjectStageProgressRow {
  projectId: string; projectName: string; clientName: string
  stage: string; stageProgressPercent: number | null; daysInStage: number
}
export interface ProjectStageProgressReport {
  rows: ProjectStageProgressRow[]
  summary: { totalActiveProjects: number; avgDaysInStage: number }
}

async function generateProjectStageProgressReport(): Promise<ProjectStageProgressReport> {
  const db = getPrisma()
  const now = new Date()

  const projects = await db.serviceProject.findMany({
    where: { status: 'ACTIVE', stage: { not: null } },
    select: { id: true, projectName: true, stage: true, stageUpdatedAt: true, createdAt: true, client: { select: { customerName: true } } },
  })

  const round1 = (n: number) => Math.round(n * 10) / 10
  const rows: ProjectStageProgressRow[] = projects.map((p) => {
    const stage = p.stage as string
    const pipeline = stagePipelineFor(stage)
    const stageProgressPercent = pipeline ? Math.round(((pipeline.indexOf(stage) + 1) / pipeline.length) * 100) : null
    const stageEnteredAt = p.stageUpdatedAt ?? p.createdAt
    return {
      projectId: p.id, projectName: p.projectName, clientName: p.client.customerName,
      stage, stageProgressPercent,
      daysInStage: Math.floor((now.getTime() - stageEnteredAt.getTime()) / 86400000),
    }
  }).sort((a, b) => b.daysInStage - a.daysInStage)

  return {
    rows,
    summary: { totalActiveProjects: rows.length, avgDaysInStage: rows.length > 0 ? round1(rows.reduce((s, r) => s + r.daysInStage, 0) / rows.length) : 0 },
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
  generateApAgingReport,
  generatePurchaseRegisterReport,
  generatePurchasesByVendorReport,
  generatePurchasesByItemReport,
  generateCustomerLedgerReport,
  generateSupplierLedgerReport,
  generateExpenseReport,
  generateProfitAndLossReport,
  generateCashBookReport,
  generateTrialBalanceReport,
  generateCostCentreTreemapReport,
  generateBudgetVsActualReport,
  generateStatutoryComplianceSummaryReport,
  generateCashFlowProjection,
  generateCashPositionTrendReport,
  generatePaymentPerformanceReport,
  generateAuditReport,
  generateFoodCostReport,
  generateDishContributionMarginReport,
  generateTableTurnoverByHourReport,
  generateRecipeWasteVarianceReport,
  generateDeadStockClearanceReport,
  generateCategorySellThroughReport,
  generateSeasonSellThroughReport,
  generateSizeStyleHeatmapReport,
  generateSizeAvailabilityHeatmapReport,
  generateCategoryMixReport,
  generateVendorMarginReport,
  generateBrandMarginReturnRateReport,
  generateBasketCompositionReport,
  generateFastSlowMoverMatrixReport,
  generateGSTR1,
  generateHSNSummaryReport,
  generateDocumentSummaryReport,
  generateGSTR3BPreview,
  generateRentalStatusReport,
  generateRentalRevenueReport,
  generateAssetUtilizationReport,
  generateAppointmentUtilisationReport,
  generateClientRetentionReport,
  generateCommissionReport,
  generateOrderVolumeReport,
  generateDiscountReport,
  generateBatchExpiryReport,
  generateLabThroughputReport,
  generateBloodStockReport,
  generateDonationToIssueCycleTimeReport,
  generateJewelleryReport,
  generateMakingChargeMarginReport,
  generateHallmarkComplianceReport,
  generateMetalRateVsSalesVolumeReport,
  generatePurityAdjustedExchangeReport,
  generateLogisticsReport,
  generateAttendanceReport,
  generateProductionReport,
  generateLandedCostPerUnitReport,
  generateRejectionRateTrendReport,
  generateSeasonalCreditExposureReport,
  generateFarmerRepaymentReport,
  generateSerialWarrantyReport,
  generateRmaAgingReport,
  generateVendorRecoveryLedgerReport,
  generateRepairTurnaroundByTechnicianReport,
  generateVariantStockReport,
  generateTestScoreReport,
  generateComplianceTaskReport,
  generateProjectReport,
  generateServiceResolutionTimeReport,
  generateRepeatBusinessRateReport,
  generateConsultantUtilizationReport,
  generateClientProfitabilityReport,
  generateJobCardTurnaroundByTechnicianReport,
  generateRepairCategoryVolumeTrendReport,
  generateFieldRepLeaderboardReport,
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
  generateScheduleH1XRegisterReport,
  generateSchemeCostVsVolumeReport,
  generateChronicRecallComplianceReport,
  generateWalkInVsAppointmentRatioReport,
  generateDiagnosisCategoryTrendReport,
  generateReferralOutcomeReport,
  generatePackUtilizationReport,
  generateLabTATReport,
  generateTestVolumeByPanelReport,
  generateReferralLeaderboardReport,
  generateSecondOpinionConversionReport,
  generateCaseComplexityMixReport,
  generateTreatmentAcceptanceRateReport,
  generateDentalRecallComplianceReport,
  generateVaccinationComplianceReport,
  generateVetCaseTypeVolumeReport,
  generateStylistRepeatClientReport,
  generateRetailAttachRateReport,
  generateClassAttendanceHeatmapReport,
  generateMembershipRenewalFunnelReport,
  generateLearnerProgressFunnelReport,
  generateCaseAgingReport,
  generateLawyerBillableHoursReport,
  generateFeeRealizationReport,
  generateDrawingApprovalCycleTimeReport,
  generateProjectStageProgressReport,
  generateSiteVisitBillingReport,
  generateMaterialTestResultsReport,
  generateRetainerUtilizationReport,
  generateProposalWinRateReport,
  generateClientRevenueConcentrationReport,
  generateCampaignROIReport,
  generateDeliverableStatusPipelineReport,
  generateChannelPerformanceReport,
  generateRetainerWorkDeliveredReport,
  generateIssueAgingReport,
  generateTeamUtilizationReport,
  generateSprintBillingReport,
  generateDeliveryPipelineReport,
  generateShootTypeRevenueMixReport,
  generateEquipmentCheckoutReport,
}
