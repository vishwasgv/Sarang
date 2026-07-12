import {
  listTailoringOrders, getTailoringOrder, createTailoringOrder, updateTailoringOrder,
  deleteTailoringOrder, generateTailoringInvoice, getTailoringKPIs
} from '../../services/tailoring-order.service'
import { requirePermission } from '../permission-guard'
import { CreateTailoringOrderSchema, UpdateTailoringOrderSchema, TailoringOrderIdSchema } from '../../validation/tailoring-order.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerTailoringOrder(handle: HandleFn): void {
  handle('tailoringOrder:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listTailoringOrders(raw as Parameters<typeof listTailoringOrders>[0])
  })

  handle('tailoringOrder:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getTailoringOrder(raw as string)
  })

  handle('tailoringOrder:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateTailoringOrderSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createTailoringOrder(parsed.data)
  })

  handle('tailoringOrder:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateTailoringOrderSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateTailoringOrder(parsed.data)
  })

  handle('tailoringOrder:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = TailoringOrderIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteTailoringOrder(parsed.data)
  })

  handle('tailoringOrder:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = TailoringOrderIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return generateTailoringInvoice(parsed.data)
  })

  handle('tailoringOrder:kpis', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getTailoringKPIs()
  })
}
