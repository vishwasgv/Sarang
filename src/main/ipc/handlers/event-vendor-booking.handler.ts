import { requirePermission } from '../permission-guard'
import {
  listVendorBookings,
  createVendorBooking,
  updateVendorBooking,
  deleteVendorBooking,
} from '../../services/event-vendor-booking.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerEventVendorBooking(handle: HandleFn): void {
  handle('eventVendorBooking:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listVendorBookings(raw as string)
  })

  handle('eventVendorBooking:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return createVendorBooking(raw as Parameters<typeof createVendorBooking>[0])
  })

  handle('eventVendorBooking:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return updateVendorBooking(raw as Parameters<typeof updateVendorBooking>[0])
  })

  handle('eventVendorBooking:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return deleteVendorBooking(raw as string)
  })
}
