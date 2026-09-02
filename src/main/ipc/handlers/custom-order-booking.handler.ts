import { createCustomOrderBooking, listCustomOrderBookings, updateCustomOrderBookingStatus, deleteCustomOrderBooking, generateCustomOrderInvoice } from '../../services/custom-order-booking.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateCustomOrderBookingSchema, UpdateCustomOrderBookingStatusSchema } from '../../validation/custom-order-booking.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

// 2026-09 §12 — Bakery/Sweet Shop/Catering.
export function register(handle: HandleFn): void {
  handle('customOrderBooking:list', async (payload) => {
    const deny = await requirePermission('customOrderBooking.view'); if (deny) return deny
    return listCustomOrderBookings(payload as Parameters<typeof listCustomOrderBookings>[0])
  })

  handle('customOrderBooking:create', async (payload) => {
    const deny = await requirePermission('customOrderBooking.manage'); if (deny) return deny
    const parsed = CreateCustomOrderBookingSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return createCustomOrderBooking({ ...parsed.data, createdById: session?.userId })
  })

  handle('customOrderBooking:updateStatus', async (payload) => {
    const deny = await requirePermission('customOrderBooking.manage'); if (deny) return deny
    const parsed = UpdateCustomOrderBookingStatusSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateCustomOrderBookingStatus(parsed.data.id, parsed.data.status)
  })

  handle('customOrderBooking:delete', async (payload) => {
    const deny = await requirePermission('customOrderBooking.manage'); if (deny) return deny
    const { id } = payload as { id: string }
    return deleteCustomOrderBooking(id)
  })

  handle('customOrderBooking:generateInvoice', async (payload) => {
    const deny = await requirePermission('customOrderBooking.manage'); if (deny) return deny
    const { id } = payload as { id: string }
    const session = getCurrentSession()
    return generateCustomOrderInvoice(id, session?.userId)
  })
}
