import { requirePermission } from '../permission-guard'
import { listShootAddOns, addShootAddOn, deleteShootAddOn, getShootAddOnsTotal } from '../../services/shoot-addon.service'
import { ShootBookingIdParamSchema, EntityIdSchema, AddShootAddOnSchema } from '../../validation/shoot-addon.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerShootAddOn(handle: HandleFn): void {
  handle('shootAddOn:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = ShootBookingIdParamSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return listShootAddOns(parsed.data.shootBookingId)
  })

  handle('shootAddOn:add', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = AddShootAddOnSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return addShootAddOn(parsed.data)
  })

  handle('shootAddOn:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = EntityIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteShootAddOn(parsed.data.id)
  })

  handle('shootAddOn:total', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = ShootBookingIdParamSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return getShootAddOnsTotal(parsed.data.shootBookingId)
  })
}
