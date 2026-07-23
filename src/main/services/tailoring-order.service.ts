import { getPrisma } from '../database/db'
import { billingService } from './billing.service'
import { generateSequenceNumber } from './sequence.service'
import { inventoryService } from './inventory.service'
import { createAppointment } from './appointment.service'
import { createAppointmentReminder } from './notification-queue.service'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

// TailoringOrder.unitPrice/totalAmount/advancePaid are Prisma Decimal
// fields — Electron's IPC (structured clone) cannot serialize a Decimal
// instance and throws "An object could not be cloned" on every response
// that includes one. Applied to every function below that returns an
// order. (The nested `measurement` select only picks id/recordDate — no
// Decimal fields — so no second crash surface here.)
function serializeTailoringOrder<T extends { unitPrice: unknown; totalAmount: unknown; advancePaid: unknown }>(o: T): T {
  return { ...o, unitPrice: Number(o.unitPrice), totalAmount: Number(o.totalAmount), advancePaid: Number(o.advancePaid) }
}

async function generateOrderNumber(tx: TxClient): Promise<string> {
  return generateSequenceNumber(
    tx, 'tailoring_order_number_sequence', 'TO', 5,
    async () => {
      const last = await tx.tailoringOrder.findFirst({ orderBy: { createdAt: 'desc' }, select: { orderNumber: true } })
      return last ? parseInt(last.orderNumber.replace('TO-', ''), 10) : 0
    }
  )
}

export async function listTailoringOrders(filters?: { status?: string; clientId?: string; search?: string }) {
  const db = getPrisma()
  const where: Record<string, unknown> = {}
  if (filters?.status) where.status = filters.status
  if (filters?.clientId) where.clientId = filters.clientId
  if (filters?.search) {
    where.OR = [
      { orderNumber: { contains: filters.search } },
      { garmentType: { contains: filters.search } },
      { client: { customerName: { contains: filters.search } } },
    ]
  }
  const orders = await db.tailoringOrder.findMany({
    where,
    include: {
      client: { select: { id: true, customerName: true, phone: true } },
      measurement: { select: { id: true, recordDate: true } },
      assignedTo: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return { success: true, data: orders.map(serializeTailoringOrder) }
}

export async function getTailoringOrder(id: string) {
  const db = getPrisma()
  const order = await db.tailoringOrder.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, customerName: true, phone: true } },
      measurement: { select: { id: true, recordDate: true } },
      assignedTo: { select: { id: true, fullName: true } },
    },
  })
  if (!order) return { success: false, error: { code: 'TO-001', message: 'Tailoring order not found.' } }
  return { success: true, data: serializeTailoringOrder(order) }
}

export async function createTailoringOrder(payload: {
  clientId: string
  measurementRecordId?: string
  garmentType: string
  gender?: string
  styleRegion?: string
  fabricDescription?: string
  fabricSupplied?: string
  quantity?: number
  unitPrice: number
  advancePaid?: number
  trialDate?: string
  deliveryDate?: string
  assignedToId?: string
  specialInstructions?: string
  notes?: string
}) {
  const db = getPrisma()
  const quantity = payload.quantity ?? 1
  const unitPrice = payload.unitPrice
  const totalAmount = quantity * unitPrice

  const order = await db.$transaction(async (tx) => {
    const orderNumber = await generateOrderNumber(tx)
    return tx.tailoringOrder.create({
      data: {
        orderNumber,
        clientId: payload.clientId,
        measurementRecordId: payload.measurementRecordId ?? null,
        garmentType: payload.garmentType,
        gender: payload.gender ?? null,
        styleRegion: payload.styleRegion ?? null,
        fabricDescription: payload.fabricDescription ?? null,
        fabricSupplied: payload.fabricSupplied ?? 'CLIENT',
        quantity,
        unitPrice,
        totalAmount,
        advancePaid: payload.advancePaid ?? 0,
        trialDate: payload.trialDate ? new Date(payload.trialDate) : null,
        deliveryDate: payload.deliveryDate ? new Date(payload.deliveryDate) : null,
        assignedToId: payload.assignedToId ?? null,
        specialInstructions: payload.specialInstructions ?? null,
        notes: payload.notes ?? null,
      },
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
        measurement: { select: { id: true, recordDate: true } },
        assignedTo: { select: { id: true, fullName: true } },
      },
    })
  })
  await db.auditLog.create({ data: { action: 'CREATE', entityType: 'TailoringOrder', entityId: order.id, newValue: JSON.stringify({ orderNumber: order.orderNumber, garmentType: order.garmentType }) } }).catch(() => {})
  return { success: true, data: serializeTailoringOrder(order) }
}

export async function updateTailoringOrder(payload: {
  id: string
  measurementRecordId?: string | null
  garmentType?: string
  gender?: string | null
  styleRegion?: string | null
  fabricDescription?: string | null
  fabricSupplied?: string
  quantity?: number
  unitPrice?: number
  advancePaid?: number
  trialDate?: string | null
  deliveryDate?: string | null
  deliveredDate?: string | null
  status?: string
  assignedToId?: string | null
  invoiceId?: string | null
  specialInstructions?: string | null
  notes?: string | null
}) {
  const db = getPrisma()
  const { id, trialDate, deliveryDate, deliveredDate, quantity, unitPrice, ...rest } = payload
  const data: Record<string, unknown> = { ...rest }
  if (trialDate !== undefined) data.trialDate = trialDate ? new Date(trialDate) : null
  if (deliveryDate !== undefined) data.deliveryDate = deliveryDate ? new Date(deliveryDate) : null
  if (deliveredDate !== undefined) data.deliveredDate = deliveredDate ? new Date(deliveredDate) : null

  if (quantity !== undefined || unitPrice !== undefined) {
    const existing = await db.tailoringOrder.findUniqueOrThrow({ where: { id }, select: { quantity: true, unitPrice: true } })
    const newQty = quantity ?? existing.quantity
    const newPrice = unitPrice ?? Number(existing.unitPrice)
    data.quantity = newQty
    data.unitPrice = newPrice
    data.totalAmount = newQty * newPrice
  }

  const order = await db.tailoringOrder.update({
    where: { id },
    data,
    include: {
      client: { select: { id: true, customerName: true, phone: true } },
      measurement: { select: { id: true, recordDate: true } },
      assignedTo: { select: { id: true, fullName: true } },
    },
  })
  await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'TailoringOrder', entityId: order.id } }).catch(() => {})
  return { success: true, data: serializeTailoringOrder(order) }
}

export async function deleteTailoringOrder(id: string) {
  const db = getPrisma()
  const order = await db.tailoringOrder.findUnique({ where: { id }, select: { invoiceId: true } })
  if (order?.invoiceId) {
    return { success: false, error: { code: 'TO-002', message: 'Cannot delete an order that has an associated invoice.' } }
  }
  await db.tailoringOrder.delete({ where: { id } })
  await db.auditLog.create({ data: { action: 'DELETE', entityType: 'TailoringOrder', entityId: id } }).catch(() => {})
  return { success: true }
}

// BUG FOUND 2026-07-22: this function checked `order.invoiceId` then wrote
// it later with no atomic claim in between — a rapid double-click on
// "Generate Invoice" could create two invoices for one order, with the
// second write silently overwriting invoiceId and orphaning the first
// invoice. Fixed to match the atomic claim-sentinel pattern already
// established elsewhere in this codebase (e.g. rental.service.ts's
// generateRentalInvoice, hotel.service.ts's generateHotelInvoice).
const TAILORING_INVOICE_CLAIM_SENTINEL = 'CLAIMING'

export async function generateTailoringInvoice(id: string) {
  const db = getPrisma()
  try {
  const claim = await db.tailoringOrder.updateMany({ where: { id, invoiceId: null }, data: { invoiceId: TAILORING_INVOICE_CLAIM_SENTINEL } })
  if (claim.count === 0) {
    const existing = await db.tailoringOrder.findUnique({ where: { id }, select: { id: true, invoiceId: true } })
    if (!existing) return { success: false, error: { code: 'TO-001', message: 'Tailoring order not found.' } }
    if (existing.invoiceId === TAILORING_INVOICE_CLAIM_SENTINEL) return { success: false, error: { code: 'TO-005', message: 'Invoice generation already in progress for this order.' } }
    return { success: false, error: { code: 'TO-003', message: 'Invoice already generated for this order.' } }
  }

  try {
    const order = await db.tailoringOrder.findUnique({
      where: { id },
      include: { client: { select: { id: true, customerName: true } } },
    })
    if (!order) {
      await db.tailoringOrder.update({ where: { id }, data: { invoiceId: null } })
      return { success: false, error: { code: 'TO-001', message: 'Tailoring order not found.' } }
    }
    if (Number(order.totalAmount) === 0) {
      await db.tailoringOrder.update({ where: { id }, data: { invoiceId: null } })
      return { success: false, error: { code: 'TO-004', message: 'Order total is zero. Set a unit price before generating an invoice.' } }
    }

    // SAC 998821 — Tailoring services, 5% GST
    let tailoringProduct = await db.product.findFirst({ where: { hsnCode: '998821', isActive: true } })
    if (!tailoringProduct) {
      tailoringProduct = await db.product.create({
        data: { productName: 'Tailoring Services', productType: 'SERVICE', hsnCode: '998821', sellingPrice: 0, taxRate: 5, unit: 'NOS', isActive: true },
      })
    }

    // BUG FOUND 2026-07-22: `taxRate: 5` was also hardcoded on the invoice
    // ITEM here, permanently overriding the product's own configurable
    // rate — the same bug class fixed earlier this session across 13 other
    // vertical services. Removed so it falls through to
    // tailoringProduct.taxRate, owner-editable via Settings > Products.
    const result = await billingService.createInvoice({
      customerId: order.clientId,
      paymentMethod: 'CREDIT',
      gstType: 'CGST_SGST',
      items: [{ productId: tailoringProduct.id, quantity: order.quantity, unitPrice: Number(order.unitPrice) }],
      notes: `Order ${order.orderNumber} — ${order.garmentType} × ${order.quantity}`,
      referenceNumber: order.orderNumber,
    })
    if (!result.success) {
      await db.tailoringOrder.update({ where: { id }, data: { invoiceId: null } })
      return result
    }

    const invoice = result.data as { id: string }
    await db.tailoringOrder.update({ where: { id }, data: { invoiceId: invoice.id } })
    await db.auditLog.create({ data: { action: 'INVOICED', entityType: 'TailoringOrder', entityId: id, newValue: JSON.stringify({ invoiceId: invoice.id }) } }).catch(() => {})
    return { success: true, data: { invoiceId: invoice.id } }
  } catch (err) {
    await db.tailoringOrder.update({ where: { id }, data: { invoiceId: null } }).catch(() => {})
    throw err
  }
  } catch (e) {
    return { success: false, error: { code: 'TO-008', message: e instanceof Error ? e.message : 'Could not generate invoice.' } }
  }
}

export async function getTailoringKPIs() {
  const db = getPrisma()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const [activeOrders, readyForPickup, deliveredThisMonth] = await Promise.all([
    db.tailoringOrder.count({ where: { status: { in: ['RECEIVED', 'IN_CUTTING', 'IN_STITCHING', 'TRIAL_SCHEDULED', 'ALTERATIONS'] } } }),
    db.tailoringOrder.count({ where: { status: 'READY' } }),
    db.tailoringOrder.count({ where: { status: 'DELIVERED', deliveredDate: { gte: monthStart, lte: monthEnd } } }),
  ])
  return { success: true, data: { activeOrders, readyForPickup, deliveredThisMonth } }
}

// Phase 58 §2 — Tailor Boutique: a real trial/fitting Appointment, riding
// the SAME 24h/2h WhatsApp reminder pipeline every other appointment type
// already uses — no new reminder mechanism invented. trialDate is kept in
// sync (denormalized) for any existing reader that only ever expected a
// bare date (e.g. reports).
export async function scheduleTrialAppointment(payload: {
  orderId: string
  providerId?: string
  scheduledDate: string
  scheduledTime: string
  durationMinutes?: number
}) {
  const db = getPrisma()
  try {
    const order = await db.tailoringOrder.findUnique({
      where: { id: payload.orderId },
      select: { id: true, clientId: true, garmentType: true, orderNumber: true, trialAppointmentId: true },
    })
    if (!order) return { success: false, error: { code: 'TO-005', message: 'Tailoring order not found.' } }
    if (order.trialAppointmentId) return { success: false, error: { code: 'TO-006', message: 'A trial appointment is already scheduled for this order.' } }

    const apptResult = await createAppointment({
      customerId: order.clientId,
      providerId: payload.providerId,
      serviceTitle: `Trial / Fitting — ${order.garmentType} (${order.orderNumber})`,
      scheduledDate: payload.scheduledDate,
      scheduledTime: payload.scheduledTime,
      durationMinutes: payload.durationMinutes ?? 30,
      createdBy: 'system',
    })
    if (!apptResult.success) return apptResult

    const appointment = apptResult.data as { id: string }
    const order2 = await db.tailoringOrder.update({
      where: { id: payload.orderId },
      data: {
        trialAppointmentId: appointment.id,
        trialDate: new Date(payload.scheduledDate),
        status: 'TRIAL_SCHEDULED',
      },
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
        measurement: { select: { id: true, recordDate: true } },
        assignedTo: { select: { id: true, fullName: true } },
      },
    })

    // Reuses the existing appointment-reminder pipeline as-is — a genuine
    // WhatsApp delivery failure or missing phone number is expected/handled
    // there already, so a failure here shouldn't fail the whole action.
    await createAppointmentReminder(appointment.id).catch(() => {})

    await db.auditLog.create({ data: { action: 'TRIAL_SCHEDULED', entityType: 'TailoringOrder', entityId: payload.orderId, newValue: JSON.stringify({ appointmentId: appointment.id }) } }).catch(() => {})
    return { success: true, data: serializeTailoringOrder(order2) }
  } catch (err) {
    return { success: false, error: { code: 'TO-007', message: err instanceof Error ? err.message : 'Could not schedule trial appointment.' } }
  }
}

// Phase 58 §2 — Tailor Boutique: fabric-stock deduction when the shop
// supplies the material. Real inventory deduction (reuses the same
// inventoryService.reduceStockTx helper Repair's parts-tracking and
// billing/logistics/quotation already use) — set-once-then-clear-to-change,
// mirroring the add/remove pair pattern used for Repair's JobCardPart,
// rather than a plain mutable field (changing it after stock is deducted
// needs an explicit restore step first, not a silent overwrite).
export async function setOrderFabric(payload: {
  orderId: string
  fabricProductId: string
  fabricQuantity: number
}) {
  const db = getPrisma()
  try {
    if (payload.fabricQuantity <= 0) return { success: false, error: { code: 'TOF-001', message: 'Fabric quantity must be greater than zero.' } }

    const order = await db.tailoringOrder.findUnique({ where: { id: payload.orderId }, select: { id: true, orderNumber: true, fabricProductId: true } })
    if (!order) return { success: false, error: { code: 'TOF-002', message: 'Tailoring order not found.' } }
    if (order.fabricProductId) return { success: false, error: { code: 'TOF-003', message: 'This order already has fabric linked — clear it first before setting a different one.' } }

    const product = await db.product.findUnique({ where: { id: payload.fabricProductId }, select: { id: true } })
    if (!product) return { success: false, error: { code: 'TOF-004', message: 'Fabric product not found.' } }

    try {
      const updated = await db.$transaction(async (tx) => {
        await inventoryService.reduceStockTx(
          tx, payload.fabricProductId, payload.fabricQuantity,
          `Fabric supplied for tailoring order ${order.orderNumber}`, 'TAILORING_ORDER', order.orderNumber
        )
        return tx.tailoringOrder.update({
          where: { id: payload.orderId },
          data: { fabricProductId: payload.fabricProductId, fabricQuantity: payload.fabricQuantity, fabricSupplied: 'SHOP' },
          include: {
            client: { select: { id: true, customerName: true, phone: true } },
            measurement: { select: { id: true, recordDate: true } },
            assignedTo: { select: { id: true, fullName: true } },
          },
        })
      })
      await db.auditLog.create({ data: { action: 'FABRIC_SET', entityType: 'TailoringOrder', entityId: payload.orderId, newValue: JSON.stringify({ fabricProductId: payload.fabricProductId, fabricQuantity: payload.fabricQuantity }) } }).catch(() => {})
      return { success: true, data: serializeTailoringOrder(updated) }
    } catch (e: any) {
      if (e?.code === 'INV-002') return { success: false, error: { code: 'TOF-005', message: e.message } }
      throw e
    }
  } catch (err) {
    return { success: false, error: { code: 'TOF-006', message: err instanceof Error ? err.message : 'Could not set fabric.' } }
  }
}

export async function clearOrderFabric(orderId: string) {
  const db = getPrisma()
  try {
    const order = await db.tailoringOrder.findUnique({ where: { id: orderId }, select: { id: true, orderNumber: true, fabricProductId: true, fabricQuantity: true } })
    if (!order) return { success: false, error: { code: 'TOF-002', message: 'Tailoring order not found.' } }
    if (!order.fabricProductId || order.fabricQuantity == null) return { success: false, error: { code: 'TOF-007', message: 'No fabric is currently linked to this order.' } }

    const updated = await db.$transaction(async (tx) => {
      await tx.inventoryMovement.create({
        data: {
          productId: order.fabricProductId!,
          movementType: 'TAILORING_RETURN',
          quantity: order.fabricQuantity!,
          referenceType: 'TAILORING_ORDER',
          referenceId: order.orderNumber,
          remarks: `Fabric unlinked from tailoring order ${order.orderNumber}`,
        },
      })
      await tx.inventory.update({
        where: { productId: order.fabricProductId! },
        data: { quantity: { increment: order.fabricQuantity! } },
      })
      return tx.tailoringOrder.update({
        where: { id: orderId },
        data: { fabricProductId: null, fabricQuantity: null, fabricSupplied: 'CLIENT' },
        include: {
          client: { select: { id: true, customerName: true, phone: true } },
          measurement: { select: { id: true, recordDate: true } },
          assignedTo: { select: { id: true, fullName: true } },
        },
      })
    })
    await db.auditLog.create({ data: { action: 'FABRIC_CLEARED', entityType: 'TailoringOrder', entityId: orderId } }).catch(() => {})
    return { success: true, data: serializeTailoringOrder(updated) }
  } catch (err) {
    return { success: false, error: { code: 'TOF-008', message: err instanceof Error ? err.message : 'Could not clear fabric.' } }
  }
}
