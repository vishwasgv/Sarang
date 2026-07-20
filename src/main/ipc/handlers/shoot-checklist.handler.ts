import { requirePermission } from '../permission-guard'
import { listShootChecklist, addShootChecklistItem, toggleShootChecklistItem, deleteShootChecklistItem } from '../../services/shoot-checklist.service'
import { ShootBookingIdParamSchema, EntityIdSchema, AddShootChecklistItemSchema, ToggleShootChecklistItemSchema } from '../../validation/shoot-checklist.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerShootChecklist(handle: HandleFn): void {
  handle('shootChecklist:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = ShootBookingIdParamSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return listShootChecklist(parsed.data.shootBookingId)
  })

  handle('shootChecklist:add', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = AddShootChecklistItemSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return addShootChecklistItem(parsed.data)
  })

  handle('shootChecklist:toggle', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = ToggleShootChecklistItemSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return toggleShootChecklistItem(parsed.data)
  })

  handle('shootChecklist:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = EntityIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteShootChecklistItem(parsed.data.id)
  })
}
