import { createFurnitureBooking, listFurnitureBookings, updateFurnitureBookingStatus, deleteFurnitureBooking, generateFurnitureInvoice, getBookedOrderCashFlowForecast } from '../../services/furniture-booking.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateFurnitureBookingSchema, UpdateFurnitureBookingStatusSchema } from '../../validation/furniture-booking.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('furnitureBooking:list', async (payload) => {
    const deny = await requirePermission('furnitureBooking.view'); if (deny) return deny
    return listFurnitureBookings(payload as Parameters<typeof listFurnitureBookings>[0])
  })

  handle('furnitureBooking:create', async (payload) => {
    const deny = await requirePermission('furnitureBooking.manage'); if (deny) return deny
    const parsed = CreateFurnitureBookingSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return createFurnitureBooking({ ...parsed.data, createdById: session?.userId })
  })

  handle('furnitureBooking:updateStatus', async (payload) => {
    const deny = await requirePermission('furnitureBooking.manage'); if (deny) return deny
    const parsed = UpdateFurnitureBookingStatusSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateFurnitureBookingStatus(parsed.data.id, parsed.data.status)
  })

  handle('furnitureBooking:delete', async (payload) => {
    const deny = await requirePermission('furnitureBooking.manage'); if (deny) return deny
    const { id } = payload as { id: string }
    return deleteFurnitureBooking(id)
  })

  handle('furnitureBooking:generateInvoice', async (payload) => {
    const deny = await requirePermission('furnitureBooking.manage'); if (deny) return deny
    const { id } = payload as { id: string }
    const session = getCurrentSession()
    return generateFurnitureInvoice(id, session?.userId)
  })

  // Phase 69 — Furniture wow feature: Booked-Order Cash Flow Forecast.
  handle('furnitureBooking:cashFlowForecast', async () => {
    const deny = await requirePermission('furnitureBooking.view'); if (deny) return deny
    return getBookedOrderCashFlowForecast()
  })
}
