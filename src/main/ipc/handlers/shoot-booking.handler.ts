import { requirePermission } from '../permission-guard'
import {
  listShootBookings,
  getShootBooking,
  createShootBooking,
  updateShootBooking,
  deleteShootBooking,
  getShootKPIs,
  generateShootInvoice,
} from '../../services/shoot-booking.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerShootBooking(handle: HandleFn): void {
  handle('shootBooking:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { status?: string; clientId?: string; search?: string }
    return listShootBookings(payload)
  })

  handle('shootBooking:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getShootBooking(raw as string)
  })

  handle('shootBooking:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return createShootBooking(raw as Parameters<typeof createShootBooking>[0])
  })

  handle('shootBooking:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return updateShootBooking(raw as Parameters<typeof updateShootBooking>[0])
  })

  handle('shootBooking:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return deleteShootBooking(raw as string)
  })

  handle('shootBooking:kpis', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getShootKPIs()
  })

  handle('shootBooking:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return generateShootInvoice(raw as string)
  })
}
