import { listWorkOrders, upsertWorkOrders, updateWorkOrderStatus } from '../../services/work-order.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('workOrders:list', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    const p = (payload ?? {}) as { productionOrderId: string }
    return listWorkOrders(p.productionOrderId)
  })

  handle('workOrders:upsert', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    return upsertWorkOrders(payload as Parameters<typeof upsertWorkOrders>[0], getCurrentSession()?.userId)
  })

  handle('workOrders:updateStatus', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    return updateWorkOrderStatus(payload as Parameters<typeof updateWorkOrderStatus>[0], getCurrentSession()?.userId)
  })
}
