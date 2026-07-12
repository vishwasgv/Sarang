import { requirePermission } from '../permission-guard'
import {
  listEventBookings,
  createEventBooking,
  updateEventBooking,
  deleteEventBooking,
  getEventKPIs,
  generateEventInvoice,
} from '../../services/event-booking.service'
import { CreateEventBookingSchema, UpdateEventBookingSchema, EventBookingIdSchema } from '../../validation/event-booking.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerEventBooking(handle: HandleFn): void {
  handle('eventBooking:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { status?: string; search?: string }
    return listEventBookings(payload)
  })

  handle('eventBooking:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateEventBookingSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createEventBooking(parsed.data)
  })

  handle('eventBooking:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateEventBookingSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateEventBooking(parsed.data)
  })

  handle('eventBooking:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = EventBookingIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteEventBooking(parsed.data)
  })

  handle('eventBooking:kpis', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getEventKPIs()
  })

  handle('eventBooking:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = EventBookingIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return generateEventInvoice(parsed.data)
  })
}
