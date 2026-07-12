import { requirePermission } from '../permission-guard'
import { getDeliveryTracker, upsertDeliveryTracker } from '../../services/delivery-tracker.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerDeliveryTracker(handle: HandleFn): void {
  handle('deliveryTracker:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getDeliveryTracker(raw as string)
  })

  handle('deliveryTracker:upsert', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return upsertDeliveryTracker(raw as Parameters<typeof upsertDeliveryTracker>[0])
  })
}
