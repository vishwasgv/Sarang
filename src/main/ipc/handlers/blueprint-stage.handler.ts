import { z } from 'zod'
import { blueprintStageService } from '../../services/blueprint-stage.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

const AddSchema = z.object({ documentType: z.string().min(1), name: z.string().min(1).max(80) })
const ReorderSchema = z.object({ documentType: z.string().min(1), orderedIds: z.array(z.string().min(1)) })

export function register(handle: HandleFn): void {
  handle('blueprintStages:list', async (payload) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const documentType = (payload as { documentType?: unknown } | null)?.documentType
    if (typeof documentType !== 'string' || !documentType) return { success: false, error: { code: 'VAL-001', message: 'Choose a document type.' } }
    return blueprintStageService.list(documentType)
  })

  handle('blueprintStages:add', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = AddSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid stage.' } }
    return blueprintStageService.add(parsed.data, getCurrentSession()?.userId)
  })

  handle('blueprintStages:reorder', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = ReorderSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: 'Invalid order.' } }
    return blueprintStageService.reorder(parsed.data, getCurrentSession()?.userId)
  })

  handle('blueprintStages:retire', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const id = (payload as { id?: unknown } | null)?.id
    if (typeof id !== 'string' || !id) return { success: false, error: { code: 'VAL-001', message: 'Choose a stage.' } }
    return blueprintStageService.retire(id, getCurrentSession()?.userId)
  })
}
