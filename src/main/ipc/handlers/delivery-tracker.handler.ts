import { requirePermission } from '../permission-guard'
import { getDeliveryTracker, upsertDeliveryTracker } from '../../services/delivery-tracker.service'
import { UpsertDeliveryTrackerSchema } from '../../validation/delivery-tracker.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerDeliveryTracker(handle: HandleFn): void {
  handle('deliveryTracker:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getDeliveryTracker(raw as string)
  })

  handle('deliveryTracker:upsert', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpsertDeliveryTrackerSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return upsertDeliveryTracker(parsed.data)
  })
}
