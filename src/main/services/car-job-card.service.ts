import { getPrisma } from '../database/db'
import { billingService } from './billing.service'
import { generateSequenceNumber } from './sequence.service'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

// CarJobCard.laborTotal/partsTotal are Prisma Decimal fields — Electron's
// IPC (structured clone) cannot serialize a Decimal instance and throws
// "An object could not be cloned" on every response that includes one.
// Applied to every function below that returns a card.
function serializeCarJobCard<T extends { laborTotal: unknown; partsTotal: unknown }>(c: T): T {
  return { ...c, laborTotal: Number(c.laborTotal), partsTotal: Number(c.partsTotal) }
}

interface ServiceItem { name: string; quantity: number; unitPrice: number }
// productId is optional — a part genuinely not in the product catalog (a
// one-off sourced part) stays pure free text, exactly as before. A part WITH
// a productId gets billed as its own real invoice line in
// generateCarJobInvoice below, which is what actually ties it to Inventory —
// billing.service.ts's existing STANDARD-product handling deducts (and, on
// cancellation, restores) stock automatically, so no parallel
// deduct/reverse logic needed here.
interface PartItem { name: string; partNumber?: string; quantity: number; unitPrice: number; productId?: string }

function parseServiceItems(raw: string): ServiceItem[] {
  try { return JSON.parse(raw) as ServiceItem[] } catch { return [] }
}
function parsePartItems(raw: string): PartItem[] {
  try { return JSON.parse(raw) as PartItem[] } catch { return [] }
}

// Was a plain findFirst(orderBy desc)+increment called OUTSIDE any
// transaction, then create() run separately — the widest possible window
// for the race (see sequence.service.ts's header comment) since not even
// same-transaction serialization applied. Now generates the number and
// creates the record inside one $transaction.
async function generateJobNumber(tx: TxClient): Promise<string> {
  return generateSequenceNumber(
    tx, 'car_job_card_number_sequence', 'CJC', 5,
    async () => {
      const last = await tx.carJobCard.findFirst({ orderBy: { createdAt: 'desc' }, select: { jobNumber: true } })
      return last ? parseInt(last.jobNumber.replace('CJC-', ''), 10) : 0
    }
  )
}

export async function listCarJobCards(filters?: { status?: string; clientId?: string; search?: string }) {
  const db = getPrisma()
  const where: Record<string, unknown> = {}
  if (filters?.status) where.status = filters.status
  if (filters?.clientId) where.clientId = filters.clientId
  if (filters?.search) {
    where.OR = [
      { vehicleNumber: { contains: filters.search } },
      { vehicleMake: { contains: filters.search } },
      { vehicleModel: { contains: filters.search } },
      { client: { customerName: { contains: filters.search } } },
    ]
  }
  const cards = await db.carJobCard.findMany({
    where,
    include: {
      client: { select: { id: true, customerName: true, phone: true } },
      serviceAdvisor: { select: { id: true, fullName: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return { success: true, data: cards.map(serializeCarJobCard) }
}

export async function getCarJobCard(id: string) {
  const db = getPrisma()
  const card = await db.carJobCard.findUnique({
    where: { id },
    include: {
      client: { select: { id: true, customerName: true, phone: true } },
      serviceAdvisor: { select: { id: true, fullName: true } },
    },
  })
  if (!card) return { success: false, error: { code: 'CJC-001', message: 'Job card not found.' } }
  return { success: true, data: serializeCarJobCard(card) }
}

export async function createCarJobCard(payload: {
  clientId: string
  vehicleNumber: string
  vehicleMake: string
  vehicleModel: string
  vehicleYear?: number
  vehicleType?: string
  kmIn?: number
  serviceAdvisorId?: string
  technicianIds?: string[]
  serviceItems?: ServiceItem[]
  partsItems?: PartItem[]
  estimatedDelivery?: string
  notes?: string
  internalNotes?: string
}) {
  const db = getPrisma()
  const serviceItems = payload.serviceItems ?? []
  const partsItems = payload.partsItems ?? []
  const laborTotal = serviceItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const partsTotal = partsItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0)

  const card = await db.$transaction(async (tx) => {
    const jobNumber = await generateJobNumber(tx)
    return tx.carJobCard.create({
      data: {
        jobNumber,
        clientId: payload.clientId,
        vehicleNumber: payload.vehicleNumber.toUpperCase().replace(/\s+/g, ' ').trim(),
        vehicleMake: payload.vehicleMake,
        vehicleModel: payload.vehicleModel,
        vehicleYear: payload.vehicleYear ?? null,
        vehicleType: payload.vehicleType ?? '4W',
        kmIn: payload.kmIn ?? null,
        serviceAdvisorId: payload.serviceAdvisorId ?? null,
        technicianIds: JSON.stringify(payload.technicianIds ?? []),
        serviceItems: JSON.stringify(serviceItems),
        partsItems: JSON.stringify(partsItems),
        laborTotal,
        partsTotal,
        estimatedDelivery: payload.estimatedDelivery ? new Date(payload.estimatedDelivery) : null,
        notes: payload.notes ?? null,
        internalNotes: payload.internalNotes ?? null,
      },
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
        serviceAdvisor: { select: { id: true, fullName: true } },
      },
    })
  })
  await db.auditLog.create({ data: { action: 'CREATE', entityType: 'CarJobCard', entityId: card.id, newValue: JSON.stringify({ jobNumber: card.jobNumber, vehicleNumber: card.vehicleNumber }) } }).catch(() => {})
  return { success: true, data: serializeCarJobCard(card) }
}

export async function updateCarJobCard(payload: {
  id: string
  vehicleNumber?: string
  vehicleMake?: string
  vehicleModel?: string
  vehicleYear?: number | null
  vehicleType?: string
  kmIn?: number | null
  kmOut?: number | null
  serviceAdvisorId?: string | null
  technicianIds?: string[]
  serviceItems?: ServiceItem[]
  partsItems?: PartItem[]
  estimatedDelivery?: string | null
  deliveredDate?: string | null
  status?: string
  invoiceId?: string | null
  notes?: string | null
  internalNotes?: string | null
}) {
  const db = getPrisma()
  const { id, serviceItems, partsItems, estimatedDelivery, deliveredDate, vehicleNumber, ...rest } = payload

  const data: Record<string, unknown> = { ...rest }
  if (vehicleNumber !== undefined) data.vehicleNumber = vehicleNumber.toUpperCase().replace(/\s+/g, ' ').trim()
  if (serviceItems !== undefined) {
    data.serviceItems = JSON.stringify(serviceItems)
    data.laborTotal = serviceItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  }
  if (partsItems !== undefined) {
    data.partsItems = JSON.stringify(partsItems)
    data.partsTotal = partsItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  }
  if (estimatedDelivery !== undefined) data.estimatedDelivery = estimatedDelivery ? new Date(estimatedDelivery) : null
  if (deliveredDate !== undefined) data.deliveredDate = deliveredDate ? new Date(deliveredDate) : null

  const card = await db.carJobCard.update({
    where: { id },
    data,
    include: {
      client: { select: { id: true, customerName: true, phone: true } },
      serviceAdvisor: { select: { id: true, fullName: true } },
    },
  })
  await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'CarJobCard', entityId: card.id } }).catch(() => {})
  return { success: true, data: serializeCarJobCard(card) }
}

export async function deleteCarJobCard(id: string) {
  const db = getPrisma()
  const card = await db.carJobCard.findUnique({ where: { id }, select: { invoiceId: true, jobNumber: true } })
  if (card?.invoiceId) {
    return { success: false, error: { code: 'CJC-002', message: 'Cannot delete a job card that has an associated invoice.' } }
  }
  await db.carJobCard.delete({ where: { id } })
  await db.auditLog.create({ data: { action: 'DELETE', entityType: 'CarJobCard', entityId: id } }).catch(() => {})
  return { success: true }
}

export async function generateCarJobInvoice(id: string) {
  const db = getPrisma()
  const card = await db.carJobCard.findUnique({
    where: { id },
    include: { client: { select: { id: true, customerName: true } } },
  })
  if (!card) return { success: false, error: { code: 'CJC-001', message: 'Job card not found.' } }
  if (card.invoiceId) return { success: false, error: { code: 'CJC-003', message: 'Invoice already generated for this job card.' } }

  const laborTotal = Number(card.laborTotal)
  const partsTotal = Number(card.partsTotal)
  if (laborTotal === 0 && partsTotal === 0) {
    return { success: false, error: { code: 'CJC-004', message: 'Job card has no service items or parts. Add items before generating an invoice.' } }
  }

  const items: { productId: string; quantity: number; unitPrice: number; taxRate?: number }[] = []

  if (laborTotal > 0) {
    let laborProduct = await db.product.findFirst({ where: { hsnCode: '998731', isActive: true } })
    if (!laborProduct) {
      laborProduct = await db.product.create({
        data: { productName: 'Automotive Service / Labor', productType: 'SERVICE', hsnCode: '998731', sellingPrice: 0, taxRate: 18, unit: 'NOS', isActive: true },
      })
    }
    items.push({ productId: laborProduct.id, quantity: 1, unitPrice: laborTotal, taxRate: 18 })
  }

  // Parts linked to a real catalog product become their own STANDARD invoice
  // line (using the actual quantity/rate and the product's own tax rate) —
  // this is what makes billing.service.ts's existing inventory deduction
  // (and, on cancellation, restoration) apply to them. Parts with no
  // productId (not in the catalog) fall back to the old lumped generic line,
  // same as every job card created before this change.
  const partItems = parsePartItems(card.partsItems)
  let unlinkedPartsTotal = 0
  for (const part of partItems) {
    if (part.productId) {
      items.push({ productId: part.productId, quantity: part.quantity, unitPrice: part.unitPrice })
    } else {
      unlinkedPartsTotal += part.quantity * part.unitPrice
    }
  }

  if (unlinkedPartsTotal > 0) {
    let partsProduct = await db.product.findFirst({ where: { hsnCode: '87089990', isActive: true } })
    if (!partsProduct) {
      partsProduct = await db.product.create({
        data: { productName: 'Automobile Parts & Accessories', productType: 'PRODUCT', hsnCode: '87089990', sellingPrice: 0, taxRate: 28, unit: 'NOS', isActive: true },
      })
    }
    items.push({ productId: partsProduct.id, quantity: 1, unitPrice: unlinkedPartsTotal, taxRate: 28 })
  }

  const result = await billingService.createInvoice({
    customerId: card.clientId,
    paymentMethod: 'CREDIT',
    gstType: 'CGST_SGST',
    items,
    notes: `Job Card ${card.jobNumber} — ${card.vehicleMake} ${card.vehicleModel} (${card.vehicleNumber})`,
    referenceNumber: card.jobNumber,
  })
  if (!result.success) return result

  const invoice = result.data as { id: string }
  await db.carJobCard.update({ where: { id }, data: { invoiceId: invoice.id, status: 'READY' } })
  await db.auditLog.create({ data: { action: 'INVOICED', entityType: 'CarJobCard', entityId: id, newValue: JSON.stringify({ invoiceId: invoice.id }) } }).catch(() => {})
  return { success: true, data: { invoiceId: invoice.id } }
}

export async function getCarJobCardKPIs() {
  const db = getPrisma()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const [active, readyForPickup, deliveredThisMonth] = await Promise.all([
    db.carJobCard.count({ where: { status: { in: ['RECEIVED', 'INSPECTION', 'IN_PROGRESS', 'WAITING_PARTS'] } } }),
    db.carJobCard.count({ where: { status: 'READY' } }),
    db.carJobCard.count({ where: { status: 'DELIVERED', deliveredDate: { gte: monthStart, lte: monthEnd } } }),
  ])
  return { success: true, data: { active, readyForPickup, deliveredThisMonth } }
}
