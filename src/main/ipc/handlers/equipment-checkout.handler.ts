import { requirePermission } from '../permission-guard'
import {
  listEquipmentCheckouts,
  checkOutEquipment,
  returnEquipment,
  deleteEquipmentCheckout,
} from '../../services/equipment-checkout.service'
import { CheckOutEquipmentSchema, ReturnEquipmentSchema, EquipmentCheckoutIdSchema } from '../../validation/equipment-checkout.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerEquipmentCheckout(handle: HandleFn): void {
  handle('equipmentCheckout:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { fixedAssetId?: string; shootBookingId?: string; outstandingOnly?: boolean }
    return listEquipmentCheckouts(payload)
  })

  handle('equipmentCheckout:checkOut', async (raw) => {
    const deny = await requirePermission('shootProduction.manage'); if (deny) return deny
    const parsed = CheckOutEquipmentSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return checkOutEquipment(parsed.data)
  })

  handle('equipmentCheckout:return', async (raw) => {
    const deny = await requirePermission('shootProduction.manage'); if (deny) return deny
    const parsed = ReturnEquipmentSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return returnEquipment(parsed.data)
  })

  handle('equipmentCheckout:delete', async (raw) => {
    const deny = await requirePermission('shootProduction.manage'); if (deny) return deny
    const parsed = EquipmentCheckoutIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteEquipmentCheckout(parsed.data.id)
  })
}
