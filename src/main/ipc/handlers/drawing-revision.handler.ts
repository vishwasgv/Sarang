import { listDrawingRevisions, createDrawingRevision, updateDrawingRevision, deleteDrawingRevision } from '../../services/drawing-revision.service'
import { requirePermission } from '../permission-guard'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('drawingRevision:list', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const { projectId } = payload as { projectId: string }
    return listDrawingRevisions(projectId)
  })

  handle('drawingRevision:create', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return createDrawingRevision(payload as Parameters<typeof createDrawingRevision>[0])
  })

  handle('drawingRevision:update', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return updateDrawingRevision(payload as Parameters<typeof updateDrawingRevision>[0])
  })

  handle('drawingRevision:delete', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const { id } = payload as { id: string }
    return deleteDrawingRevision(id)
  })
}
