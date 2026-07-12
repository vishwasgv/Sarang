import { rentalService } from '../../services/rental.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import {
  CreateBookingSchema,
  CheckoutBookingSchema,
  ReturnBookingSchema,
  ExtendBookingSchema,
  CancelBookingSchema,
  GenerateRentalInvoiceSchema,
  CreateRentalUnitSchema,
  UpdateRentalUnitSchema,
  RentalUnitIdSchema,
} from '../../validation/rental.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('rental:checkAvailability', async (payload) => {
    const deny = await requirePermission('rental.view'); if (deny) return deny
    return rentalService.checkAvailability(payload as Parameters<typeof rentalService.checkAvailability>[0])
  })

  handle('rental:listBookings', async (payload) => {
    const deny = await requirePermission('rental.view'); if (deny) return deny
    return rentalService.listBookings(payload as Parameters<typeof rentalService.listBookings>[0])
  })

  handle('rental:getBooking', async (payload) => {
    const deny = await requirePermission('rental.view'); if (deny) return deny
    const { id } = payload as { id: string }
    return rentalService.getBooking(id)
  })

  handle('rental:createBooking', async (payload) => {
    const deny = await requirePermission('rental.manage'); if (deny) return deny
    const parsed = CreateBookingSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return rentalService.createBooking({ ...parsed.data, createdById: session?.userId })
  })

  handle('rental:checkoutBooking', async (payload) => {
    const deny = await requirePermission('rental.manage'); if (deny) return deny
    const parsed = CheckoutBookingSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return rentalService.checkoutBooking({ ...parsed.data, userId: session?.userId })
  })

  handle('rental:returnBooking', async (payload) => {
    const deny = await requirePermission('rental.manage'); if (deny) return deny
    const parsed = ReturnBookingSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return rentalService.returnBooking({ ...parsed.data, userId: session?.userId })
  })

  handle('rental:extendBooking', async (payload) => {
    const deny = await requirePermission('rental.manage'); if (deny) return deny
    const parsed = ExtendBookingSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return rentalService.extendBooking({ ...parsed.data, userId: session?.userId })
  })

  handle('rental:cancelBooking', async (payload) => {
    const deny = await requirePermission('rental.manage'); if (deny) return deny
    const parsed = CancelBookingSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return rentalService.cancelBooking({ ...parsed.data, userId: session?.userId })
  })

  handle('rental:generateInvoice', async (payload) => {
    const deny = await requirePermission('rental.manage'); if (deny) return deny
    const parsed = GenerateRentalInvoiceSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return rentalService.generateRentalInvoice(parsed.data.bookingId)
  })

  handle('rental:listUnits', async (payload) => {
    const deny = await requirePermission('rental.view'); if (deny) return deny
    return rentalService.listRentalUnits(payload as Parameters<typeof rentalService.listRentalUnits>[0])
  })

  handle('rental:createUnit', async (payload) => {
    const deny = await requirePermission('rental.manage'); if (deny) return deny
    const parsed = CreateRentalUnitSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return rentalService.createRentalUnit(parsed.data)
  })

  handle('rental:updateUnit', async (payload) => {
    const deny = await requirePermission('rental.manage'); if (deny) return deny
    const parsed = UpdateRentalUnitSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return rentalService.updateRentalUnit(parsed.data)
  })

  handle('rental:deleteUnit', async (payload) => {
    const deny = await requirePermission('rental.manage'); if (deny) return deny
    const parsed = RentalUnitIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return rentalService.deleteRentalUnit(parsed.data.id)
  })
}
