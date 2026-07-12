import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { listCarriers, createCarrier, updateCarrier, deleteCarrier, toggleCarrierActive } from '../../services/logistics-carrier.service'
import { CreateCarrierSchema, UpdateCarrierSchema } from '../../validation/logistics-carrier.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerLogisticsCarrierHandlers(handle: HandleFn): void {
  handle('logisticsCarrier:list', async (raw) => {
    const deny = await requirePermission('logistics.view'); if (deny) return deny
    return listCarriers(raw as { activeOnly?: boolean; offset?: number; limit?: number })
  })

  handle('logisticsCarrier:create', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    const parsed = CreateCarrierSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createCarrier(parsed.data, getCurrentSession()?.userId)
  })

  handle('logisticsCarrier:update', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    const parsed = UpdateCarrierSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateCarrier(parsed.data, getCurrentSession()?.userId)
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
