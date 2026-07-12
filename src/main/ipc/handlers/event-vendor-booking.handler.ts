import { requirePermission } from '../permission-guard'
import {
  listVendorBookings,
  createVendorBooking,
  updateVendorBooking,
  deleteVendorBooking,
} from '../../services/event-vendor-booking.service'
import { CreateVendorBookingSchema, UpdateVendorBookingSchema, VendorBookingIdSchema } from '../../validation/event-vendor-booking.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerEventVendorBooking(handle: HandleFn): void {
  handle('eventVendorBooking:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listVendorBookings(raw as string)
  })

  handle('eventVendorBooking:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateVendorBookingSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createVendorBooking(parsed.data)
  })

  handle('eventVendorBooking:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateVendorBookingSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateVendorBooking(parsed.data)
  })

  handle('eventVendorBooking:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = VendorBookingIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteVendorBooking(parsed.data)
  })
}
