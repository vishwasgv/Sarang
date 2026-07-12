import { requirePermission } from '../permission-guard'
import { getLogisticsAnalytics } from '../../services/logistics-analytics.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerLogisticsAnalyticsHandlers(handle: HandleFn): void {
  handle('logisticsAnalytics:get', async (raw) => {
    const deny = await requirePermission('logistics.view'); if (deny) return deny
    return getLogisticsAnalytics(raw as Parameters<typeof getLogisticsAnalytics>[0])
  })
}
