import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { listCarriers, createCarrier, updateCarrier, deleteCarrier, toggleCarrierActive } from '../../services/logistics-carrier.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerLogisticsCarrierHandlers(handle: HandleFn): void {
  handle('logisticsCarrier:list', async (raw) => {
    const deny = await requirePermission('logistics.view'); if (deny) return deny
    return listCarriers(raw as { activeOnly?: boolean; offset?: number; limit?: number })
  })

  handle('logisticsCarrier:create', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    return createCarrier(raw as Parameters<typeof createCarrier>[0], getCurrentSession()?.userId)
  })

  handle('logisticsCarrier:update', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    return updateCarrier(raw as Parameters<typeof updateCarrier>[0], getCurrentSession()?.userId)
  })

  handle('logisticsCarrier:delete', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    return deleteCarrier(raw as string, getCurrentSession()?.userId)
  })

  handle('logisticsCarrier:toggleActive', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    return toggleCarrierActive(raw as string, getCurrentSession()?.userId)
  })
}
