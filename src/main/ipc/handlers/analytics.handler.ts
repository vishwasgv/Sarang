import * as analyticsService from '../../services/analytics.service'
import { requirePermission, hasPermission } from '../permission-guard'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('analytics:getDashboardKpis', async (payload) => {
    const deny = await requirePermission('analytics.viewDashboard'); if (deny) return deny
    const forceRefresh = (payload as { forceRefresh?: boolean } | undefined)?.forceRefresh ?? false
    const data = await analyticsService.getDashboardKpis(forceRefresh)

    // The base analytics.viewDashboard permission only guarantees the caller may load
    // the dashboard at all — profit/expense/revenue/inventory fields need their own
    // permission, same as every other analytics endpoint. Redacted here (not just hidden
    // in the renderer) so the raw figures never leave the main process for an
    // unauthorized role — e.g. Cashier must not see estimatedProfit (RULE AN002).
    const [canRevenue, canInventory, canProfit, canExpenses] = await Promise.all([
      hasPermission('analytics.viewRevenue'),
      hasPermission('analytics.viewInventory'),
      hasPermission('analytics.viewProfit'),
      hasPermission('analytics.viewExpenses')
    ])

    // Note: outstanding, todaySales, monthSales, lowStockCount, and headcounts are
    // intentionally visible to every role that can open the dashboard at all — only
    // the fields the KPI grid itself locks behind a specific permission get redacted.
    const redacted: analyticsService.DashboardKpis = { ...data }
    if (!canRevenue) {
      redacted.weekSales = 0; redacted.weekTrend = 0
    }
    if (!canInventory) {
      redacted.inventoryValue = 0
    }
    if (!canProfit) {
      redacted.estimatedProfit = 0; redacted.profitTrend = 0
    }
    if (!canExpenses) {
      redacted.monthExpenses = 0; redacted.expenseTrend = 0
    }

    return { success: true, data: redacted }
  })

  handle('analytics:getRevenueTrend', async (payload) => {
    const deny = await requirePermission('analytics.viewRevenue'); if (deny) return deny
    const p = (payload ?? {}) as { period?: string; customFrom?: string; customTo?: string }
    const period = p.period ?? '30d'
    const valid = ['1d', '7d', '30d', '90d', '12m', 'custom']
    if (!valid.includes(period)) return { success: false, error: { code: 'VAL-001', message: 'Invalid period' } }
    if (period === 'custom' && (!p.customFrom || !p.customTo)) {
      return { success: false, error: { code: 'VAL-002', message: 'customFrom and customTo required for custom period' } }
    }
    const data = await analyticsService.getRevenueTrend(
      period as '1d' | '7d' | '30d' | '90d' | '12m' | 'custom',
      p.customFrom,
      p.customTo
    )
    return { success: true, data }
  })

  handle('analytics:getTopProducts', async (payload) => {
    const deny = await requirePermission('analytics.viewInventory'); if (deny) return deny
    const limit = Math.min((payload as { limit?: number })?.limit ?? 10, 20)
    const data = await analyticsService.getTopProducts(limit)
    return { success: true, data }
  })

  handle('analytics:getRecentActivity', async () => {
    const deny = await requirePermission('analytics.viewDashboard'); if (deny) return deny
    const data = await analyticsService.getRecentActivity()
    return { success: true, data }
  })

  handle('analytics:getDashboardAlerts', async () => {
    const deny = await requirePermission('analytics.viewDashboard'); if (deny) return deny
    const data = await analyticsService.getDashboardAlerts()
    return { success: true, data }
  })

  handle('analytics:getTopOutstanding', async (payload) => {
    const deny = await requirePermission('analytics.viewRevenue'); if (deny) return deny
    const limit = Math.min((payload as { limit?: number })?.limit ?? 5, 10)
    const data = await analyticsService.getTopOutstanding(limit)
    return { success: true, data }
  })

  handle('analytics:getTopCategories', async (payload) => {
    const deny = await requirePermission('analytics.viewInventory'); if (deny) return deny
    const limit = Math.min((payload as { limit?: number })?.limit ?? 5, 10)
    const data = await analyticsService.getTopCategories(limit)
    return { success: true, data }
  })

  handle('analytics:getEstimatedProfit', async (payload) => {
    const deny = await requirePermission('analytics.viewProfit'); if (deny) return deny
    const p = (payload ?? {}) as { dateFrom?: string; dateTo?: string }
    if (!p.dateFrom || !p.dateTo) {
      return { success: false, error: { code: 'VAL-001', message: 'dateFrom and dateTo required' } }
    }
    const dateFrom = new Date(p.dateFrom + 'T00:00:00')
    const dateTo = new Date(new Date(p.dateTo + 'T00:00:00').setHours(23, 59, 59, 999))
    const data = await analyticsService.getEstimatedProfit(dateFrom, dateTo)
    return { success: true, data }
  })
}
