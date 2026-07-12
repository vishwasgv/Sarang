import { hotelService } from '../../services/hotel.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import {
  CreateRoomSchema, UpdateRoomSchema, HotelRoomIdSchema,
  CheckAvailabilitySchema, ListAvailableRoomsSchema,
  CreateHotelBookingSchema, CheckInBookingSchema, HotelBookingIdSchema, CancelHotelBookingSchema,
  AddExtraChargeSchema, RemoveExtraChargeSchema, GenerateHotelInvoiceSchema, GuestRegisterSchema,
} from '../../validation/hotel.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('hotel:listRooms', async (payload) => {
    const deny = await requirePermission('hotel.view'); if (deny) return deny
    return hotelService.listRooms(payload as Parameters<typeof hotelService.listRooms>[0])
  })

  handle('hotel:createRoom', async (payload) => {
    const deny = await requirePermission('hotel.manage'); if (deny) return deny
    const parsed = CreateRoomSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return hotelService.createRoom(parsed.data)
  })

  handle('hotel:updateRoom', async (payload) => {
    const deny = await requirePermission('hotel.manage'); if (deny) return deny
    const parsed = UpdateRoomSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return hotelService.updateRoom(parsed.data)
  })

  handle('hotel:deleteRoom', async (payload) => {
    const deny = await requirePermission('hotel.manage'); if (deny) return deny
    const parsed = HotelRoomIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return hotelService.deleteRoom(parsed.data.id)
  })

  handle('hotel:checkAvailability', async (payload) => {
    const deny = await requirePermission('hotel.view'); if (deny) return deny
    const parsed = CheckAvailabilitySchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return hotelService.checkAvailability(parsed.data)
  })

  handle('hotel:listAvailableRooms', async (payload) => {
    const deny = await requirePermission('hotel.view'); if (deny) return deny
    const parsed = ListAvailableRoomsSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return hotelService.listAvailableRooms(parsed.data)
  })

  handle('hotel:listBookings', async (payload) => {
    const deny = await requirePermission('hotel.view'); if (deny) return deny
    return hotelService.listBookings(payload as Parameters<typeof hotelService.listBookings>[0])
  })

  handle('hotel:getBooking', async (payload) => {
    const deny = await requirePermission('hotel.view'); if (deny) return deny
    const parsed = HotelBookingIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return hotelService.getBooking(parsed.data.id)
  })

  handle('hotel:createBooking', async (payload) => {
    const deny = await requirePermission('hotel.manage'); if (deny) return deny
    const parsed = CreateHotelBookingSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return hotelService.createBooking({ ...parsed.data, createdById: session?.userId })
  })

  handle('hotel:checkIn', async (payload) => {
    const deny = await requirePermission('hotel.manage'); if (deny) return deny
    const parsed = CheckInBookingSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return hotelService.checkInBooking({ ...parsed.data, userId: session?.userId })
  })

  handle('hotel:checkOut', async (payload) => {
    const deny = await requirePermission('hotel.manage'); if (deny) return deny
    const parsed = HotelBookingIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return hotelService.checkOutBooking({ id: parsed.data.id, userId: session?.userId })
  })

  handle('hotel:cancelBooking', async (payload) => {
    const deny = await requirePermission('hotel.manage'); if (deny) return deny
    const parsed = CancelHotelBookingSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return hotelService.cancelBooking({ ...parsed.data, userId: session?.userId })
  })

  handle('hotel:markNoShow', async (payload) => {
    const deny = await requirePermission('hotel.manage'); if (deny) return deny
    const parsed = HotelBookingIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return hotelService.markNoShow({ id: parsed.data.id, userId: session?.userId })
  })

  handle('hotel:addExtraCharge', async (payload) => {
    const deny = await requirePermission('hotel.manage'); if (deny) return deny
    const parsed = AddExtraChargeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return hotelService.addExtraCharge({ ...parsed.data, userId: session?.userId })
  })

  handle('hotel:removeExtraCharge', async (payload) => {
    const deny = await requirePermission('hotel.manage'); if (deny) return deny
    const parsed = RemoveExtraChargeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return hotelService.removeExtraCharge({ ...parsed.data, userId: session?.userId })
  })

  handle('hotel:generateInvoice', async (payload) => {
    const deny = await requirePermission('hotel.manage'); if (deny) return deny
    const parsed = GenerateHotelInvoiceSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return hotelService.generateHotelInvoice(parsed.data.bookingId, session?.userId)
  })

  handle('hotel:occupancyReport', async () => {
    const deny = await requirePermission('hotel.view'); if (deny) return deny
    return hotelService.getOccupancyReport()
  })

  handle('hotel:guestRegister', async (payload) => {
    const deny = await requirePermission('hotel.view'); if (deny) return deny
    const parsed = GuestRegisterSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return hotelService.getGuestRegister(parsed.data)
  })
}
