import { getPrisma } from '../database/db'
import { billingService } from './billing.service'

// ShootBooking.estimatedDurationHours is a Prisma Decimal field —
// Electron's IPC (structured clone) cannot serialize a Decimal instance and
// throws "An object could not be cloned" on every response that includes
// one. Applied to every function below that returns a booking.
function serializeShootBooking<T extends { estimatedDurationHours: unknown; finalAmount?: unknown }>(b: T): T {
  return {
    ...b,
    estimatedDurationHours: Number(b.estimatedDurationHours),
    ...('finalAmount' in b ? { finalAmount: b.finalAmount == null ? null : Number(b.finalAmount) } : {}),
  }
}

export async function listShootBookings(filters?: { status?: string; clientId?: string; search?: string }) {
  const db = getPrisma()
  const where: Record<string, unknown> = {}
  if (filters?.status) where.status = filters.status
  if (filters?.clientId) where.clientId = filters.clientId
  if (filters?.search) where.client = { customerName: { contains: filters.search } }

  const bookings = await db.shootBooking.findMany({
    where,
    include: {
      client: { select: { id: true, customerName: true, phone: true } },
      editor: { select: { id: true, fullName: true } },
      delivery: true,
    },
    orderBy: [{ shootDate: 'desc' }],
  })
  return { success: true, data: bookings.map(serializeShootBooking) }
}

export async function getShootBooking(id: string) {
  const db = getPrisma()
  const booking = await db.shootBooking.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, customerName: true, phone: true } },
      editor: { select: { id: true, fullName: true } },
      delivery: true,
    },
  })
  if (!booking) return { success: false, error: { code: 'SHT-001', message: 'Shoot booking not found.' } }
  return { success: true, data: serializeShootBooking(booking) }
}

export async function createShootBooking(payload: {
  clientId: string
  shootType: string
  shootDate: string
  shootTime?: string
  shootLocation: string
  estimatedDurationHours: number
  deliverableType?: string
  expectedPhotosCount?: number
  deliveryDeadline?: string
  photographerIds?: string[]
  editorAssignedId?: string
  notes?: string
}) {
  const db = getPrisma()
  const booking = await db.shootBooking.create({
    data: {
      clientId: payload.clientId,
      shootType: payload.shootType,
      shootDate: new Date(payload.shootDate),
      shootTime: payload.shootTime || null,
      shootLocation: payload.shootLocation,
      estimatedDurationHours: payload.estimatedDurationHours,
      deliverableType: payload.deliverableType ?? 'DIGITAL_ONLY',
      expectedPhotosCount: payload.expectedPhotosCount ?? null,
      deliveryDeadline: payload.deliveryDeadline ? new Date(payload.deliveryDeadline) : null,
      photographerIds: JSON.stringify(payload.photographerIds ?? []),
      editorAssignedId: payload.editorAssignedId || null,
      notes: payload.notes || null,
    },
    include: {
      client: { select: { id: true, customerName: true, phone: true } },
      editor: { select: { id: true, fullName: true } },
      delivery: true,
    },
  })
  await db.auditLog.create({ data: { action: 'CREATE', entityType: 'ShootBooking', entityId: booking.id, newValue: JSON.stringify({ shootType: booking.shootType, clientId: booking.clientId }) } }).catch(() => {})
  return { success: true, data: serializeShootBooking(booking) }
}

export async function updateShootBooking(payload: {
  id: string
  shootType?: string
  shootDate?: string
  shootTime?: string | null
  shootLocation?: string
  estimatedDurationHours?: number
  deliverableType?: string
  expectedPhotosCount?: number | null
  deliveryDeadline?: string | null
  photographerIds?: string[]
  editorAssignedId?: string | null
  status?: string
  finalAmount?: number | null
  notes?: string | null
}) {
  if (payload.finalAmount != null && payload.finalAmount < 0) {
    return { success: false, error: { code: 'SHT-006', message: 'Final amount cannot be negative.' } }
  }
  const db = getPrisma()
  const { id, shootDate, deliveryDeadline, photographerIds, ...rest } = payload
  const booking = await db.shootBooking.update({
    where: { id },
    data: {
      ...rest,
      ...(shootDate !== undefined ? { shootDate: new Date(shootDate) } : {}),
      ...(deliveryDeadline !== undefined ? { deliveryDeadline: deliveryDeadline ? new Date(deliveryDeadline) : null } : {}),
      ...(photographerIds !== undefined ? { photographerIds: JSON.stringify(photographerIds) } : {}),
    },
    include: {
      client: { select: { id: true, customerName: true, phone: true } },
      editor: { select: { id: true, fullName: true } },
      delivery: true,
    },
  })
  await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'ShootBooking', entityId: booking.id } }).catch(() => {})
  return { success: true, data: serializeShootBooking(booking) }
}

export async function deleteShootBooking(id: string) {
  const db = getPrisma()
  const booking = await db.shootBooking.findUnique({ where: { id }, select: { invoiceId: true } })
  if (booking?.invoiceId) {
    return { success: false, error: { code: 'SHT-002', message: 'Cannot delete a shoot booking that has an associated invoice.' } }
  }
  await db.shootBooking.delete({ where: { id } })
  await db.auditLog.create({ data: { action: 'DELETE', entityType: 'ShootBooking', entityId: id } }).catch(() => {})
  return { success: true }
}

// Phase 40: closes a stub — ShootBooking.invoiceId existed with no way to
// ever populate it (no finalAmount field, no generation function). Same
// find-or-create service-product + billingService.createInvoice pattern as
// property-deal.service.ts's generateCommissionInvoice. SAC 998314 (event
// photography services), 18% GST.
// Sentinel written to ShootBooking.invoiceId while a generation is in
// flight — see the identical pattern (and its rationale) in
// time-entry.service.ts's INVOICE_CLAIM_SENTINEL.
const INVOICE_CLAIM_SENTINEL = 'PENDING_INVOICE_GENERATION'

export async function generateShootInvoice(id: string) {
  const db = getPrisma()
  try {
    // Atomic claim first — a single UPDATE...WHERE invoiceId IS NULL is one
    // SQL statement, executed atomically under SQLite's single-writer lock,
    // so two near-simultaneous calls for the same booking can't both pass.
    const claim = await db.shootBooking.updateMany({
      where: { id, invoiceId: null },
      data: { invoiceId: INVOICE_CLAIM_SENTINEL },
    })
    if (claim.count === 0) {
      const existing = await db.shootBooking.findUnique({ where: { id }, select: { id: true } })
      if (!existing) return { success: false, error: { code: 'SHT-003', message: 'Shoot booking not found.' } }
      return { success: false, error: { code: 'SHT-004', message: 'Invoice already generated for this booking.' } }
    }

    try {
      const booking = await db.shootBooking.findUnique({
        where: { id },
        select: { id: true, clientId: true, shootType: true, shootLocation: true, finalAmount: true, addOnItems: true },
      })
      if (!booking || booking.finalAmount == null || Number(booking.finalAmount) <= 0) {
        await db.shootBooking.update({ where: { id }, data: { invoiceId: null } })
        return { success: false, error: { code: 'SHT-005', message: 'Set a final agreed amount greater than zero before generating an invoice.' } }
      }

      let product = await db.product.findFirst({ where: { hsnCode: '998314', isActive: true } })
      if (!product) {
        product = await db.product.create({
          data: { productName: 'Photography & Videography Services', productType: 'SERVICE', hsnCode: '998314', sellingPrice: 0, taxRate: 18, unit: 'NOS', isActive: true },
        })
      }

      // Phase 58 §2 — itemized add-ons (extra prints, album copies, etc.)
      // feed into the invoice as their OWN lines, each backed by a real
      // Product looked up/created by its own description text — never
      // folded into one manually-typed number, and never overriding the
      // base package fee above.
      const addOnLineItems = []
      for (const addOn of booking.addOnItems) {
        let addOnProduct = await db.product.findFirst({ where: { productName: addOn.description, hsnCode: '998314' } })
        if (!addOnProduct) {
          addOnProduct = await db.product.create({
            data: { productName: addOn.description, productType: 'SERVICE', hsnCode: '998314', sellingPrice: 0, taxRate: 18, unit: 'NOS', isActive: true },
          })
        }
        // BUG FOUND 2026-07-22: `taxRate: 18` was hardcoded on both invoice
        // items here, permanently overriding the product's own configurable
        // rate — the same bug class fixed across many other vertical
        // services this session. Removed so both fall through to
        // product.taxRate / addOnProduct.taxRate, owner-editable via
        // Settings > Products.
        addOnLineItems.push({ productId: addOnProduct.id, quantity: addOn.quantity, unitPrice: Number(addOn.unitPrice) })
      }

      const result = await billingService.createInvoice({
        customerId: booking.clientId,
        paymentMethod: 'CREDIT',
        gstType: 'CGST_SGST',
        items: [
          { productId: product.id, quantity: 1, unitPrice: Number(booking.finalAmount) },
          ...addOnLineItems,
        ],
        notes: `${booking.shootType} shoot — ${booking.shootLocation}`,
        referenceNumber: id.slice(0, 12),
      })
      if (!result.success) {
        await db.shootBooking.update({ where: { id }, data: { invoiceId: null } })
        return result
      }

      const invoice = result.data as { id: string }
      await db.shootBooking.update({ where: { id }, data: { invoiceId: invoice.id } })
      await db.auditLog.create({ data: { action: 'INVOICED', entityType: 'ShootBooking', entityId: id, newValue: JSON.stringify({ invoiceId: invoice.id }) } }).catch(() => {})

      return { success: true, data: { invoiceId: invoice.id } }
    } catch (err) {
      await db.shootBooking.update({ where: { id }, data: { invoiceId: null } }).catch(() => {})
      throw err
    }
  } catch (err) {
    return { success: false, error: { code: 'SHT-007', message: err instanceof Error ? err.message : 'Could not generate shoot invoice.' } }
  }
}

export async function getShootKPIs() {
  const db = getPrisma()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)

  const [thisMonth, deliveriesPending, upcoming] = await Promise.all([
    db.shootBooking.count({ where: { shootDate: { gte: monthStart, lt: monthEnd } } }),
    db.shootBooking.count({ where: { status: { in: ['SHOT', 'EDITING'] } } }),
    db.shootBooking.count({ where: { shootDate: { gte: now }, status: { notIn: ['CANCELLED', 'DELIVERED'] } } }),
  ])
  return { success: true, data: { thisMonth, deliveriesPending, upcoming } }
}
