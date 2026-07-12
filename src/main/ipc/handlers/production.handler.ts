import {
  listProductionOrders,
  getProductionOrder,
  createProductionOrder,
  startProductionOrder,
  completeProductionOrder,
  cancelProductionOrder
} from '../../services/production-order.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('production:list', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    return listProductionOrders(payload as Parameters<typeof listProductionOrders>[0])
  })

  handle('production:get', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    const p = (payload ?? {}) as { id: string }
    return getProductionOrder(p.id)
  })

  handle('production:create', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    return createProductionOrder(payload as Parameters<typeof createProductionOrder>[0], getCurrentSession()?.userId)
  })

  handle('production:start', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    const p = (payload ?? {}) as { id: string }
    return startProductionOrder(p.id, getCurrentSession()?.userId)
  })

  handle('production:complete', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    return completeProductionOrder(payload as Parameters<typeof completeProductionOrder>[0], getCurrentSession()?.userId)
  })

  handle('production:cancel', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    return cancelProductionOrder(payload as Parameters<typeof cancelProductionOrder>[0], getCurrentSession()?.userId)
  })
}
