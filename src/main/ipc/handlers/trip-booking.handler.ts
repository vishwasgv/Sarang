import { tripBookingService } from '../../services/trip-booking.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateCharterBookingSchema, CreateSeatBookingSchema, UpdateTripBookingStatusSchema } from '../../validation/trip-booking.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

// 2026-09 §12 — Tours & Travels: dual booking modes (CHARTER + SEAT).
export function register(handle: HandleFn): void {
  handle('tripBooking:list', async (payload) => {
    const deny = await requirePermission('tripBooking.view'); if (deny) return deny
    return tripBookingService.listTripBookings(payload as Parameters<typeof tripBookingService.listTripBookings>[0])
  })

  handle('tripBooking:createCharter', async (payload) => {
    const deny = await requirePermission('tripBooking.manage'); if (deny) return deny
    const parsed = CreateCharterBookingSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return tripBookingService.createCharterBooking({ ...parsed.data, createdById: session?.userId })
  })

  handle('tripBooking:createSeat', async (payload) => {
    const deny = await requirePermission('tripBooking.manage'); if (deny) return deny
    const parsed = CreateSeatBookingSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return tripBookingService.createSeatBooking({ ...parsed.data, createdById: session?.userId })
  })

  handle('tripBooking:updateStatus', async (payload) => {
    const deny = await requirePermission('tripBooking.manage'); if (deny) return deny
    const parsed = UpdateTripBookingStatusSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return tripBookingService.updateTripBookingStatus(parsed.data.id, parsed.data.status)
  })

  handle('tripBooking:generateInvoice', async (payload) => {
    const deny = await requirePermission('tripBooking.manage'); if (deny) return deny
    const { id } = payload as { id: string }
    const session = getCurrentSession()
    return tripBookingService.generateTripInvoice(id, session?.userId)
  })
}
