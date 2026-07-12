import { requirePermission } from '../permission-guard'
import { listPerformances, createPerformance, updatePerformance, deletePerformance } from '../../services/performance.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('performance:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { batchId?: string }
    return listPerformances(payload)
  })

  handle('performance:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as {
      batchId: string; performanceName: string; date: string
      venue?: string; participatingStudentIds?: string[]; notes?: string
    }
    return createPerformance(payload)
  })

  handle('performance:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as {
      id: string; performanceName?: string; date?: string; venue?: string | null
      participatingStudentIds?: string[]; notes?: string | null
    }
    return updatePerformance(payload)
  })

  handle('performance:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string }
    return deletePerformance(payload.id)
  })
}
