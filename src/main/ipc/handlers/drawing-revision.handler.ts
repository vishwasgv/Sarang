import { listDrawingRevisions, createDrawingRevision, updateDrawingRevision, deleteDrawingRevision, issueNewRevision, getRevisionHistory } from '../../services/drawing-revision.service'
import { requirePermission } from '../permission-guard'
import { CreateDrawingRevisionSchema, UpdateDrawingRevisionSchema, DeleteDrawingRevisionSchema, IssueNewRevisionSchema, GetRevisionHistorySchema } from '../../validation/drawing-revision.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('drawingRevision:list', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const { projectId } = payload as { projectId: string }
    return listDrawingRevisions(projectId)
  })

  handle('drawingRevision:create', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateDrawingRevisionSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createDrawingRevision(parsed.data)
  })

  handle('drawingRevision:update', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateDrawingRevisionSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateDrawingRevision(parsed.data)
  })

  handle('drawingRevision:delete', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = DeleteDrawingRevisionSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteDrawingRevision(parsed.data.id)
  })

  handle('drawingRevision:issueNewRevision', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = IssueNewRevisionSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return issueNewRevision(parsed.data)
  })

  handle('drawingRevision:getHistory', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = GetRevisionHistorySchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return getRevisionHistory(parsed.data.projectId, parsed.data.drawingNumber)
  })
}
