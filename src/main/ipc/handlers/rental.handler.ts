import { rentalService } from '../../services/rental.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

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
    const session = getCurrentSession()
    return rentalService.createBooking({ ...(payload as Parameters<typeof rentalService.createBooking>[0]), createdById: session?.userId })
  })

  handle('rental:checkoutBooking', async (payload) => {
    const deny = await requirePermission('rental.manage'); if (deny) return deny
    const session = getCurrentSession()
    return rentalService.checkoutBooking({ ...(payload as Parameters<typeof rentalService.checkoutBooking>[0]), userId: session?.userId })
  })

  handle('rental:returnBooking', async (payload) => {
    const deny = await requirePermission('rental.manage'); if (deny) return deny
    const session = getCurrentSession()
    return rentalService.returnBooking({ ...(payload as Parameters<typeof rentalService.returnBooking>[0]), userId: session?.userId })
  })

  handle('rental:extendBooking', async (payload) => {
    const deny = await requirePermission('rental.manage'); if (deny) return deny
    const session = getCurrentSession()
    return rentalService.extendBooking({ ...(payload as Parameters<typeof rentalService.extendBooking>[0]), userId: session?.userId })
  })

  handle('rental:cancelBooking', async (payload) => {
    const deny = await requirePermission('rental.manage'); if (deny) return deny
    const session = getCurrentSession()
    return rentalService.cancelBooking({ ...(payload as Parameters<typeof rentalService.cancelBooking>[0]), userId: session?.userId })
  })

  handle('rental:generateInvoice', async (payload) => {
    const deny = await requirePermission('rental.manage'); if (deny) return deny
    const { bookingId } = payload as { bookingId: string }
    return rentalService.generateRentalInvoice(bookingId)
  })

  handle('rental:listUnits', async (payload) => {
    const deny = await requirePermission('rental.view'); if (deny) return deny
    return rentalService.listRentalUnits(payload as Parameters<typeof rentalService.listRentalUnits>[0])
  })

  handle('rental:createUnit', async (payload) => {
    const deny = await requirePermission('rental.manage'); if (deny) return deny
    return rentalService.createRentalUnit(payload as Parameters<typeof rentalService.createRentalUnit>[0])
  })

  handle('rental:updateUnit', async (payload) => {
    const deny = await requirePermission('rental.manage'); if (deny) return deny
    return rentalService.updateRentalUnit(payload as Parameters<typeof rentalService.updateRentalUnit>[0])
  })

  handle('rental:deleteUnit', async (payload) => {
    const deny = await requirePermission('rental.manage'); if (deny) return deny
    const { id } = payload as { id: string }
    return rentalService.deleteRentalUnit(id)
  })
}
