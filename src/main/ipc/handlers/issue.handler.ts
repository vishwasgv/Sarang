import { requirePermission } from '../permission-guard'
import { listIssues, createIssue, updateIssue, deleteIssue } from '../../services/issue.service'
import { CreateIssueSchema, UpdateIssueSchema, DeleteIssueSchema } from '../../validation/issue.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('issue:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { projectId?: string; status?: string; priority?: string; assignedToId?: string; sprintId?: string }
    return listIssues(payload)
  })

  handle('issue:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateIssueSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createIssue(parsed.data)
  })

  handle('issue:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateIssueSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateIssue(parsed.data)
  })

  handle('issue:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = DeleteIssueSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteIssue(parsed.data.id)
  })
}
