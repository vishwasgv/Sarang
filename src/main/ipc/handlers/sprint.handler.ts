import { requirePermission } from '../permission-guard'
import { listSprints, createSprint, updateSprint, deleteSprint } from '../../services/sprint.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('sprint:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { projectId: string }
    return listSprints(payload.projectId)
  })

  handle('sprint:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { projectId: string; name?: string; goal?: string; startDate: string; endDate: string }
    return createSprint(payload)
  })

  handle('sprint:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string; name?: string | null; goal?: string | null; startDate?: string; endDate?: string; status?: string }
    return updateSprint(payload)
  })

  handle('sprint:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string }
    return deleteSprint(payload.id)
  })
}
