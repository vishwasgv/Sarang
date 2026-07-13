import { getPrisma } from '../database/db'
import { isModuleEnabled } from './industry-template.service'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardKpis {
  todaySales: number; todayTrend: number
  weekSales: number; weekTrend: number
  monthSales: number; monthTrend: number
  totalInvoices: number
  outstanding: number
  inventoryValue: number
  monthExpenses: number; expenseTrend: number
  estimatedProfit: number; profitTrend: number
  lowStockCount: number
  customerCount: number
  supplierCount: number
  inventoryStats: InventoryStats
  // Restaurant KPIs (G6.2) — only populated when restaurant module is active
  occupiedTables?: number
  kotPending?: number
  kotInProgress?: number
}

export interface TrendPoint {
  label: string
  revenue: number
  expenses: number
}

export interface TopProduct {
  productName: string
  sku: string | null
  quantitySold: number
  revenue: number
}

export interface ActivityItem {
  id: string
  action: string
  entityType: string | null
  entityId: string | null
  user: string
  createdAt: string
}

export interface DashboardAlert {
  type: 'LOW_STOCK' | 'NO_BACKUP' | 'LARGE_OUTSTANDING' | 'PENDING_REMINDERS' | 'AUDIT_LOG_FAILURE' | 'RENTAL_OVERDUE'
  message: string
  severity: 'warning' | 'danger'
}

export interface InventoryStats {
  total: number
  inStock: number
  lowStock: number
  outOfStock: number
}

export interface TopOutstanding {
  customerId: string
  customerName: string
  outstanding: number
}

export interface TopCategory {
  categoryName: string
  revenue: number
  itemsSold: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

function trendPct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function shortDate(d: Date): string {
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' })
}

function shortMonth(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
}

// ─────────────────────────────────────────────────────────────────────────────
// computeProfit — GAP 6.1: Profit Estimate = Revenue − COGS − Expenses, where
// Revenue is realized (PAID/PARTIAL) invoices only and COGS uses the product's
// weighted-average cost price. Shared by getDashboardKpis and getEstimatedProfit
// so both surfaces can never drift apart.
// ─────────────────────────────────────────────────────────────────────────────

async function computeProfit(dateFrom: Date, dateTo: Date): Promise<number> {
  const db = getPrisma()
  const [invoices, expAgg] = await Promise.all([
    db.invoice.findMany({
      where: { status: 'ACTIVE', paymentStatus: { in: ['PAID', 'PARTIAL'] }, invoiceDate: { gte: dateFrom, lte: dateTo } },
      select: {
        totalAmount: true, invoiceType: true,
        items: { select: { quantity: true, product: { select: { costPrice: true } } } }
      }
    }),
    db.expense.aggregate({ where: { expenseDate: { gte: dateFrom, lte: dateTo } }, _sum: { amount: true } })
  ])

  const revenue = invoices.reduce((s, inv) => s + inv.totalAmount, 0)
  // A RETURN invoice stores its line items' quantity as POSITIVE (returns.service.ts
  // uses it to increment inventory back) — only totalAmount/lineTotal are negative.
  // Summing quantity * costPrice without checking invoiceType double-punishes
  // profit on a return: revenue already drops by the sale price via totalAmount,
  // and COGS must drop by the cost price too (the goods came back into stock),
  // not rise again as if a second sale had happened.
  const cogs = invoices.reduce((s, inv) => {
    const sign = inv.invoiceType === 'RETURN' ? -1 : 1
    return s + inv.items.reduce((si, it) => si + sign * it.quantity * it.product.costPrice, 0)
  }, 0)
  const expenses = expAgg._sum.amount ?? 0

  return revenue - cogs - expenses
}

// ─────────────────────────────────────────────────────────────────────────────
// getDashboardKpis — all 10 KPIs with trend percentages
// Cached for 60 s so incidental repeat calls don't hammer the DB. An explicit
// forceRefresh bypasses the cache — the dashboard's manual Refresh button must
// always return current numbers, not up-to-60s-old ones.
// ─────────────────────────────────────────────────────────────────────────────

let _kpiCache: { value: DashboardKpis; expiresAt: number } | null = null
const KPI_CACHE_TTL_MS = 60_000

export async function getDashboardKpis(forceRefresh = false): Promise<DashboardKpis> {
  if (!forceRefresh && _kpiCache && Date.now() < _kpiCache.expiresAt) return _kpiCache.value
  const db = getPrisma()
  const now = new Date()

  const today = dayStart(now)
  const yesterday = dayStart(addDays(now, -1))
  const weekStart = dayStart(addDays(now, -6))
  const prevWeekStart = dayStart(addDays(now, -13))
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

  const [
    todayAgg, yesterdayAgg,
    weekAgg, prevWeekAgg,
    monthAgg, prevMonthAgg,
    monthExpAgg, prevMonthExpAgg,
    inventoryItems, allInventory,
    customerCount, supplierCount,
    ledgerAgg, totalInvoices,
    estimatedProfit, prevProfit
  ] = await Promise.all([
    db.invoice.aggregate({ where: { status: 'ACTIVE', invoiceDate: { gte: today } }, _sum: { totalAmount: true } }),
    db.invoice.aggregate({ where: { status: 'ACTIVE', invoiceDate: { gte: yesterday, lt: today } }, _sum: { totalAmount: true } }),
    db.invoice.aggregate({ where: { status: 'ACTIVE', invoiceDate: { gte: weekStart } }, _sum: { totalAmount: true } }),
    db.invoice.aggregate({ where: { status: 'ACTIVE', invoiceDate: { gte: prevWeekStart, lt: weekStart } }, _sum: { totalAmount: true } }),
    db.invoice.aggregate({ where: { status: 'ACTIVE', invoiceDate: { gte: monthStart } }, _sum: { totalAmount: true } }),
    db.invoice.aggregate({ where: { status: 'ACTIVE', invoiceDate: { gte: prevMonthStart, lte: prevMonthEnd } }, _sum: { totalAmount: true } }),
    db.expense.aggregate({ where: { expenseDate: { gte: monthStart } }, _sum: { amount: true } }),
    db.expense.aggregate({ where: { expenseDate: { gte: prevMonthStart, lte: prevMonthEnd } }, _sum: { amount: true } }),
    db.inventory.findMany({ include: { product: { select: { costPrice: true, isActive: true } } } }),
    db.inventory.findMany({ select: { quantity: true, reorderLevel: true }, where: { product: { isActive: true } } }),
    db.customer.count({ where: { isActive: true } }),
    db.supplier.count({ where: { isActive: true } }),
    // RULE AN001: outstanding matches ledger aggregates (same source as Outstanding Report)
    db.customerLedger.aggregate({ _sum: { debitAmount: true, creditAmount: true } }),
    db.invoice.count({ where: { status: 'ACTIVE' } }),
    // GAP 6.1: Profit Estimate = Revenue (realized invoices only) − COGS − Expenses
    computeProfit(monthStart, new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)),
    computeProfit(prevMonthStart, prevMonthEnd)
  ])

  const todaySales = todayAgg._sum.totalAmount ?? 0
  const weekSales = weekAgg._sum.totalAmount ?? 0
  const monthSales = monthAgg._sum.totalAmount ?? 0
  const monthExpenses = monthExpAgg._sum.amount ?? 0

  const inventoryValue = inventoryItems.reduce((sum, inv) => {
    if (!inv.product.isActive) return sum
    return sum + inv.quantity * inv.product.costPrice
  }, 0)

  const inventoryTotal = allInventory.length
  const inventoryInStock = allInventory.filter(i => i.quantity > (i.reorderLevel ?? 0)).length
  const inventoryLowStock = allInventory.filter(i =>
    i.quantity > 0 && i.quantity <= (i.reorderLevel ?? 0) && (i.reorderLevel ?? 0) > 0
  ).length
  const inventoryOutOfStock = allInventory.filter(i => i.quantity <= 0).length
  // Single source of truth: "needs attention" (KPI card + alerts) is always
  // low-stock plus out-of-stock from the same exhaustive breakdown below —
  // they can never disagree with the Inventory Health chart on this dashboard.
  const lowStockCount = inventoryLowStock + inventoryOutOfStock

  // Net customer outstanding: debit (they owe us) - credit (we've received / credited)
  const outstanding = Math.max(0,
    (ledgerAgg._sum.debitAmount ?? 0) - (ledgerAgg._sum.creditAmount ?? 0)
  )

  const prevMonthExpenses = prevMonthExpAgg._sum.amount ?? 0
  const prevMonthSales = prevMonthAgg._sum.totalAmount ?? 0

  const kpis: DashboardKpis = {
    todaySales, todayTrend: trendPct(todaySales, yesterdayAgg._sum.totalAmount ?? 0),
    weekSales, weekTrend: trendPct(weekSales, prevWeekAgg._sum.totalAmount ?? 0),
    monthSales, monthTrend: trendPct(monthSales, prevMonthSales),
    totalInvoices,
    outstanding,
    inventoryValue,
    monthExpenses, expenseTrend: trendPct(monthExpenses, prevMonthExpenses),
    estimatedProfit, profitTrend: trendPct(estimatedProfit, prevProfit),
    lowStockCount,
    customerCount,
    supplierCount,
    inventoryStats: {
      total: inventoryTotal,
      inStock: inventoryInStock,
      lowStock: inventoryLowStock,
      outOfStock: inventoryOutOfStock
    }
  }

  // G6.2: Restaurant KPIs — only when the restaurant module (KOT) is active.
  // Pending/in-progress kept as separate counts (not a combined "kitchen queue")
  // so the dashboard can show both KOT widgets from these counts alone, instead
  // of the renderer re-fetching full KOT lists just to take their .length.
  if (await isModuleEnabled('kot')) {
    const [occupiedTables, kotPending, kotInProgress] = await Promise.all([
      db.restaurantTable.count({ where: { status: 'OCCUPIED' } }),
      db.kOT.count({ where: { status: 'PENDING' } }),
      db.kOT.count({ where: { status: 'IN_PROGRESS' } })
    ])
    kpis.occupiedTables = occupiedTables
    kpis.kotPending = kotPending
    kpis.kotInProgress = kotInProgress
  }

  _kpiCache = { value: kpis, expiresAt: Date.now() + KPI_CACHE_TTL_MS }
  return kpis
}

// ─────────────────────────────────────────────────────────────────────────────
// getRevenueTrend — daily/weekly/monthly data points for the line chart
// ─────────────────────────────────────────────────────────────────────────────

export async function getRevenueTrend(
  period: '1d' | '7d' | '30d' | '90d' | '12m' | 'custom',
  customFrom?: string,
  customTo?: string
): Promise<TrendPoint[]> {
  const db = getPrisma()
  const now = new Date()
  const today = dayStart(now)

  let fromDate: Date
  let labels: string[]
  let keyFn: (d: Date) => string
  // Initialized to shortDate so every switch branch without an explicit override still compiles
  let labelFn: (d: Date) => string = (d) => shortDate(d)

  switch (period) {
    case '1d': {
      fromDate = today
      labels = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
      keyFn = (d) => String(new Date(d).getHours()).padStart(2, '0')
      break
    }
    case '7d': {
      fromDate = dayStart(addDays(now, -6))
      labels = Array.from({ length: 7 }, (_, i) => addDays(today, -(6 - i)).toISOString().slice(0, 10))
      keyFn = (d) => dayStart(d).toISOString().slice(0, 10)
      break
    }
    case '30d': {
      fromDate = dayStart(addDays(now, -29))
      labels = Array.from({ length: 30 }, (_, i) => addDays(today, -(29 - i)).toISOString().slice(0, 10))
      keyFn = (d) => dayStart(d).toISOString().slice(0, 10)
      break
    }
    case '90d': {
      fromDate = dayStart(addDays(now, -89))
      keyFn = (d) => {
        const day = dayStart(d)
        const dow = day.getDay()
        return addDays(day, -(dow === 0 ? 6 : dow - 1)).toISOString().slice(0, 10)
      }
      const weekSet = new Set<string>()
      for (let i = 0; i <= 89; i++) weekSet.add(keyFn(addDays(fromDate, i)))
      labels = Array.from(weekSet).sort()
      break
    }
    case '12m': {
      fromDate = new Date(now.getFullYear(), now.getMonth() - 11, 1)
      labels = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      })
      keyFn = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      labelFn = (d) => shortMonth(new Date(d.getFullYear(), d.getMonth(), 1))
      break
    }
    case 'custom': {
      const cf = customFrom ? new Date(customFrom + 'T00:00:00') : addDays(now, -29)
      const ct = customTo ? new Date(customTo + 'T00:00:00') : now
      fromDate = dayStart(cf)
      const rangeDays = Math.max(1, Math.round((ct.getTime() - cf.getTime()) / 86400000))

      if (rangeDays <= 31) {
        labels = Array.from({ length: rangeDays + 1 }, (_, i) => addDays(fromDate, i).toISOString().slice(0, 10))
        keyFn = (d) => dayStart(d).toISOString().slice(0, 10)
      } else if (rangeDays <= 90) {
        keyFn = (d) => {
          const day = dayStart(d)
          const dow = day.getDay()
          return addDays(day, -(dow === 0 ? 6 : dow - 1)).toISOString().slice(0, 10)
        }
        const wkSet = new Set<string>()
        for (let i = 0; i <= rangeDays; i++) wkSet.add(keyFn(addDays(fromDate, i)))
        labels = Array.from(wkSet).sort()
      } else {
        keyFn = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        labelFn = (d) => shortMonth(new Date(d.getFullYear(), d.getMonth(), 1))
        const mSet = new Set<string>()
        for (let i = 0; i <= rangeDays; i++) mSet.add(keyFn(addDays(fromDate, i)))
        labels = Array.from(mSet).sort()
      }
      break
    }
  }

  // For custom period, respect the provided end date; otherwise use end of today
  const toDate = period === 'custom' && customTo
    ? new Date(new Date(customTo + 'T00:00:00').setHours(23, 59, 59, 999))
    : new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)

  const [invoices, expenses] = await Promise.all([
    db.invoice.findMany({
      where: { status: 'ACTIVE', invoiceDate: { gte: fromDate, lte: toDate } },
      select: { invoiceDate: true, totalAmount: true }
    }),
    db.expense.findMany({
      where: { expenseDate: { gte: fromDate, lte: toDate } },
      select: { expenseDate: true, amount: true }
    })
  ])

  const revenueMap = new Map<string, number>()
  const expenseMap = new Map<string, number>()

  for (const inv of invoices) {
    const key = keyFn(new Date(inv.invoiceDate))
    revenueMap.set(key, (revenueMap.get(key) ?? 0) + inv.totalAmount)
  }
  for (const exp of expenses) {
    const key = keyFn(new Date(exp.expenseDate))
    expenseMap.set(key, (expenseMap.get(key) ?? 0) + exp.amount)
  }

  // Display label inferred from key format — works across all periods including 'custom'
  return labels.map(key => ({
    label: key.length === 2
      ? `${key}h`                              // '1d' hourly keys: '00'–'23'
      : key.length === 7
        ? shortMonth(new Date(key + '-01'))    // '12m' / custom monthly: 'YYYY-MM'
        : labelFn(new Date(key)),              // daily / weekly: 'YYYY-MM-DD'
    revenue: Math.round((revenueMap.get(key) ?? 0) * 100) / 100,
    expenses: Math.round((expenseMap.get(key) ?? 0) * 100) / 100
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// getTopProducts — by revenue (all-time)
// ─────────────────────────────────────────────────────────────────────────────

// Phase 57 (AI Assistant) added the optional dateFrom/dateTo params — the
// original all-time-only call sites (Dashboard) pass neither and are
// unaffected; inventory.topRevenueProducts needs period-scoping.
export async function getTopProducts(limit: number = 10, dateFrom?: string, dateTo?: string): Promise<TopProduct[]> {
  const db = getPrisma()

  const items = await db.invoiceItem.findMany({
    where: {
      invoice: {
        status: 'ACTIVE',
        ...(dateFrom || dateTo ? { invoiceDate: { ...(dateFrom ? { gte: new Date(dateFrom) } : {}), ...(dateTo ? { lte: new Date(dateTo + 'T23:59:59') } : {}) } } : {})
      }
    },
    select: {
      productId: true,
      quantity: true,
      lineTotal: true,
      invoice: { select: { invoiceType: true } },
      product: { select: { productName: true, sku: true } }
    }
  })

  const map = new Map<string, TopProduct>()
  for (const item of items) {
    const existing = map.get(item.productId) ?? {
      productName: item.product.productName,
      sku: item.product.sku,
      quantitySold: 0,
      revenue: 0
    }
    // RETURN invoice items store quantity as POSITIVE (see returns.service.ts) —
    // only lineTotal is signed negative — so quantitySold must be subtracted
    // for a return or it inflates "units sold" by every returned unit.
    const sign = item.invoice.invoiceType === 'RETURN' ? -1 : 1
    existing.quantitySold += sign * item.quantity
    existing.revenue += item.lineTotal
    map.set(item.productId, existing)
  }

  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
    .map(p => ({ ...p, revenue: Math.round(p.revenue * 100) / 100 }))
}

// ─────────────────────────────────────────────────────────────────────────────
// getRecentActivity — last 10 audit log entries with user name
// ─────────────────────────────────────────────────────────────────────────────

export async function getRecentActivity(): Promise<ActivityItem[]> {
  const db = getPrisma()
  const logs = await db.auditLog.findMany({
    include: { user: { select: { fullName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  return logs.map(l => ({
    id: l.id,
    action: l.action,
    entityType: l.entityType,
    entityId: l.entityId,
    user: l.user?.fullName ?? 'System',
    createdAt: l.createdAt.toISOString()
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// getDashboardAlerts — low stock, no backup, large outstanding
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_LARGE_OUTSTANDING_THRESHOLD = 100_000

// The "large outstanding" threshold is currency-relative — 100,000 is a
// sensible default in INR but meaningless as a flat number in USD/JPY/EUR/etc.
// Configurable per business via the Setting table (falls back to the INR-sized
// default for installs that never set it), same pattern as allow_negative_inventory.
async function getLargeOutstandingThreshold(): Promise<number> {
  try {
    const db = getPrisma()
    const s = await db.setting.findUnique({ where: { settingKey: 'large_outstanding_threshold' } })
    const parsed = s ? Number(s.settingValue) : NaN
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_LARGE_OUTSTANDING_THRESHOLD
  } catch {
    return DEFAULT_LARGE_OUTSTANDING_THRESHOLD
  }
}

const DEFAULT_BACKUP_REMINDER_DAYS = 7

// Configurable per GAP 7.2 (backup_reminder_days Setting, default 7) instead of a
// flat hardcoded threshold — same pattern as large_outstanding_threshold above.
async function getBackupReminderDays(): Promise<number> {
  try {
    const db = getPrisma()
    const s = await db.setting.findUnique({ where: { settingKey: 'backup_reminder_days' } })
    const parsed = s ? Number(s.settingValue) : NaN
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_BACKUP_REMINDER_DAYS
  } catch {
    return DEFAULT_BACKUP_REMINDER_DAYS
  }
}

export async function getDashboardAlerts(): Promise<DashboardAlert[]> {
  const db = getPrisma()
  const alerts: DashboardAlert[] = []

  const [allInventory, lastBackup, ledgerAgg, businessProfile, warningThreshold, reminderDays, pendingReminderCount, auditLogFailure, overdueRentalCount] = await Promise.all([
    db.inventory.findMany({
      select: { quantity: true, reorderLevel: true },
      where: { product: { isActive: true } }
    }),
    db.backup.findFirst({ orderBy: { backupDate: 'desc' }, select: { backupDate: true } }),
    db.customerLedger.aggregate({ _sum: { debitAmount: true, creditAmount: true } }),
    db.businessProfile.findFirst({ select: { currencySymbol: true } }),
    getLargeOutstandingThreshold(),
    getBackupReminderDays(),
    // Same "due" definition notification-queue.service.ts's getUnsentCount()
    // already uses (PENDING + scheduledFor has arrived) — this is a manual-send
    // queue (see notificationQueue.service.ts's own header comment: WhatsApp
    // reminders are never auto-sent), so surfacing the count here is what
    // actually gets a staff member to open the queue and act on it, instead
    // of relying on them remembering to check a screen nobody's told to visit.
    db.notificationQueue.count({ where: { status: 'PENDING', scheduledFor: { lte: new Date() } } }),
    // Set by audit.service.ts's logAction on a write failure, cleared on the
    // next successful write — surfaces a silently-swallowed audit-log error
    // (previously only a console.error nobody watches) the same way NO_BACKUP
    // surfaces a silently-missed backup.
    db.setting.findUnique({ where: { settingKey: 'audit_log_last_failure_at' } }),
    // Overdue is never a stored status (see rental.service.ts's header
    // comment) — computed live here the same way, so this count can never
    // drift from what the Rental Bookings screen itself shows.
    db.rentalBooking.count({ where: { status: 'CHECKED_OUT', endDateTime: { lt: new Date() } } })
  ])

  // Low stock alert
  const lowStockCount = allInventory.filter(i => i.quantity <= (i.reorderLevel ?? 0)).length
  if (lowStockCount > 0) {
    alerts.push({
      type: 'LOW_STOCK',
      message: `${lowStockCount} product${lowStockCount > 1 ? 's are' : ' is'} at or below reorder level`,
      severity: lowStockCount >= 5 ? 'danger' : 'warning'
    })
  }

  // No backup / overdue backup alert
  if (!lastBackup) {
    alerts.push({ type: 'NO_BACKUP', message: 'No backup found. Create a backup to protect your data.', severity: 'warning' })
  } else {
    const daysSince = Math.floor((Date.now() - new Date(lastBackup.backupDate).getTime()) / 86400000)
    if (daysSince >= reminderDays) {
      alerts.push({
        type: 'NO_BACKUP',
        message: `Last backup was ${daysSince} day${daysSince > 1 ? 's' : ''} ago. Consider backing up now.`,
        severity: daysSince >= reminderDays * 2 ? 'danger' : 'warning'
      })
    }
  }

  // Large outstanding alert (RULE AN001: from ledger)
  const outstanding = (ledgerAgg._sum.debitAmount ?? 0) - (ledgerAgg._sum.creditAmount ?? 0)
  const currencySymbol = businessProfile?.currencySymbol ?? '₹'
  const dangerThreshold = warningThreshold * 5
  if (outstanding >= warningThreshold) {
    alerts.push({
      type: 'LARGE_OUTSTANDING',
      message: `Total customer outstanding exceeds ${currencySymbol}${(outstanding / 1000).toFixed(0)}K. Review pending payments.`,
      severity: outstanding >= dangerThreshold ? 'danger' : 'warning'
    })
  }

  // Pending WhatsApp reminders (payment overdue, appointment, vaccine/recall,
  // membership/pack expiry, compliance, hearing dates, etc.) — these are
  // manual-send by design (see Section 0 of TRUST_HARDENING_MASTER_PROMPT.md
  // for why: real auto-send needs a paid third-party API, which breaks this
  // app's zero-cost/offline rules), so the one thing that actually gets them
  // sent is a staff member noticing they're due. 10 is an arbitrary but
  // reasonable "this has been piling up" line — below it, one at a time is
  // normal; above it, it's worth flagging louder.
  if (pendingReminderCount > 0) {
    alerts.push({
      type: 'PENDING_REMINDERS',
      message: `${pendingReminderCount} reminder${pendingReminderCount > 1 ? 's are' : ' is'} waiting to be sent.`,
      severity: pendingReminderCount >= 10 ? 'danger' : 'warning'
    })
  }

  // Audit log write failure
  if (auditLogFailure) {
    alerts.push({
      type: 'AUDIT_LOG_FAILURE',
      message: 'A recent action could not be recorded in the audit log. Check disk space and file permissions.',
      severity: 'danger'
    })
  }

  // Overdue rentals — checked out and past their scheduled return date/time
  if (overdueRentalCount > 0) {
    alerts.push({
      type: 'RENTAL_OVERDUE',
      message: `${overdueRentalCount} rental${overdueRentalCount > 1 ? 's are' : ' is'} overdue for return.`,
      severity: overdueRentalCount >= 5 ? 'danger' : 'warning'
    })
  }

  return alerts
}

// ─────────────────────────────────────────────────────────────────────────────
// getTopOutstanding — top N customers by outstanding balance (RULE AN001: ledger)
// ─────────────────────────────────────────────────────────────────────────────

export async function getTopOutstanding(limit: number = 5): Promise<TopOutstanding[]> {
  const db = getPrisma()

  // Two queries total regardless of customer count — previously one aggregate
  // per active customer, which threatened the "dashboard loads < 2s" budget.
  const [customers, grouped] = await Promise.all([
    db.customer.findMany({ where: { isActive: true }, select: { id: true, customerName: true } }),
    db.customerLedger.groupBy({ by: ['customerId'], _sum: { debitAmount: true, creditAmount: true } })
  ])

  const balanceByCustomerId = new Map(
    grouped.map(g => [g.customerId, (g._sum.debitAmount ?? 0) - (g._sum.creditAmount ?? 0)])
  )

  return customers
    .map(c => ({ customerId: c.id, customerName: c.customerName, outstanding: balanceByCustomerId.get(c.id) ?? 0 }))
    .filter(r => r.outstanding > 0.01)
    .sort((a, b) => b.outstanding - a.outstanding)
    .slice(0, limit)
    .map(r => ({ ...r, outstanding: Math.round(r.outstanding * 100) / 100 }))
}

// ─────────────────────────────────────────────────────────────────────────────
// getTopCategories — top N categories by revenue (IMPLEMENTATION_PLAN §6.1)
// ─────────────────────────────────────────────────────────────────────────────

export async function getTopCategories(limit: number = 5): Promise<TopCategory[]> {
  const db = getPrisma()

  const items = await db.invoiceItem.findMany({
    where: { invoice: { status: 'ACTIVE' } },
    select: {
      lineTotal: true,
      quantity: true,
      invoice: { select: { invoiceType: true } },
      product: { select: { category: { select: { name: true } } } }
    }
  })

  const map = new Map<string, { revenue: number; itemsSold: number }>()
  for (const item of items) {
    const catName = item.product.category?.name ?? 'Uncategorized'
    const existing = map.get(catName) ?? { revenue: 0, itemsSold: 0 }
    // Same RETURN sign correction as getTopProducts — quantity is stored
    // positive on a return, so it must be subtracted here or "items sold"
    // is inflated by every returned unit.
    const sign = item.invoice.invoiceType === 'RETURN' ? -1 : 1
    existing.revenue += item.lineTotal
    existing.itemsSold += sign * item.quantity
    map.set(catName, existing)
  }

  return Array.from(map.entries())
    .map(([categoryName, stats]) => ({
      categoryName,
      revenue: Math.round(stats.revenue * 100) / 100,
      itemsSold: stats.itemsSold
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}

// ─────────────────────────────────────────────────────────────────────────────
// getInventoryValue — total stock value at cost (IMPLEMENTATION_PLAN §6.1)
// ─────────────────────────────────────────────────────────────────────────────

export async function getInventoryValue(): Promise<number> {
  const db = getPrisma()
  const items = await db.inventory.findMany({
    include: { product: { select: { costPrice: true, isActive: true } } }
  })
  const value = items.reduce((sum, inv) => {
    if (!inv.product.isActive) return sum
    return sum + inv.quantity * inv.product.costPrice
  }, 0)
  return Math.round(value * 100) / 100
}

// ─────────────────────────────────────────────────────────────────────────────
// getOutstandingAmount — net customer outstanding (IMPLEMENTATION_PLAN §6.1, RULE AN001)
// ─────────────────────────────────────────────────────────────────────────────

export async function getOutstandingAmount(): Promise<number> {
  const db = getPrisma()
  const agg = await db.customerLedger.aggregate({
    _sum: { debitAmount: true, creditAmount: true }
  })
  return Math.max(0, (agg._sum.debitAmount ?? 0) - (agg._sum.creditAmount ?? 0))
}

// ─────────────────────────────────────────────────────────────────────────────
// getEstimatedProfit — parametric profit for any date range (IMPLEMENTATION_PLAN §6.1)
// ─────────────────────────────────────────────────────────────────────────────

export async function getEstimatedProfit(dateFrom: Date, dateTo: Date): Promise<number> {
  return computeProfit(dateFrom, dateTo)
}

// ─────────────────────────────────────────────────────────────────────────────
// getExpenseTrend — expense-only trend points (IMPLEMENTATION_PLAN §6.1)
// ─────────────────────────────────────────────────────────────────────────────

export async function getExpenseTrend(
  period: '1d' | '7d' | '30d' | '90d' | '12m'
): Promise<{ label: string; expenses: number }[]> {
  const points = await getRevenueTrend(period)
  return points.map(p => ({ label: p.label, expenses: p.expenses }))
}
