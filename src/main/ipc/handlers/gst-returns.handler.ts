import { gstReturnsService } from '../../services/gst-returns.service'
import { gstReconciliationService } from '../../services/gst-reconciliation.service'
import { requirePermission } from '../permission-guard'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

const monthOf = (payload: unknown): string => String((payload as { month?: string } | undefined)?.month ?? '')

export function register(handle: HandleFn): void {
  handle('gstReturns:exportGstr1', async (payload) => {
    const deny = await requirePermission('reports.tax'); if (deny) return deny
    return gstReturnsService.exportGstr1(monthOf(payload))
  })

  handle('gstReturns:reconcile', async () => {
    const deny = await requirePermission('reports.tax'); if (deny) return deny
    return gstReconciliationService.runFromFile()
  })

  handle('gstReturns:exportGstr3b', async (payload) => {
    const deny = await requirePermission('reports.tax'); if (deny) return deny
    return gstReturnsService.exportGstr3b(monthOf(payload))
  })
}
