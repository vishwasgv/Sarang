import { z } from 'zod'
import { branchSummaryService } from '../../services/branch-summary.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

const ExportSchema = z.object({
  branchName: z.string().max(120).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the first date'),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose the last date')
})

export function register(handle: HandleFn): void {
  handle('branchSummaries:export', async (payload) => {
    const deny = await requirePermission('analytics.viewProfit'); if (deny) return deny
    const parsed = ExportSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload.' } }
    return branchSummaryService.exportOwn(parsed.data)
  })

  handle('branchSummaries:import', async () => {
    const deny = await requirePermission('analytics.viewProfit'); if (deny) return deny
    return branchSummaryService.importFiles(getCurrentSession()?.userId)
  })

  handle('branchSummaries:list', async () => {
    const deny = await requirePermission('analytics.viewProfit'); if (deny) return deny
    return branchSummaryService.list()
  })

  handle('branchSummaries:remove', async (payload) => {
    const deny = await requirePermission('analytics.viewProfit'); if (deny) return deny
    const id = (payload as { id?: string } | undefined)?.id
    if (!id) return { success: false, error: { code: 'VAL-001', message: 'Choose a summary.' } }
    return branchSummaryService.remove(id, getCurrentSession()?.userId)
  })
}
