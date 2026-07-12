import { listWorkOrders, upsertWorkOrders, updateWorkOrderStatus } from '../../services/work-order.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { UpsertWorkOrdersSchema, UpdateWorkOrderStatusSchema } from '../../validation/work-order.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('workOrders:list', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    const p = (payload ?? {}) as { productionOrderId: string }
    return listWorkOrders(p.productionOrderId)
  })

  handle('workOrders:upsert', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    const parsed = UpsertWorkOrdersSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return upsertWorkOrders(parsed.data, getCurrentSession()?.userId)
  })

  handle('workOrders:updateStatus', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    const parsed = UpdateWorkOrderStatusSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateWorkOrderStatus(parsed.data, getCurrentSession()?.userId)
  })
}
