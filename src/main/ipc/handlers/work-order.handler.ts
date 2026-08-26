import { listWorkOrders, upsertWorkOrders, updateWorkOrderStatus, logDowntime, listDowntimeEntries, getDowntimeSummary, getWorkOrderBottleneckFlag } from '../../services/work-order.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { UpsertWorkOrdersSchema, UpdateWorkOrderStatusSchema, LogDowntimeSchema } from '../../validation/work-order.validation'

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

  // Phase 67 §9.1 — Manufacturing item 1: machine/labour downtime capture.
  handle('workOrders:logDowntime', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    const parsed = LogDowntimeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return logDowntime(parsed.data, getCurrentSession()?.userId)
  })

  handle('workOrders:listDowntime', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    const p = (payload ?? {}) as { workOrderId: string }
    return listDowntimeEntries(p.workOrderId)
  })

  handle('workOrders:downtimeSummary', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    const p = (payload ?? {}) as { dateFrom?: string; dateTo?: string }
    return getDowntimeSummary(p)
  })

  // Phase 67 §9.1 — Manufacturing item 5: work-order lead-time bottleneck flag.
  handle('workOrders:bottleneckFlag', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    const p = (payload ?? {}) as { productId?: string; dateFrom?: string; dateTo?: string }
    return getWorkOrderBottleneckFlag(p)
  })
}
