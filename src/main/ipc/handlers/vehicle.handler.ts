import { vehicleService } from '../../services/vehicle.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateVehicleSchema, UpdateVehicleStatusSchema, CreateVehicleServiceLogSchema } from '../../validation/vehicle.validation'
import { DateRangeSchema } from '../../validation/report.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

// 2026-09 §12 — Tours & Travels: fleet + service log + availability calendar.
export function register(handle: HandleFn): void {
  handle('vehicle:list', async (payload) => {
    const deny = await requirePermission('vehicle.view'); if (deny) return deny
    return vehicleService.listVehicles(payload as Parameters<typeof vehicleService.listVehicles>[0])
  })

  handle('vehicle:create', async (payload) => {
    const deny = await requirePermission('vehicle.manage'); if (deny) return deny
    const parsed = CreateVehicleSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return vehicleService.createVehicle(parsed.data)
  })

  handle('vehicle:updateStatus', async (payload) => {
    const deny = await requirePermission('vehicle.manage'); if (deny) return deny
    const parsed = UpdateVehicleStatusSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return vehicleService.updateVehicleStatus(parsed.data.id, parsed.data.status)
  })

  handle('vehicle:delete', async (payload) => {
    const deny = await requirePermission('vehicle.manage'); if (deny) return deny
    const { id } = payload as { id: string }
    return vehicleService.deleteVehicle(id)
  })

  handle('vehicle:createServiceLog', async (payload) => {
    const deny = await requirePermission('vehicle.manage'); if (deny) return deny
    const parsed = CreateVehicleServiceLogSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return vehicleService.createVehicleServiceLog({ ...parsed.data, createdById: session?.userId })
  })

  handle('vehicle:listServiceLogs', async (payload) => {
    const deny = await requirePermission('vehicle.view'); if (deny) return deny
    const { vehicleId } = (payload ?? {}) as { vehicleId?: string }
    return vehicleService.listVehicleServiceLogs(vehicleId)
  })

  // Signature item 1 — Fleet & Seat Availability Calendar.
  handle('vehicle:fleetAvailability', async (payload) => {
    const deny = await requirePermission('vehicle.view'); if (deny) return deny
    const parsed = DateRangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    return vehicleService.getFleetAndSeatAvailability(parsed.data)
  })
}
