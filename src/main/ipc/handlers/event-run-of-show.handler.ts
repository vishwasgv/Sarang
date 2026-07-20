import { requirePermission } from '../permission-guard'
import { listRunOfShow, createRunOfShowItem, updateRunOfShowItem, deleteRunOfShowItem } from '../../services/event-run-of-show.service'
import { EventIdParamSchema, EntityIdSchema, CreateRunOfShowItemSchema, UpdateRunOfShowItemSchema } from '../../validation/event-run-of-show.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerEventRunOfShow(handle: HandleFn): void {
  handle('eventRunOfShow:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = EventIdParamSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return listRunOfShow(parsed.data.eventId)
  })

  handle('eventRunOfShow:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateRunOfShowItemSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createRunOfShowItem(parsed.data)
  })

  handle('eventRunOfShow:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateRunOfShowItemSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateRunOfShowItem(parsed.data)
  })

  handle('eventRunOfShow:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = EntityIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteRunOfShowItem(parsed.data.id)
  })
}
