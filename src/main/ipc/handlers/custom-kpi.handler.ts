import { z } from 'zod'
import { customKpiService, KPI_METRICS, KPI_PERIODS } from '../../services/custom-kpi.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

const AddSchema = z.object({ name: z.string().min(1).max(40), metric: z.enum(KPI_METRICS), period: z.enum(KPI_PERIODS) })

export function register(handle: HandleFn): void {
  handle('customKpis:list', async () => {
    const deny = await requirePermission('analytics.viewRevenue'); if (deny) return deny
    return customKpiService.list()
  })

  handle('customKpis:add', async (payload) => {
    const deny = await requirePermission('analytics.viewRevenue'); if (deny) return deny
    const parsed = AddSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid tile.' } }
    return customKpiService.add(parsed.data, getCurrentSession()?.userId)
  })

  handle('customKpis:remove', async (payload) => {
    const deny = await requirePermission('analytics.viewRevenue'); if (deny) return deny
    const id = (payload as { id?: unknown } | null)?.id
    if (typeof id !== 'string' || !id) return { success: false, error: { code: 'VAL-001', message: 'Choose a tile.' } }
    return customKpiService.remove(id, getCurrentSession()?.userId)
  })
}
