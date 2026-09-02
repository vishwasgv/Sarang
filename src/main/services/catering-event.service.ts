import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { generateSequenceNumber } from './sequence.service'
import { billingService } from './billing.service'
import { sumCurrency, roundCurrency } from './currency.service'
import { parseLocalDateStart } from '../utils/date.util'

// 2026-09 §13 — Catering (Bakery/Sweet Shop/Catering vertical). Direct
// structural mirror of custom-order-booking.service.ts's header+items
// shape and claim-sentinel invoice-generation pattern, extended with two
// more child collections (CateringEventDay for multi-day meal/snack
// counts, CateringEventStaff for per-role staffing cost) and a distinct
// "bargain the final price down from the quote" action
// (recordFinalNegotiatedPrice) that CustomOrderBooking has no equivalent
// of — catering pricing is genuinely negotiated per event, a fixed retail
// list price never is.
//
// No standalone "edit event details" endpoint, same as CustomOrderBooking
// — the menu/days/staff are decided at booking time; the one thing that
// legitimately changes afterward is the final bargained price, which gets
// its own explicit action below.

const CATERING_EVENT_INVOICE_CLAIM_SENTINEL = 'CLAIMING'
const VALID_STAFF_ROLES = new Set(['COOK', 'SERVER', 'CLEANER', 'OTHER'])
const VALID_STATUSES = new Set(['BOOKED', 'COMPLETED', 'CANCELLED'])

export async function createCateringEvent(payload: {
  customerId: string
  eventStartDate: string
  eventEndDate?: string
  venueAddress?: string
  attendeeCount: number
  pricePerPlate: number
  advanceAmount?: number
  advancePaymentMethod?: 'CASH' | 'UPI' | 'CARD' | 'WALLET'
  notes?: string
  createdById?: string
  menuItems?: Array<{ productId: string; quantity: number; unitPrice: number }>
  days?: Array<{ serviceDate: string; mealsCount?: number; snacksCount?: number }>
  staff?: Array<{ role: 'COOK' | 'SERVER' | 'CLEANER' | 'OTHER'; workerCount: number; ratePerWorker: number; serviceDate?: string }>
}) {
  try {
    if (!payload.attendeeCount || payload.attendeeCount <= 0) {
      return { success: false, error: { code: 'CAT-001', message: 'Attendee count must be greater than zero.' } }
    }
    if (payload.pricePerPlate == null || payload.pricePerPlate < 0) {
      return { success: false, error: { code: 'CAT-002', message: 'Price per plate is required and cannot be negative.' } }
    }
    const db = getPrisma()
    const customer = await db.customer.findUnique({ where: { id: payload.customerId } })
    if (!customer) return { success: false, error: { code: 'CAT-003', message: 'Customer not found.' } }

    for (const staff of payload.staff ?? []) {
      if (!VALID_STAFF_ROLES.has(staff.role)) {
        return { success: false, error: { code: 'CAT-004', message: `Invalid staff role "${staff.role}".` } }
      }
      if (!staff.workerCount || staff.workerCount <= 0) {
        return { success: false, error: { code: 'CAT-005', message: 'Worker count must be greater than zero for every staff line.' } }
      }
      if (staff.ratePerWorker == null || staff.ratePerWorker < 0) {
        return { success: false, error: { code: 'CAT-006', message: 'Rate per worker cannot be negative.' } }
      }
    }

    const advanceAmount = payload.advanceAmount ?? 0
    if (advanceAmount < 0) {
      return { success: false, error: { code: 'CAT-007', message: 'Advance amount cannot be negative.' } }
    }
    const estimatedTotal = sumCurrency([payload.pricePerPlate * payload.attendeeCount])
    if (advanceAmount > estimatedTotal) {
      return { success: false, error: { code: 'CAT-008', message: 'Advance cannot exceed the estimated total (price per plate × attendees).' } }
    }

    const event = await db.$transaction(async (tx) => {
      const eventNumber = await generateSequenceNumber(
        tx, 'catering_event_number_sequence', 'CAT', 5,
        async () => {
          const last = await tx.cateringEvent.findFirst({ orderBy: { createdAt: 'desc' }, select: { eventNumber: true } })
          return last ? parseInt(last.eventNumber.replace('CAT-', ''), 10) : 0
        }
      )
      return tx.cateringEvent.create({
        data: {
          eventNumber,
          customerId: payload.customerId,
          eventStartDate: parseLocalDateStart(payload.eventStartDate),
          eventEndDate: payload.eventEndDate ? parseLocalDateStart(payload.eventEndDate) : null,
          venueAddress: payload.venueAddress ?? null,
          attendeeCount: payload.attendeeCount,
          pricePerPlate: payload.pricePerPlate,
          advanceAmount,
          advancePaymentMethod: payload.advancePaymentMethod ?? 'CASH',
          notes: payload.notes ?? null,
          createdById: payload.createdById ?? null,
          menuItems: {
            create: (payload.menuItems ?? []).map(i => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice })),
          },
          days: {
            create: (payload.days ?? []).map(d => ({
              serviceDate: parseLocalDateStart(d.serviceDate),
              mealsCount: d.mealsCount ?? 0,
              snacksCount: d.snacksCount ?? 0,
            })),
          },
          staff: {
            create: (payload.staff ?? []).map(s => ({
              role: s.role,
              workerCount: s.workerCount,
              ratePerWorker: s.ratePerWorker,
              serviceDate: s.serviceDate ? parseLocalDateStart(s.serviceDate) : null,
              amount: roundCurrency(s.workerCount * s.ratePerWorker),
            })),
          },
        },
        include: {
          menuItems: { include: { product: { select: { id: true, productName: true } } } },
          days: true,
          staff: true,
          customer: { select: { id: true, customerName: true, phone: true } },
        },
      })
    })

    await logAction({ userId: payload.createdById, action: 'CATERING_EVENT_CREATED', entityType: 'CateringEvent', entityId: event.id, newValue: { eventNumber: event.eventNumber, attendeeCount: payload.attendeeCount, advanceAmount } })
    return { success: true, data: event }
  } catch (err) {
    return { success: false, error: { code: 'CAT-009', message: err instanceof Error ? err.message : 'Could not create catering event.' } }
  }
}

export async function listCateringEvents(filters?: { customerId?: string; status?: string }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.customerId) where.customerId = filters.customerId
    if (filters?.status) where.status = filters.status
    const events = await db.cateringEvent.findMany({
      where,
      include: {
        menuItems: { include: { product: { select: { id: true, productName: true } } } },
        days: true,
        staff: true,
        customer: { select: { id: true, customerName: true, phone: true } },
      },
      orderBy: { eventStartDate: 'desc' },
    })
    return { success: true, data: events }
  } catch (err) {
    return { success: false, error: { code: 'CAT-010', message: err instanceof Error ? err.message : 'Could not list catering events.' } }
  }
}

export async function getCateringEvent(id: string) {
  try {
    const db = getPrisma()
    const event = await db.cateringEvent.findUnique({
      where: { id },
      include: {
        menuItems: { include: { product: { select: { id: true, productName: true } } } },
        days: true,
        staff: true,
        customer: { select: { id: true, customerName: true, phone: true } },
      },
    })
    if (!event) return { success: false, error: { code: 'CAT-011', message: 'Catering event not found.' } }
    return { success: true, data: event }
  } catch (err) {
    return { success: false, error: { code: 'CAT-012', message: err instanceof Error ? err.message : 'Could not load catering event.' } }
  }
}

// The distinct "bargain the price down from the quote" step — pricePerPlate
// stays as the original quote for reference, finalNegotiatedPrice is the
// agreed total once negotiation settles. Blocked once invoiced — the bill
// has already been generated off whatever this was at that moment.
export async function recordFinalNegotiatedPrice(id: string, finalNegotiatedPrice: number, userId?: string) {
  try {
    if (finalNegotiatedPrice == null || finalNegotiatedPrice < 0) {
      return { success: false, error: { code: 'CAT-013', message: 'Final negotiated price cannot be negative.' } }
    }
    const db = getPrisma()
    const existing = await db.cateringEvent.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'CAT-011', message: 'Catering event not found.' } }
    if (existing.invoiceId) return { success: false, error: { code: 'CAT-014', message: 'Cannot change the price after this event has already been invoiced.' } }
    if (finalNegotiatedPrice < existing.advanceAmount) {
      return { success: false, error: { code: 'CAT-015', message: 'Final negotiated price cannot be less than the advance already recorded.' } }
    }
    const updated = await db.cateringEvent.update({ where: { id }, data: { finalNegotiatedPrice } })
    await logAction({ userId, action: 'CATERING_EVENT_PRICE_NEGOTIATED', entityType: 'CateringEvent', entityId: id, newValue: { finalNegotiatedPrice } })
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'CAT-016', message: err instanceof Error ? err.message : 'Could not update the negotiated price.' } }
  }
}

export async function updateCateringEventStatus(id: string, status: 'BOOKED' | 'COMPLETED' | 'CANCELLED', userId?: string) {
  try {
    if (!VALID_STATUSES.has(status)) {
      return { success: false, error: { code: 'CAT-017', message: `Invalid status "${status}".` } }
    }
    const db = getPrisma()
    const existing = await db.cateringEvent.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'CAT-011', message: 'Catering event not found.' } }
    const updated = await db.cateringEvent.update({ where: { id }, data: { status } })
    await logAction({ userId, action: 'CATERING_EVENT_STATUS_UPDATED', entityType: 'CateringEvent', entityId: id, newValue: { status } })
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'CAT-018', message: err instanceof Error ? err.message : 'Could not update catering event status.' } }
  }
}

export async function deleteCateringEvent(id: string, userId?: string) {
  try {
    const db = getPrisma()
    const existing = await db.cateringEvent.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'CAT-011', message: 'Catering event not found.' } }
    if (existing.invoiceId) return { success: false, error: { code: 'CAT-019', message: 'Cannot delete an event that has already been invoiced.' } }
    await db.cateringEvent.delete({ where: { id } })
    await logAction({ userId, action: 'CATERING_EVENT_DELETED', entityType: 'CateringEvent', entityId: id })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'CAT-020', message: err instanceof Error ? err.message : 'Could not delete catering event.' } }
  }
}

// Same atomic claim-sentinel + billingService.createInvoice() pattern as
// custom-order-booking.service.ts / trip-booking.service.ts. Billed as ONE
// service line (billingService.getOrCreateServiceProduct, same singleton
// pattern trip-booking.service.ts already uses for its own package-priced,
// not itemized-by-component, billing) at the final negotiated price if one
// was recorded, falling back to the original per-plate quote × attendees —
// a caterer bills per head, not per individual dish, so the menu/staffing
// detail captured on the event stays internal record-keeping, never
// itemized onto the customer's own invoice.
export async function generateCateringEventInvoice(eventId: string, userId?: string): Promise<{ success: boolean; data?: { invoiceId: string }; error?: { code: string; message: string } }> {
  const db = getPrisma()
  try {
    const claim = await db.cateringEvent.updateMany({ where: { id: eventId, invoiceId: null }, data: { invoiceId: CATERING_EVENT_INVOICE_CLAIM_SENTINEL } })
    if (claim.count === 0) {
      const existing = await db.cateringEvent.findUnique({ where: { id: eventId }, select: { id: true, invoiceId: true } })
      if (!existing) return { success: false, error: { code: 'CAT-011', message: 'Catering event not found.' } }
      if (existing.invoiceId === CATERING_EVENT_INVOICE_CLAIM_SENTINEL) return { success: false, error: { code: 'CAT-021', message: 'Invoice generation already in progress for this event.' } }
      return { success: false, error: { code: 'CAT-022', message: 'An invoice has already been generated for this event.' } }
    }

    try {
      const event = await db.cateringEvent.findUnique({ where: { id: eventId } })
      if (!event) {
        await db.cateringEvent.update({ where: { id: eventId }, data: { invoiceId: null } })
        return { success: false, error: { code: 'CAT-011', message: 'Catering event not found.' } }
      }

      const totalAmount = roundCurrency(event.finalNegotiatedPrice ?? event.pricePerPlate * event.attendeeCount)
      const serviceRes = await billingService.getOrCreateServiceProduct({ name: 'Catering Service' })
      const serviceProductId = serviceRes.data.id

      const result = await billingService.createInvoice({
        customerId: event.customerId,
        paymentMethod: 'CREDIT',
        items: [{ productId: serviceProductId, quantity: 1, unitPrice: totalAmount }],
        notes: `Catering event ${event.eventNumber}`,
        referenceNumber: event.eventNumber,
      })
      if (!result.success) {
        await db.cateringEvent.update({ where: { id: eventId }, data: { invoiceId: null } })
        return result as { success: false; error: { code: string; message: string } }
      }

      const invoice = result.data as { id: string; totalAmount: number }
      await db.cateringEvent.update({ where: { id: eventId }, data: { invoiceId: invoice.id, status: 'COMPLETED' } })

      if (event.advanceAmount > 0) {
        const { paymentService } = await import('./payment.service')
        await paymentService.recordPayment({
          invoiceId: invoice.id,
          paymentMethod: event.advancePaymentMethod as 'CASH' | 'UPI' | 'CARD' | 'WALLET',
          amount: Math.min(event.advanceAmount, invoice.totalAmount),
        }, userId)
      }

      await logAction({ userId, action: 'CATERING_EVENT_INVOICED', entityType: 'CateringEvent', entityId: eventId, newValue: { invoiceId: invoice.id, totalAmount } })
      return { success: true, data: { invoiceId: invoice.id } }
    } catch (err) {
      await db.cateringEvent.update({ where: { id: eventId }, data: { invoiceId: null } }).catch(() => {})
      throw err
    }
  } catch (e) {
    return { success: false, error: { code: 'CAT-023', message: e instanceof Error ? e.message : 'Could not generate invoice.' } }
  }
}

export const cateringEventService = {
  createCateringEvent,
  listCateringEvents,
  getCateringEvent,
  recordFinalNegotiatedPrice,
  updateCateringEventStatus,
  deleteCateringEvent,
  generateCateringEventInvoice,
}
