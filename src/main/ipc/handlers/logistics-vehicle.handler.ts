import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { listVehicles, createVehicle, updateVehicle, deleteVehicle, updateVehicleStatus } from '../../services/logistics-vehicle.service'
import { CreateVehicleSchema, UpdateVehicleSchema, UpdateVehicleStatusSchema } from '../../validation/logistics-vehicle.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerLogisticsVehicleHandlers(handle: HandleFn): void {
  handle('logisticsVehicle:list', async (raw) => {
    const deny = await requirePermission('logistics.view'); if (deny) return deny
    return listVehicles(raw as { status?: string; ownerType?: string; offset?: number; limit?: number })
  })

  handle('logisticsVehicle:create', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    const parsed = CreateVehicleSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createVehicle(parsed.data, getCurrentSession()?.userId)
  })

  handle('logisticsVehicle:update', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    const parsed = UpdateVehicleSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateVehicle(parsed.data, getCurrentSession()?.userId)
  })

  handle('logisticsVehicle:delete', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    return deleteVehicle(raw as string, getCurrentSession()?.userId)
  })

  handle('logisticsVehicle:updateStatus', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    const parsed = UpdateVehicleStatusSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateVehicleStatus(parsed.data.id, parsed.data.status, getCurrentSession()?.userId)
  })
}
