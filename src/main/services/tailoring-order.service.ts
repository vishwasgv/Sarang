import { getPrisma } from '../database/db'
import { billingService } from './billing.service'
import { generateSequenceNumber } from './sequence.service'

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

export async function generateTailoringInvoice(id: string) {
  const db = getPrisma()
  const order = await db.tailoringOrder.findUnique({
    where: { id },
    include: { client: { select: { id: true, customerName: true } } },
  })
  if (!order) return { success: false, error: { code: 'TO-001', message: 'Tailoring order not found.' } }
  if (order.invoiceId) return { success: false, error: { code: 'TO-003', message: 'Invoice already generated for this order.' } }
  if (Number(order.totalAmount) === 0) {
    return { success: false, error: { code: 'TO-004', message: 'Order total is zero. Set a unit price before generating an invoice.' } }
  }

  // SAC 998821 — Tailoring services, 5% GST
  let tailoringProduct = await db.product.findFirst({ where: { hsnCode: '998821', isActive: true } })
  if (!tailoringProduct) {
    tailoringProduct = await db.product.create({
      data: { productName: 'Tailoring Services', productType: 'SERVICE', hsnCode: '998821', sellingPrice: 0, taxRate: 5, unit: 'NOS', isActive: true },
    })
  }

  const result = await billingService.createInvoice({
    customerId: order.clientId,
    paymentMethod: 'CREDIT',
    gstType: 'CGST_SGST',
    items: [{ productId: tailoringProduct.id, quantity: order.quantity, unitPrice: Number(order.unitPrice), taxRate: 5 }],
    notes: `Order ${order.orderNumber} — ${order.garmentType} × ${order.quantity}`,
    referenceNumber: order.orderNumber,
  })
  if (!result.success) return result

  const invoice = result.data as { id: string }
  await db.tailoringOrder.update({ where: { id }, data: { invoiceId: invoice.id } })
  await db.auditLog.create({ data: { action: 'INVOICED', entityType: 'TailoringOrder', entityId: id, newValue: JSON.stringify({ invoiceId: invoice.id }) } }).catch(() => {})
  return { success: true, data: { invoiceId: invoice.id } }
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
