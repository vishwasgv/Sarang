import { requirePermission } from '../permission-guard'
import { getDeliveryTracker, upsertDeliveryTracker, incrementRevisionRound } from '../../services/delivery-tracker.service'
import { UpsertDeliveryTrackerSchema } from '../../validation/delivery-tracker.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerDeliveryTracker(handle: HandleFn): void {
  handle('deliveryTracker:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getDeliveryTracker(raw as string)
  })

  handle('deliveryTracker:upsert', async (raw) => {
    const deny = await requirePermission('shootProduction.manage'); if (deny) return deny
    const parsed = UpsertDeliveryTrackerSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return upsertDeliveryTracker(parsed.data)
  })

  handle('deliveryTracker:incrementRevision', async (raw) => {
    const deny = await requirePermission('shootProduction.manage'); if (deny) return deny
    const shootBookingId = raw as string
    if (!shootBookingId) return { success: false, error: { code: 'VAL-001', message: 'Shoot booking ID is required.' } }
    return incrementRevisionRound(shootBookingId)
  })
}
