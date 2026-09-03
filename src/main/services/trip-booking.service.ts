import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { generateSequenceNumber } from './sequence.service'
import { billingService } from './billing.service'
import { roundCurrency } from './currency.service'
import { parseLocalDateStart } from '../utils/date.util'
import { ServiceError } from '../errors/service-error'
import { buildReminderWhatsAppLink } from './notification-queue.service'

// 2026-09 §12 — Tours & Travels vertical: the core booking record. Two
// flows off one `bookingType` discriminator (CHARTER|SEAT), mirroring
// FurnitureBooking's deposit/balance UX for CHARTER and a ticketing-style
// atomic seat claim for SEAT.

const TRIP_INVOICE_CLAIM_SENTINEL = 'CLAIMING'

export async function createCharterBooking(payload: {
  customerId: string
  vehicleId: string
  tripStartDate: string
  tripEndDate?: string
  pickupLocation?: string
  dropLocation?: string
  route?: string
  packageRate: number
  includedKmPerDay?: number
  includedHoursPerDay?: number
  advanceAmount?: number
  advancePaymentMethod?: 'CASH' | 'UPI' | 'CARD' | 'WALLET'
  referringAgentName?: string
  commissionType?: 'PERCENTAGE' | 'FIXED'
  commissionValue?: number
  notes?: string
  createdById?: string
}) {
  try {
    const db = getPrisma()
    const customer = await db.customer.findUnique({ where: { id: payload.customerId } })
    if (!customer) return { success: false, error: { code: 'TRB-001', message: 'Customer not found.' } }
    const vehicle = await db.tourVehicle.findUnique({ where: { id: payload.vehicleId } })
    if (!vehicle) return { success: false, error: { code: 'TRB-002', message: 'Vehicle not found.' } }
    if (vehicle.status !== 'ACTIVE') return { success: false, error: { code: 'TRB-003', message: 'This vehicle is not currently active.' } }
    if (payload.packageRate < 0) return { success: false, error: { code: 'TRB-004', message: 'Package rate cannot be negative.' } }
    const advanceAmount = payload.advanceAmount ?? 0
    if (advanceAmount < 0) return { success: false, error: { code: 'TRB-005', message: 'Advance amount cannot be negative.' } }
    if (advanceAmount > payload.packageRate) return { success: false, error: { code: 'TRB-006', message: 'Advance cannot exceed the package rate.' } }

    const booking = await db.$transaction(async (tx) => {
      const bookingNumber = await generateSequenceNumber(
        tx, 'trip_booking_number_sequence', 'TRP', 5,
        async () => {
          const last = await tx.tripBooking.findFirst({ orderBy: { createdAt: 'desc' }, select: { bookingNumber: true } })
          return last ? parseInt(last.bookingNumber.replace('TRP-', ''), 10) : 0
        }
      )
      return tx.tripBooking.create({
        data: {
          bookingNumber, bookingType: 'CHARTER', customerId: payload.customerId, vehicleId: payload.vehicleId,
          tripStartDate: parseLocalDateStart(payload.tripStartDate),
          tripEndDate: payload.tripEndDate ? parseLocalDateStart(payload.tripEndDate) : null,
          pickupLocation: payload.pickupLocation ?? null, dropLocation: payload.dropLocation ?? null, route: payload.route ?? null,
          packageRate: payload.packageRate, includedKmPerDay: payload.includedKmPerDay ?? null, includedHoursPerDay: payload.includedHoursPerDay ?? null,
          advanceAmount, advancePaymentMethod: payload.advancePaymentMethod ?? 'CASH',
          referringAgentName: payload.referringAgentName ?? null, commissionType: payload.commissionType ?? null, commissionValue: payload.commissionValue ?? null,
          notes: payload.notes ?? null, createdById: payload.createdById ?? null,
        },
        include: { customer: { select: { id: true, customerName: true, phone: true } }, vehicle: { select: { id: true, registrationNumber: true, vehicleType: true } } }
      })
    })

    await logAction({ userId: payload.createdById, action: 'TRIP_CHARTER_BOOKING_CREATED', entityType: 'TripBooking', entityId: booking.id, newValue: { bookingNumber: booking.bookingNumber } })
    await scheduleDepartureReminder(booking.id).catch(() => {})
    return { success: true, data: booking }
  } catch (err) {
    return { success: false, error: { code: 'TRB-015', message: err instanceof Error ? err.message : 'Could not create charter booking.' } }
  }
}

// 2026-09 §14 — real gap found via a WhatsApp-reminder audit across all 50
// verticals: Tours & Travels had zero reminder of any kind before this
// pass. Shared by both booking types (CHARTER and SEAT both set
// tripStartDate) — single reminder 1 day before departure, mirrors
// rental.service.ts's scheduleReturnReminder shape (fire-and-forget,
// non-critical).
async function scheduleDepartureReminder(bookingId: string): Promise<void> {
  try {
    const db = getPrisma()
    const booking = await db.tripBooking.findUnique({ where: { id: bookingId }, include: { customer: true } })
    if (!booking?.customer?.phone) return

    const reminderDate = new Date(booking.tripStartDate)
    reminderDate.setDate(reminderDate.getDate() - 1)
    if (reminderDate <= new Date()) return

    const dateStr = booking.tripStartDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const body = `Dear ${booking.customer.customerName}, this is a reminder that your trip (${booking.bookingNumber}) departs tomorrow, ${dateStr}. Safe travels! Powered by Sarang | www.aszurex.com`
    const link = await buildReminderWhatsAppLink(booking.customer.phone, body)
    await db.notificationQueue.create({
      data: {
        customerId: booking.customerId, customerName: booking.customer.customerName, customerPhone: booking.customer.phone,
        notificationType: 'TRIP_DEPARTURE_REMINDER', templateBody: body, whatsappLink: link, scheduledFor: reminderDate,
      },
    })
  } catch {
    // Non-critical — same convention as rental.service.ts/membership.service.ts
  }
}

// Ticketing-style atomic seat claim. The capacity check + the increment
// happen inside one Prisma interactive transaction — SQLite's single-writer
// guarantee means no concurrent seat booking can interleave between the
// read and the increment, the same reasoning every other "claim" in this
// codebase relies on (e.g. FurnitureBooking's invoiceId claim-sentinel).
export async function createSeatBooking(payload: {
  customerId: string
  tourDepartureId: string
  seatsBooked: number
  advanceAmount?: number
  advancePaymentMethod?: 'CASH' | 'UPI' | 'CARD' | 'WALLET'
  referringAgentName?: string
  commissionType?: 'PERCENTAGE' | 'FIXED'
  commissionValue?: number
  notes?: string
  createdById?: string
}) {
  try {
    if (payload.seatsBooked <= 0) return { success: false, error: { code: 'TRB-007', message: 'Seats booked must be at least 1.' } }
    const db = getPrisma()
    const customer = await db.customer.findUnique({ where: { id: payload.customerId } })
    if (!customer) return { success: false, error: { code: 'TRB-001', message: 'Customer not found.' } }

    const booking = await db.$transaction(async (tx) => {
      const departure = await tx.tourDeparture.findUnique({ where: { id: payload.tourDepartureId }, include: { tourPackage: true } })
      if (!departure) throw new ServiceError('TRB-008', 'Tour departure not found.')
      if (departure.status !== 'SCHEDULED') throw new ServiceError('TRB-009', 'This departure is not open for booking.')
      const seatsRemaining = departure.totalSeats - departure.seatsBooked
      if (payload.seatsBooked > seatsRemaining) throw new ServiceError('TRB-010', `Only ${seatsRemaining} seat(s) remaining on this departure.`)

      const packageRate = roundCurrency(departure.tourPackage.farePerSeat * payload.seatsBooked)
      const advanceAmount = payload.advanceAmount ?? 0
      if (advanceAmount < 0) throw new ServiceError('TRB-005', 'Advance amount cannot be negative.')
      if (advanceAmount > packageRate) throw new ServiceError('TRB-006', 'Advance cannot exceed the package rate.')

      const bookingNumber = await generateSequenceNumber(
        tx, 'trip_booking_number_sequence', 'TRP', 5,
        async () => {
          const last = await tx.tripBooking.findFirst({ orderBy: { createdAt: 'desc' }, select: { bookingNumber: true } })
          return last ? parseInt(last.bookingNumber.replace('TRP-', ''), 10) : 0
        }
      )

      const created = await tx.tripBooking.create({
        data: {
          bookingNumber, bookingType: 'SEAT', customerId: payload.customerId, tourDepartureId: payload.tourDepartureId, seatsBooked: payload.seatsBooked,
          tripStartDate: departure.departureDate, packageRate,
          advanceAmount, advancePaymentMethod: payload.advancePaymentMethod ?? 'CASH',
          referringAgentName: payload.referringAgentName ?? null, commissionType: payload.commissionType ?? null, commissionValue: payload.commissionValue ?? null,
          notes: payload.notes ?? null, createdById: payload.createdById ?? null,
        },
        include: { customer: { select: { id: true, customerName: true, phone: true } }, tourDeparture: { include: { tourPackage: { select: { packageName: true } } } } }
      })

      await tx.tourDeparture.update({ where: { id: payload.tourDepartureId }, data: { seatsBooked: { increment: payload.seatsBooked } } })

      return created
    })

    await logAction({ userId: payload.createdById, action: 'TRIP_SEAT_BOOKING_CREATED', entityType: 'TripBooking', entityId: booking.id, newValue: { bookingNumber: booking.bookingNumber, seatsBooked: payload.seatsBooked } })
    await scheduleDepartureReminder(booking.id).catch(() => {})
    return { success: true, data: booking }
  } catch (err) {
    if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
    return { success: false, error: { code: 'TRB-011', message: err instanceof Error ? err.message : 'Could not create seat booking.' } }
  }
}

export async function listTripBookings(filters?: { customerId?: string; bookingType?: string; status?: string }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.customerId) where.customerId = filters.customerId
    if (filters?.bookingType) where.bookingType = filters.bookingType
    if (filters?.status) where.status = filters.status
    const bookings = await db.tripBooking.findMany({
      where,
      include: {
        customer: { select: { id: true, customerName: true, phone: true } },
        vehicle: { select: { id: true, registrationNumber: true, vehicleType: true } },
        tourDeparture: { include: { tourPackage: { select: { packageName: true } } } },
        dutyLogs: true,
      },
      orderBy: { createdAt: 'desc' }
    })
    return { success: true, data: bookings }
  } catch (err) {
    return { success: false, error: { code: 'TRB-016', message: err instanceof Error ? err.message : 'Could not list trip bookings.' } }
  }
}

export async function updateTripBookingStatus(id: string, status: 'BOOKED' | 'COMPLETED' | 'CANCELLED') {
  try {
    const db = getPrisma()
    const existing = await db.tripBooking.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'TRB-008', message: 'Booking not found.' } }

    const updated = await db.$transaction(async (tx) => {
      const result = await tx.tripBooking.update({ where: { id }, data: { status } })
      // Cancelling a still-active SEAT booking must release its seats back
      // to the departure — otherwise they stay phantom-held forever,
      // permanently shrinking the departure's real capacity. Guarded on
      // existing.status !== 'CANCELLED' so a repeated cancel call (already
      // cancelled) never double-decrements.
      if (status === 'CANCELLED' && existing.bookingType === 'SEAT' && existing.tourDepartureId && existing.status !== 'CANCELLED' && existing.seatsBooked) {
        await tx.tourDeparture.update({ where: { id: existing.tourDepartureId }, data: { seatsBooked: { decrement: existing.seatsBooked } } })
      }
      return result
    })
    await logAction({ action: 'TRIP_BOOKING_STATUS_UPDATED', entityType: 'TripBooking', entityId: id, newValue: { status } })
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'TRB-017', message: err instanceof Error ? err.message : 'Could not update booking status.' } }
  }
}

// Same atomic claim-sentinel + billingService.createInvoice() pattern as
// furniture-booking.service.ts's generateFurnitureInvoice, adapted for a
// service (no physical product — reuses the established
// getOrCreateServiceProduct lazily-created-singleton convention, same as
// Stationery's Print/Copy Service). Bills packageRate PLUS any settled
// excess-km/hour charges from this trip's closed duty logs — driver Bata/
// night-halt/night-driving stay off the invoice entirely, they're the
// separate driver-cost side, never billed to the customer.
export async function generateTripInvoice(bookingId: string, userId?: string): Promise<{ success: boolean; data?: { invoiceId: string }; error?: { code: string; message: string } }> {
  const db = getPrisma()
  try {
    const claim = await db.tripBooking.updateMany({ where: { id: bookingId, invoiceId: null }, data: { invoiceId: TRIP_INVOICE_CLAIM_SENTINEL } })
    if (claim.count === 0) {
      const existing = await db.tripBooking.findUnique({ where: { id: bookingId }, select: { id: true, invoiceId: true } })
      if (!existing) return { success: false, error: { code: 'TRB-008', message: 'Booking not found.' } }
      if (existing.invoiceId === TRIP_INVOICE_CLAIM_SENTINEL) return { success: false, error: { code: 'TRB-012', message: 'Invoice generation already in progress for this booking.' } }
      return { success: false, error: { code: 'TRB-013', message: 'An invoice has already been generated for this booking.' } }
    }

    try {
      const booking = await db.tripBooking.findUnique({ where: { id: bookingId }, include: { dutyLogs: true } })
      if (!booking) {
        await db.tripBooking.update({ where: { id: bookingId }, data: { invoiceId: null } })
        return { success: false, error: { code: 'TRB-008', message: 'Booking not found.' } }
      }

      const excessTotal = booking.dutyLogs.reduce((s, d) => s + (d.excessKmCharge ?? 0) + (d.excessHourCharge ?? 0), 0)
      // getOrCreateServiceProduct has no failure path in its own type (it
      // either finds or lazily creates the singleton) — no rollback branch
      // needed here, unlike the createInvoice call below which genuinely
      // can fail.
      const serviceRes = await billingService.getOrCreateServiceProduct({ name: booking.bookingType === 'CHARTER' ? 'Trip Charter' : 'Tour Package Seat' })
      const serviceProductId = serviceRes.data.id

      const result = await billingService.createInvoice({
        customerId: booking.customerId,
        paymentMethod: 'CREDIT',
        items: [{ productId: serviceProductId, quantity: 1, unitPrice: roundCurrency(booking.packageRate + excessTotal) }],
        notes: `Trip booking ${booking.bookingNumber}`,
        referenceNumber: booking.bookingNumber,
      })
      if (!result.success) {
        await db.tripBooking.update({ where: { id: bookingId }, data: { invoiceId: null } })
        return result as { success: false; error: { code: string; message: string } }
      }

      const invoice = result.data as { id: string; totalAmount: number }
      await db.tripBooking.update({ where: { id: bookingId }, data: { invoiceId: invoice.id, status: 'COMPLETED' } })

      if (booking.advanceAmount > 0) {
        const { paymentService } = await import('./payment.service')
        await paymentService.recordPayment({
          invoiceId: invoice.id,
          paymentMethod: booking.advancePaymentMethod as 'CASH' | 'UPI' | 'CARD' | 'WALLET',
          amount: Math.min(booking.advanceAmount, invoice.totalAmount),
        }, userId)
      }

      await logAction({ userId, action: 'TRIP_BOOKING_INVOICED', entityType: 'TripBooking', entityId: bookingId, newValue: { invoiceId: invoice.id, excessTotal } })
      return { success: true, data: { invoiceId: invoice.id } }
    } catch (err) {
      await db.tripBooking.update({ where: { id: bookingId }, data: { invoiceId: null } }).catch(() => {})
      throw err
    }
  } catch (e) {
    return { success: false, error: { code: 'TRB-014', message: e instanceof Error ? e.message : 'Could not generate invoice.' } }
  }
}

export const tripBookingService = {
  createCharterBooking, createSeatBooking, listTripBookings, updateTripBookingStatus, generateTripInvoice,
}
