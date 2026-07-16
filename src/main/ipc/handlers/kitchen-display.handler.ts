import { requirePermission } from '../permission-guard'
import {
  listSecondaryDisplays, openKitchenDisplayWindow, closeKitchenDisplayWindow, getKitchenDisplayWindowStatus
} from '../../windows/kitchen-display-window'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

// Second-monitor Kitchen Display window management — gated on
// restaurant.manageTables, the same admin-level permission the QR-ordering
// toggle (a comparable "configure a restaurant hardware surface" action) uses.
export function register(handle: HandleFn): void {
  handle('kitchenDisplay:listDisplays', async () => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    return { success: true, data: listSecondaryDisplays() }
  })

  handle('kitchenDisplay:open', async (payload) => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    const { displayId } = (payload ?? {}) as { displayId?: number }
    return openKitchenDisplayWindow(displayId)
  })

  handle('kitchenDisplay:close', async () => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    closeKitchenDisplayWindow()
    return { success: true }
  })

  handle('kitchenDisplay:getStatus', async () => {
    const deny = await requirePermission('restaurant.manageTables'); if (deny) return deny
    return { success: true, data: getKitchenDisplayWindowStatus() }
  })
}
