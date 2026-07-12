import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { listVehicles, createVehicle, updateVehicle, deleteVehicle, updateVehicleStatus } from '../../services/logistics-vehicle.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerLogisticsVehicleHandlers(handle: HandleFn): void {
  handle('logisticsVehicle:list', async (raw) => {
    const deny = await requirePermission('logistics.view'); if (deny) return deny
    return listVehicles(raw as { status?: string; ownerType?: string; offset?: number; limit?: number })
  })

  handle('logisticsVehicle:create', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    return createVehicle(raw as Parameters<typeof createVehicle>[0], getCurrentSession()?.userId)
  })

  handle('logisticsVehicle:update', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    return updateVehicle(raw as Parameters<typeof updateVehicle>[0], getCurrentSession()?.userId)
  })

  handle('logisticsVehicle:delete', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    return deleteVehicle(raw as string, getCurrentSession()?.userId)
  })

  handle('logisticsVehicle:updateStatus', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    const p = raw as { id: string; status: string }
    return updateVehicleStatus(p.id, p.status, getCurrentSession()?.userId)
  })
}
