import { requirePermission } from '../permission-guard'
import {
  listEventBookings,
  createEventBooking,
  updateEventBooking,
  deleteEventBooking,
  getEventKPIs,
  generateEventInvoice,
} from '../../services/event-booking.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerEventBooking(handle: HandleFn): void {
  handle('eventBooking:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { status?: string; search?: string }
    return listEventBookings(payload)
  })

  handle('eventBooking:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return createEventBooking(raw as Parameters<typeof createEventBooking>[0])
  })

  handle('eventBooking:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return updateEventBooking(raw as Parameters<typeof updateEventBooking>[0])
  })

  handle('eventBooking:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return deleteEventBooking(raw as string)
  })

  handle('eventBooking:kpis', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getEventKPIs()
  })

  handle('eventBooking:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return generateEventInvoice(raw as string)
  })
}
