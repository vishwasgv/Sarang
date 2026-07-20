import { getPrisma } from '../database/db'
import { serializeVendorBooking, recomputePerHeadVendorBookings } from './event-vendor-booking.service'
import { billingService } from './billing.service'

// EventBooking.clientBudget/finalAmount are Prisma Decimal fields — Electron's
// IPC (structured clone) cannot serialize a Decimal instance and throws "An
// object could not be cloned" on every response that includes one. Every
// function below also nests `vendorBookings[]` (its own Decimal fields,
// quotedAmount/advancePaid — a second crash surface), serialized via the
// shared helper from event-vendor-booking.service.ts so the fix stays in
// one place.
function serializeEventBooking<T extends { clientBudget: unknown; finalAmount?: unknown; vendorBookings?: unknown[] }>(e: T): T {
  return {
    ...e,
    clientBudget: e.clientBudget == null ? null : Number(e.clientBudget),
    ...('finalAmount' in e ? { finalAmount: e.finalAmount == null ? null : Number(e.finalAmount) } : {}),
    ...(e.vendorBookings ? { vendorBookings: e.vendorBookings.map((v) => serializeVendorBooking(v as Parameters<typeof serializeVendorBooking>[0])) } : {}),
  }
}

export async function listEventBookings(filters?: { status?: string; search?: string }) {
  const db = getPrisma()
  const where: Record<string, unknown> = {}
  if (filters?.status) where.status = filters.status
  if (filters?.search) where.client = { customerName: { contains: filters.search } }

  const events = await db.eventBooking.findMany({
    where,
    include: {
      client: { select: { id: true, customerName: true, phone: true } },
      vendorBookings: {
        include: { vendor: { select: { id: true, supplierName: true, phone: true } } },
        orderBy: { vendorCategory: 'asc' },
      },
    },
    orderBy: [{ eventDate: 'asc' }],
  })
  return { success: true, data: events.map(serializeEventBooking) }
}

export async function createEventBooking(payload: {
  clientId: string
  eventName: string
  eventType: string
  eventDate: string
  eventEndDate?: string
  venueName: string
  venueAddress?: string
  expectedGuestCount?: number
  clientBudget?: number
  status?: string
  notes?: string
}) {
  const db = getPrisma()
  const event = await db.eventBooking.create({
    data: {
      clientId: payload.clientId,
      eventName: payload.eventName,
      eventType: payload.eventType,
      eventDate: new Date(payload.eventDate),
      eventEndDate: payload.eventEndDate ? new Date(payload.eventEndDate) : null,
      venueName: payload.venueName,
      venueAddress: payload.venueAddress || null,
      expectedGuestCount: payload.expectedGuestCount ?? null,
      clientBudget: payload.clientBudget ?? null,
      status: payload.status ?? 'INQUIRY',
      notes: payload.notes || null,
    },
    include: {
      client: { select: { id: true, customerName: true, phone: true } },
      vendorBookings: {
        include: { vendor: { select: { id: true, supplierName: true, phone: true } } },
      },
    },
  })
  await db.auditLog.create({ data: { action: 'CREATE', entityType: 'EventBooking', entityId: event.id, newValue: JSON.stringify({ eventName: event.eventName, eventType: event.eventType }) } }).catch(() => {})
  return { success: true, data: serializeEventBooking(event) }
}

export async function updateEventBooking(payload: {
  id: string
  eventName?: string
  eventType?: string
  eventDate?: string
  eventEndDate?: string | null
  venueName?: string
  venueAddress?: string | null
  expectedGuestCount?: number | null
  clientBudget?: number | null
  finalAmount?: number | null
  status?: string
  notes?: string | null
}) {
  if (payload.finalAmount != null && payload.finalAmount < 0) {
    return { success: false, error: { code: 'EVT-006', message: 'Final amount cannot be negative.' } }
  }
  const db = getPrisma()
  const { id, eventDate, eventEndDate, ...rest } = payload
  const event = await db.eventBooking.update({
    where: { id },
    data: {
      ...rest,
      ...(eventDate !== undefined ? { eventDate: new Date(eventDate) } : {}),
      ...(eventEndDate !== undefined ? { eventEndDate: eventEndDate ? new Date(eventEndDate) : null } : {}),
    },
    include: {
      client: { select: { id: true, customerName: true, phone: true } },
      vendorBookings: {
        include: { vendor: { select: { id: true, supplierName: true, phone: true } } },
      },
    },
  })
  // Phase 58 §2 — a changed guest count must keep every PER_HEAD vendor
  // line's billable amount honest, not silently stale.
  if (payload.expectedGuestCount !== undefined) {
    await recomputePerHeadVendorBookings(id, payload.expectedGuestCount)
    const refreshed = await db.eventBooking.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
        vendorBookings: { include: { vendor: { select: { id: true, supplierName: true, phone: true } } } },
      },
    })
    await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'EventBooking', entityId: event.id } }).catch(() => {})
    return { success: true, data: serializeEventBooking(refreshed!) }
  }
  await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'EventBooking', entityId: event.id } }).catch(() => {})
  return { success: true, data: serializeEventBooking(event) }
}

export async function deleteEventBooking(id: string) {
  const db = getPrisma()
  // Phase 40: EventBooking never had this guard even though the structurally
  // identical ShootBooking (SHT-002) does — a real, separate gap, not just a
  // by-product of adding invoice generation. Deleting a booking with a live
  // invoice would leave a dangling invoice with no back-reference.
  const booking = await db.eventBooking.findUnique({ where: { id }, select: { invoiceId: true } })
  if (booking?.invoiceId) {
    return { success: false, error: { code: 'EVT-002', message: 'Cannot delete an event booking that has an associated invoice.' } }
  }
  await db.eventBooking.delete({ where: { id } })
  await db.auditLog.create({ data: { action: 'DELETE', entityType: 'EventBooking', entityId: id } }).catch(() => {})
  return { success: true }
}

// Phase 40: closes a stub explicitly marked "reserved for future invoice
// generation" in the schema comment when Phase 32 added EventBooking.invoiceId.
// Same find-or-create service-product + billingService.createInvoice pattern
// as property-deal.service.ts's generateCommissionInvoice. SAC 998596 (event
// management services), 18% GST.
// Sentinel written to EventBooking.invoiceId while a generation is in
// flight — see the identical pattern (and its rationale) in
// time-entry.service.ts's INVOICE_CLAIM_SENTINEL.
const INVOICE_CLAIM_SENTINEL = 'PENDING_INVOICE_GENERATION'

export async function generateEventInvoice(id: string) {
  const db = getPrisma()
  try {
    // Atomic claim first — a single UPDATE...WHERE invoiceId IS NULL is one
    // SQL statement, executed atomically under SQLite's single-writer lock,
    // so two near-simultaneous calls for the same event can't both pass.
    const claim = await db.eventBooking.updateMany({
      where: { id, invoiceId: null },
      data: { invoiceId: INVOICE_CLAIM_SENTINEL },
    })
    if (claim.count === 0) {
      const existing = await db.eventBooking.findUnique({ where: { id }, select: { id: true } })
      if (!existing) return { success: false, error: { code: 'EVT-003', message: 'Event booking not found.' } }
      return { success: false, error: { code: 'EVT-004', message: 'Invoice already generated for this event.' } }
    }

    try {
      const booking = await db.eventBooking.findUnique({
        where: { id },
        select: { id: true, clientId: true, eventName: true, eventType: true, finalAmount: true },
      })
      if (!booking || booking.finalAmount == null || Number(booking.finalAmount) <= 0) {
        await db.eventBooking.update({ where: { id }, data: { invoiceId: null } })
        return { success: false, error: { code: 'EVT-005', message: 'Set a final agreed amount greater than zero before generating an invoice.' } }
      }

      let product = await db.product.findFirst({ where: { hsnCode: '998596', isActive: true } })
      if (!product) {
        product = await db.product.create({
          data: { productName: 'Event Management Services', productType: 'SERVICE', hsnCode: '998596', sellingPrice: 0, taxRate: 18, unit: 'NOS', isActive: true },
        })
      }

      const result = await billingService.createInvoice({
        customerId: booking.clientId,
        paymentMethod: 'CREDIT',
        gstType: 'CGST_SGST',
        items: [{
          productId: product.id,
          quantity: 1,
          unitPrice: Number(booking.finalAmount),
          taxRate: 18,
        }],
        notes: `${booking.eventType} — ${booking.eventName}`,
        referenceNumber: id.slice(0, 12),
      })
      if (!result.success) {
        await db.eventBooking.update({ where: { id }, data: { invoiceId: null } })
        return result
      }

      const invoice = result.data as { id: string }
      await db.eventBooking.update({ where: { id }, data: { invoiceId: invoice.id } })
      await db.auditLog.create({ data: { action: 'INVOICED', entityType: 'EventBooking', entityId: id, newValue: JSON.stringify({ invoiceId: invoice.id }) } }).catch(() => {})

      return { success: true, data: { invoiceId: invoice.id } }
    } catch (err) {
      await db.eventBooking.update({ where: { id }, data: { invoiceId: null } }).catch(() => {})
      throw err
    }
  } catch (err) {
    return { success: false, error: { code: 'EVT-007', message: err instanceof Error ? err.message : 'Could not generate event invoice.' } }
  }
}

export async function getEventKPIs() {
  const db = getPrisma()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7)

  const [thisMonth, vendorsPending, upcoming, leadsCount] = await Promise.all([
    db.eventBooking.count({ where: { eventDate: { gte: monthStart, lt: monthEnd } } }),
    db.eventVendorBooking.count({ where: { status: { in: ['ENQUIRED', 'BOOKED'] } } }),
    db.eventBooking.count({ where: { eventDate: { gte: now }, status: { notIn: ['CANCELLED', 'COMPLETED'] } } }),
    db.eventBooking.count({ where: { status: 'INQUIRY', createdAt: { gte: sevenDaysAgo } } }),
  ])
  return { success: true, data: { thisMonth, vendorsPending, upcoming, leadsCount } }
}
