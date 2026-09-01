import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { generateSequenceNumber } from './sequence.service'
import { billingService } from './billing.service'
import { roundCurrency, sumCurrency } from './currency.service'
import { parseLocalDateStart } from '../utils/date.util'

// Furniture vertical — deposit + balance booking. Mirrors hotel.service.ts's
// generateHotelInvoice advance/invoice-at-completion pattern, but booking
// items already reference real Products (not invented placeholder lines),
// so the invoice is built directly from FurnitureBookingItem rows.

const FURNITURE_BOOKING_INVOICE_CLAIM_SENTINEL = 'CLAIMING'

export async function createFurnitureBooking(payload: {
  customerId: string
  deliveryDate?: string
  deliveryAddress?: string
  advanceAmount?: number
  advancePaymentMethod?: 'CASH' | 'UPI' | 'CARD' | 'WALLET'
  notes?: string
  createdById?: string
  items: Array<{
    productId: string
    quantity: number
    unitPrice: number
    customFabric?: string
    customColor?: string
    customDimensions?: string
    customFinish?: string
  }>
}) {
  try {
    if (!payload.items || payload.items.length === 0) {
      return { success: false, error: { code: 'FBK-001', message: 'At least one item is required.' } }
    }
    const db = getPrisma()
    const customer = await db.customer.findUnique({ where: { id: payload.customerId } })
    if (!customer) return { success: false, error: { code: 'FBK-002', message: 'Customer not found.' } }

    const advanceAmount = payload.advanceAmount ?? 0
    if (advanceAmount < 0) {
      return { success: false, error: { code: 'FBK-003', message: 'Advance amount cannot be negative.' } }
    }
    const bookingTotal = sumCurrency(payload.items.map(i => i.quantity * i.unitPrice))
    if (advanceAmount > bookingTotal) {
      return { success: false, error: { code: 'FBK-004', message: 'Advance cannot exceed the booking total.' } }
    }

    const booking = await db.$transaction(async (tx) => {
      const bookingNumber = await generateSequenceNumber(
        tx, 'furniture_booking_number_sequence', 'FBK', 5,
        async () => {
          const last = await tx.furnitureBooking.findFirst({ orderBy: { createdAt: 'desc' }, select: { bookingNumber: true } })
          return last ? parseInt(last.bookingNumber.replace('FBK-', ''), 10) : 0
        }
      )
      return tx.furnitureBooking.create({
        data: {
          bookingNumber,
          customerId: payload.customerId,
          deliveryDate: payload.deliveryDate ? parseLocalDateStart(payload.deliveryDate) : null,
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
              customFabric: i.customFabric ?? null,
              customColor: i.customColor ?? null,
              customDimensions: i.customDimensions ?? null,
              customFinish: i.customFinish ?? null,
            })),
          },
        },
        include: { items: { include: { product: { select: { id: true, productName: true } } } }, customer: { select: { id: true, customerName: true, phone: true } } },
      })
    })

    await logAction({ userId: payload.createdById, action: 'FURNITURE_BOOKING_CREATED', entityType: 'FurnitureBooking', entityId: booking.id, newValue: { bookingNumber: booking.bookingNumber, advanceAmount } })
    return { success: true, data: booking }
  } catch (err) {
    return { success: false, error: { code: 'FBK-005', message: err instanceof Error ? err.message : 'Could not create booking.' } }
  }
}

export async function listFurnitureBookings(filters?: { customerId?: string; status?: string }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.customerId) where.customerId = filters.customerId
    if (filters?.status) where.status = filters.status
    const bookings = await db.furnitureBooking.findMany({
      where,
      include: { items: { include: { product: { select: { id: true, productName: true } } } }, customer: { select: { id: true, customerName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: bookings }
  } catch (err) {
    return { success: false, error: { code: 'FBK-006', message: err instanceof Error ? err.message : 'Could not list bookings.' } }
  }
}

export async function updateFurnitureBookingStatus(id: string, status: 'BOOKED' | 'DELIVERED' | 'CANCELLED') {
  try {
    const db = getPrisma()
    const existing = await db.furnitureBooking.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'FBK-007', message: 'Booking not found.' } }
    const updated = await db.furnitureBooking.update({ where: { id }, data: { status } })
    await logAction({ action: 'FURNITURE_BOOKING_STATUS_UPDATED', entityType: 'FurnitureBooking', entityId: id, newValue: { status } })
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'FBK-008', message: err instanceof Error ? err.message : 'Could not update booking status.' } }
  }
}

export async function deleteFurnitureBooking(id: string) {
  try {
    const db = getPrisma()
    const existing = await db.furnitureBooking.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'FBK-007', message: 'Booking not found.' } }
    if (existing.invoiceId) return { success: false, error: { code: 'FBK-009', message: 'Cannot delete a booking that has already been invoiced.' } }
    await db.furnitureBooking.delete({ where: { id } })
    await logAction({ action: 'FURNITURE_BOOKING_DELETED', entityType: 'FurnitureBooking', entityId: id })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'FBK-010', message: err instanceof Error ? err.message : 'Could not delete booking.' } }
  }
}

// Furniture wow feature — Booked-Order Cash Flow Forecast. Projects
// expected incoming cash from every still-BOOKED, not-yet-invoiced booking's
// balance due (booking total minus the advance already collected), bucketed
// by expected delivery month — a forward view of "how much is coming in and
// when," not just today's advance total.
export interface CashFlowForecastMonthRow {
  month: string; bookingCount: number; expectedBalanceDue: number
}

export async function getBookedOrderCashFlowForecast() {
  try {
    const db = getPrisma()
    const bookings = await db.furnitureBooking.findMany({
      where: { status: 'BOOKED', invoiceId: null },
      include: { items: true }
    })

    const byMonth = new Map<string, number[]>()
    const unscheduled: number[] = []
    for (const b of bookings) {
      const bookingTotal = sumCurrency(b.items.map(i => i.quantity * i.unitPrice))
      const balanceDue = Math.max(0, roundCurrency(bookingTotal - b.advanceAmount))
      const key = b.deliveryDate ? `${b.deliveryDate.getFullYear()}-${String(b.deliveryDate.getMonth() + 1).padStart(2, '0')}` : null
      const bucket = key ? (byMonth.get(key) ?? []) : unscheduled
      bucket.push(balanceDue)
      if (key) byMonth.set(key, bucket)
    }

    const rows: CashFlowForecastMonthRow[] = Array.from(byMonth.entries())
      .map(([month, values]) => ({ month, bookingCount: values.length, expectedBalanceDue: sumCurrency(values) }))
      .sort((a, b) => a.month.localeCompare(b.month))
    if (unscheduled.length > 0) {
      rows.push({ month: 'Unscheduled', bookingCount: unscheduled.length, expectedBalanceDue: sumCurrency(unscheduled) })
    }

    return {
      success: true,
      data: { rows, summary: { totalBookings: bookings.length, totalExpectedBalanceDue: sumCurrency(rows.map(r => r.expectedBalanceDue)) } }
    }
  } catch (err) {
    return { success: false, error: { code: 'FBK-014', message: err instanceof Error ? err.message : 'Could not compute cash flow forecast.' } }
  }
}

// Same atomic claim-sentinel + billingService.createInvoice() pattern as
// hotel.service.ts's generateHotelInvoice — see that function's own header
// comment for why the claim/rollback shape looks the way it does.
export async function generateFurnitureInvoice(bookingId: string, userId?: string): Promise<{ success: boolean; data?: { invoiceId: string }; error?: { code: string; message: string } }> {
  const db = getPrisma()
  try {
    const claim = await db.furnitureBooking.updateMany({ where: { id: bookingId, invoiceId: null }, data: { invoiceId: FURNITURE_BOOKING_INVOICE_CLAIM_SENTINEL } })
    if (claim.count === 0) {
      const existing = await db.furnitureBooking.findUnique({ where: { id: bookingId }, select: { id: true, invoiceId: true } })
      if (!existing) return { success: false, error: { code: 'FBK-007', message: 'Booking not found.' } }
      if (existing.invoiceId === FURNITURE_BOOKING_INVOICE_CLAIM_SENTINEL) return { success: false, error: { code: 'FBK-011', message: 'Invoice generation already in progress for this booking.' } }
      return { success: false, error: { code: 'FBK-012', message: 'An invoice has already been generated for this booking.' } }
    }

    try {
      const booking = await db.furnitureBooking.findUnique({ where: { id: bookingId }, include: { items: true } })
      if (!booking) {
        await db.furnitureBooking.update({ where: { id: bookingId }, data: { invoiceId: null } })
        return { success: false, error: { code: 'FBK-007', message: 'Booking not found.' } }
      }

      const invoiceItems = booking.items.map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice }))
      const result = await billingService.createInvoice({
        customerId: booking.customerId,
        paymentMethod: 'CREDIT',
        items: invoiceItems,
        notes: `Furniture booking ${booking.bookingNumber}`,
        referenceNumber: booking.bookingNumber,
      })
      if (!result.success) {
        await db.furnitureBooking.update({ where: { id: bookingId }, data: { invoiceId: null } })
        return result as { success: false; error: { code: string; message: string } }
      }

      const invoice = result.data as { id: string; totalAmount: number }
      await db.furnitureBooking.update({ where: { id: bookingId }, data: { invoiceId: invoice.id, status: 'DELIVERED' } })

      if (booking.advanceAmount > 0) {
        const { paymentService } = await import('./payment.service')
        await paymentService.recordPayment({
          invoiceId: invoice.id,
          paymentMethod: booking.advancePaymentMethod as 'CASH' | 'UPI' | 'CARD' | 'WALLET',
          amount: Math.min(booking.advanceAmount, invoice.totalAmount),
        }, userId)
      }

      await logAction({ userId, action: 'FURNITURE_BOOKING_INVOICED', entityType: 'FurnitureBooking', entityId: bookingId, newValue: { invoiceId: invoice.id } })
      return { success: true, data: { invoiceId: invoice.id } }
    } catch (err) {
      await db.furnitureBooking.update({ where: { id: bookingId }, data: { invoiceId: null } }).catch(() => {})
      throw err
    }
  } catch (e) {
    return { success: false, error: { code: 'FBK-013', message: e instanceof Error ? e.message : 'Could not generate invoice.' } }
  }
}
