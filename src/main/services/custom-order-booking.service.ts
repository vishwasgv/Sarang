import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { generateSequenceNumber } from './sequence.service'
import { billingService } from './billing.service'
import { sumCurrency } from './currency.service'
import { parseLocalDateStart } from '../utils/date.util'

// 2026-09 §12 — Bakery/Sweet Shop/Catering vertical: custom order booking
// (a custom cake, for example) with an advance now, balance on pickup/
// delivery. Direct structural mirror of furniture-booking.service.ts's
// deposit/balance-booking pattern — same claim-sentinel invoice-generation
// shape, same "booking items already reference real Products" reasoning.

const CUSTOM_ORDER_INVOICE_CLAIM_SENTINEL = 'CLAIMING'

export async function createCustomOrderBooking(payload: {
  customerId: string
  dueDate?: string
  deliveryAddress?: string
  advanceAmount?: number
  advancePaymentMethod?: 'CASH' | 'UPI' | 'CARD' | 'WALLET'
  notes?: string
  createdById?: string
  items: Array<{
    productId: string
    quantity: number
    unitPrice: number
    customFlavor?: string
    customSize?: string
    customMessage?: string
    customDesign?: string
  }>
}) {
  try {
    if (!payload.items || payload.items.length === 0) {
      return { success: false, error: { code: 'COB-001', message: 'At least one item is required.' } }
    }
    const db = getPrisma()
    const customer = await db.customer.findUnique({ where: { id: payload.customerId } })
    if (!customer) return { success: false, error: { code: 'COB-002', message: 'Customer not found.' } }

    const advanceAmount = payload.advanceAmount ?? 0
    if (advanceAmount < 0) {
      return { success: false, error: { code: 'COB-003', message: 'Advance amount cannot be negative.' } }
    }
    const bookingTotal = sumCurrency(payload.items.map(i => i.quantity * i.unitPrice))
    if (advanceAmount > bookingTotal) {
      return { success: false, error: { code: 'COB-004', message: 'Advance cannot exceed the order total.' } }
    }

    const booking = await db.$transaction(async (tx) => {
      const bookingNumber = await generateSequenceNumber(
        tx, 'custom_order_booking_number_sequence', 'COB', 5,
        async () => {
          const last = await tx.customOrderBooking.findFirst({ orderBy: { createdAt: 'desc' }, select: { bookingNumber: true } })
          return last ? parseInt(last.bookingNumber.replace('COB-', ''), 10) : 0
        }
      )
      return tx.customOrderBooking.create({
        data: {
          bookingNumber,
          customerId: payload.customerId,
          dueDate: payload.dueDate ? parseLocalDateStart(payload.dueDate) : null,
          deliveryAddress: payload.deliveryAddress ?? null,
          advanceAmount,
          advancePaymentMethod: payload.advancePaymentMethod ?? 'CASH',
          notes: payload.notes ?? null,
          createdById: payload.createdById ?? null,
          items: {
            create: payload.items.map(i => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              customFlavor: i.customFlavor ?? null,
              customSize: i.customSize ?? null,
              customMessage: i.customMessage ?? null,
              customDesign: i.customDesign ?? null,
            })),
          },
        },
        include: { items: { include: { product: { select: { id: true, productName: true } } } }, customer: { select: { id: true, customerName: true, phone: true } } },
      })
    })

    await logAction({ userId: payload.createdById, action: 'CUSTOM_ORDER_BOOKING_CREATED', entityType: 'CustomOrderBooking', entityId: booking.id, newValue: { bookingNumber: booking.bookingNumber, advanceAmount } })
    return { success: true, data: booking }
  } catch (err) {
    return { success: false, error: { code: 'COB-005', message: err instanceof Error ? err.message : 'Could not create order.' } }
  }
}

export async function listCustomOrderBookings(filters?: { customerId?: string; status?: string }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.customerId) where.customerId = filters.customerId
    if (filters?.status) where.status = filters.status
    const bookings = await db.customOrderBooking.findMany({
      where,
      include: { items: { include: { product: { select: { id: true, productName: true } } } }, customer: { select: { id: true, customerName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: bookings }
  } catch (err) {
    return { success: false, error: { code: 'COB-006', message: err instanceof Error ? err.message : 'Could not list orders.' } }
  }
}

export async function updateCustomOrderBookingStatus(id: string, status: 'BOOKED' | 'DELIVERED' | 'CANCELLED') {
  try {
    const db = getPrisma()
    const existing = await db.customOrderBooking.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'COB-007', message: 'Order not found.' } }
    const updated = await db.customOrderBooking.update({ where: { id }, data: { status } })
    await logAction({ action: 'CUSTOM_ORDER_BOOKING_STATUS_UPDATED', entityType: 'CustomOrderBooking', entityId: id, newValue: { status } })
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'COB-008', message: err instanceof Error ? err.message : 'Could not update order status.' } }
  }
}

export async function deleteCustomOrderBooking(id: string) {
  try {
    const db = getPrisma()
    const existing = await db.customOrderBooking.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'COB-007', message: 'Order not found.' } }
    if (existing.invoiceId) return { success: false, error: { code: 'COB-009', message: 'Cannot delete an order that has already been invoiced.' } }
    await db.customOrderBooking.delete({ where: { id } })
    await logAction({ action: 'CUSTOM_ORDER_BOOKING_DELETED', entityType: 'CustomOrderBooking', entityId: id })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'COB-010', message: err instanceof Error ? err.message : 'Could not delete order.' } }
  }
}

// Same atomic claim-sentinel + billingService.createInvoice() pattern as
// furniture-booking.service.ts's generateFurnitureInvoice.
export async function generateCustomOrderInvoice(bookingId: string, userId?: string): Promise<{ success: boolean; data?: { invoiceId: string }; error?: { code: string; message: string } }> {
  const db = getPrisma()
  try {
    const claim = await db.customOrderBooking.updateMany({ where: { id: bookingId, invoiceId: null }, data: { invoiceId: CUSTOM_ORDER_INVOICE_CLAIM_SENTINEL } })
    if (claim.count === 0) {
      const existing = await db.customOrderBooking.findUnique({ where: { id: bookingId }, select: { id: true, invoiceId: true } })
      if (!existing) return { success: false, error: { code: 'COB-007', message: 'Order not found.' } }
      if (existing.invoiceId === CUSTOM_ORDER_INVOICE_CLAIM_SENTINEL) return { success: false, error: { code: 'COB-011', message: 'Invoice generation already in progress for this order.' } }
      return { success: false, error: { code: 'COB-012', message: 'An invoice has already been generated for this order.' } }
    }

    try {
      const booking = await db.customOrderBooking.findUnique({ where: { id: bookingId }, include: { items: true } })
      if (!booking) {
        await db.customOrderBooking.update({ where: { id: bookingId }, data: { invoiceId: null } })
        return { success: false, error: { code: 'COB-007', message: 'Order not found.' } }
      }

      const invoiceItems = booking.items.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice }))
      const result = await billingService.createInvoice({
        customerId: booking.customerId,
        paymentMethod: 'CREDIT',
        items: invoiceItems,
        notes: `Custom order ${booking.bookingNumber}`,
        referenceNumber: booking.bookingNumber,
      })
      if (!result.success) {
        await db.customOrderBooking.update({ where: { id: bookingId }, data: { invoiceId: null } })
        return result as { success: false; error: { code: string; message: string } }
      }

      const invoice = result.data as { id: string; totalAmount: number }
      await db.customOrderBooking.update({ where: { id: bookingId }, data: { invoiceId: invoice.id, status: 'DELIVERED' } })

      if (booking.advanceAmount > 0) {
        const { paymentService } = await import('./payment.service')
        await paymentService.recordPayment({
          invoiceId: invoice.id,
          paymentMethod: booking.advancePaymentMethod as 'CASH' | 'UPI' | 'CARD' | 'WALLET',
          amount: Math.min(booking.advanceAmount, invoice.totalAmount),
        }, userId)
      }

      await logAction({ userId, action: 'CUSTOM_ORDER_BOOKING_INVOICED', entityType: 'CustomOrderBooking', entityId: bookingId, newValue: { invoiceId: invoice.id } })
      return { success: true, data: { invoiceId: invoice.id } }
    } catch (err) {
      await db.customOrderBooking.update({ where: { id: bookingId }, data: { invoiceId: null } }).catch(() => {})
      throw err
    }
  } catch (e) {
    return { success: false, error: { code: 'COB-013', message: e instanceof Error ? e.message : 'Could not generate invoice.' } }
  }
}

export const customOrderBookingService = {
  createCustomOrderBooking,
  listCustomOrderBookings,
  updateCustomOrderBookingStatus,
  deleteCustomOrderBooking,
  generateCustomOrderInvoice,
}
