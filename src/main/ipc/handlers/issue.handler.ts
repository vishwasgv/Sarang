import { requirePermission } from '../permission-guard'
import { listIssues, createIssue, updateIssue, deleteIssue } from '../../services/issue.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('issue:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { projectId?: string; status?: string; priority?: string; assignedToId?: string; sprintId?: string }
    return listIssues(payload)
  })

  handle('issue:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { projectId: string; title: string; description?: string; priority?: string; status?: string; assignedToId?: string; sprintId?: string }
    return createIssue(payload)
  })

  handle('issue:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string; title?: string; description?: string | null; priority?: string; status?: string; assignedToId?: string | null; sprintId?: string | null; resolvedDate?: string | null }
    return updateIssue(payload)
  })

  handle('issue:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string }
    return deleteIssue(payload.id)
  })
}
