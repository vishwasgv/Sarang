import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { generateSequenceNumber, SequenceContendedError } from './sequence.service'
import { billingService } from './billing.service'
import { inventoryService } from './inventory.service'

export interface JobCardRecord {
  id: string
  jobNumber: string
  title: string
  itemDescription: string | null
  status: 'RECEIVED' | 'DIAGNOSING' | 'IN_REPAIR' | 'PENDING_PARTS' | 'READY' | 'DELIVERED' | 'CANCELLED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  customerId: string | null
  customerName: string | null
  assignedToId: string | null
  assignedToName: string | null
  estimatedCost: number
  actualCost: number
  receivedDate: string
  expectedDate: string | null
  deliveredDate: string | null
  notes: string | null
  internalNotes: string | null
  invoiceId: string | null
  // Phase 58 §2 — Repair: warranty-on-repair
  warrantyDays: number | null
  warrantyExpiryDate: string | null
  isUnderWarranty: boolean | null
  warrantyClaimAgainstId: string | null
  warrantyClaimAgainstJobNumber: string | null
  createdAt: string
  updatedAt: string
}

function toRecord(j: any): JobCardRecord {
  const warrantyExpiryDate = j.warrantyExpiryDate ? new Date(j.warrantyExpiryDate) : null
  return {
    id: j.id,
    jobNumber: j.jobNumber,
    title: j.title,
    itemDescription: j.itemDescription ?? null,
    status: j.status,
    priority: j.priority,
    customerId: j.customerId ?? null,
    customerName: j.customer?.customerName ?? null,
    assignedToId: j.assignedToId ?? null,
    assignedToName: j.assignedTo?.fullName ?? null,
    estimatedCost: j.estimatedCost,
    actualCost: j.actualCost,
    receivedDate: new Date(j.receivedDate).toISOString(),
    expectedDate: j.expectedDate ? new Date(j.expectedDate).toISOString() : null,
    deliveredDate: j.deliveredDate ? new Date(j.deliveredDate).toISOString() : null,
    notes: j.notes ?? null,
    internalNotes: j.internalNotes ?? null,
    invoiceId: j.invoiceId ?? null,
    warrantyDays: j.warrantyDays ?? null,
    warrantyExpiryDate: warrantyExpiryDate ? warrantyExpiryDate.toISOString() : null,
    isUnderWarranty: warrantyExpiryDate ? warrantyExpiryDate.getTime() > Date.now() : null,
    warrantyClaimAgainstId: j.warrantyClaimAgainstId ?? null,
    warrantyClaimAgainstJobNumber: j.warrantyClaimAgainst?.jobNumber ?? null,
    createdAt: new Date(j.createdAt).toISOString(),
    updatedAt: new Date(j.updatedAt).toISOString()
  }
}

const include = {
  customer: { select: { customerName: true } },
  assignedTo: { select: { fullName: true } },
  warrantyClaimAgainst: { select: { jobNumber: true } }
}

export async function listJobCards(payload?: {
  status?: string
  customerId?: string
  limit?: number
}): Promise<{ success: boolean; data?: { jobCards: JobCardRecord[]; total: number }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (payload?.status) where.status = payload.status
    if (payload?.customerId) where.customerId = payload.customerId

    const rows = await db.jobCard.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
      take: payload?.limit ?? 200
    })
    return { success: true, data: { jobCards: rows.map(toRecord), total: rows.length } }
  } catch (e: any) {
    console.error('[JC_LIST_FAIL]', e)
    return { success: false, error: { code: 'JC_LIST_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}

export async function createJobCard(payload: {
  title: string
  itemDescription?: string
  priority?: string
  customerId?: string
  assignedToId?: string
  estimatedCost?: number
  expectedDate?: string
  notes?: string
  internalNotes?: string
  warrantyClaimAgainstId?: string
}, userId?: string): Promise<{ success: boolean; data?: JobCardRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const row = await db.$transaction(async (tx) => {
      const jobNumber = await generateSequenceNumber(
        tx, 'job_card_number_sequence', 'JOB', 5,
        async () => {
          const last = await tx.jobCard.findFirst({ orderBy: { createdAt: 'desc' }, select: { jobNumber: true } })
          return last ? parseInt(last.jobNumber.replace('JOB-', ''), 10) : 0
        }
      )
      return tx.jobCard.create({
        data: {
          jobNumber,
          title: payload.title,
          itemDescription: payload.itemDescription ?? null,
          priority: payload.priority ?? 'MEDIUM',
          customerId: payload.customerId ?? null,
          assignedToId: payload.assignedToId ?? null,
          estimatedCost: payload.estimatedCost ?? 0,
          expectedDate: payload.expectedDate ? new Date(payload.expectedDate) : null,
          notes: payload.notes ?? null,
          internalNotes: payload.internalNotes ?? null,
          createdById: userId ?? null,
          // Phase 58 §2 — a comeback under a prior job's repair warranty.
          // Informational only: never validated/rejected here, since a shop
          // may still choose to accept an out-of-warranty comeback as a
          // fresh paid job — toRecord() surfaces isUnderWarranty for the
          // ORIGINAL job so staff can see the real fact and decide.
          warrantyClaimAgainstId: payload.warrantyClaimAgainstId ?? null
        },
        include
      })
    })

    if (userId) await logAction(userId, 'CREATE', 'JOB_CARD', row.id, null, { jobNumber: row.jobNumber, title: payload.title })
    return { success: true, data: toRecord(row) }
  } catch (e: unknown) {
    // Was `message: e.message` — leaked the raw Prisma unique-constraint
    // text (or now SequenceContendedError's message) straight to the user
    // instead of a normal "please try again" message, unlike every other
    // service's catch-all convention.
    if (e instanceof SequenceContendedError) {
      return { success: false, error: { code: 'JC-002', message: 'The system is busy creating another job card right now. Please try again in a moment.' } }
    }
    return { success: false, error: { code: 'JC_CREATE_FAIL', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function updateJobCard(payload: {
  id: string
  title?: string
  itemDescription?: string
  status?: string
  priority?: string
  customerId?: string | null
  assignedToId?: string | null
  estimatedCost?: number
  actualCost?: number
  expectedDate?: string | null
  deliveredDate?: string | null
  notes?: string
  internalNotes?: string
  warrantyDays?: number | null
}, userId?: string): Promise<{ success: boolean; data?: JobCardRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const old = await db.jobCard.findUnique({ where: { id: payload.id }, select: { status: true, jobNumber: true, warrantyDays: true } })
    if (!old) return { success: false, error: { code: 'JC_NOT_FOUND', message: 'Job card not found' } }

    const data: Record<string, unknown> = {}
    if (payload.title !== undefined) data.title = payload.title
    if (payload.itemDescription !== undefined) data.itemDescription = payload.itemDescription
    let deliveredJustNow = false
    if (payload.status !== undefined) {
      data.status = payload.status
      if (payload.status === 'DELIVERED' && old.status !== 'DELIVERED') {
        data.deliveredDate = new Date()
        deliveredJustNow = true
      }
    }
    if (payload.priority !== undefined) data.priority = payload.priority
    if ('customerId' in payload) data.customerId = payload.customerId ?? null
    if ('assignedToId' in payload) data.assignedToId = payload.assignedToId ?? null
    if (payload.estimatedCost !== undefined) data.estimatedCost = payload.estimatedCost
    if (payload.actualCost !== undefined) data.actualCost = payload.actualCost
    if ('expectedDate' in payload) data.expectedDate = payload.expectedDate ? new Date(payload.expectedDate) : null
    if ('deliveredDate' in payload) data.deliveredDate = payload.deliveredDate ? new Date(payload.deliveredDate) : null
    if (payload.notes !== undefined) data.notes = payload.notes
    if (payload.internalNotes !== undefined) data.internalNotes = payload.internalNotes

    // Phase 58 §2 — warranty-on-repair: warrantyDays can be set any time
    // (e.g. quoted up front), but warrantyExpiryDate only ever gets a real
    // value once there's an actual deliveredDate to count it from.
    if ('warrantyDays' in payload) data.warrantyDays = payload.warrantyDays ?? null
    const effectiveWarrantyDays = 'warrantyDays' in payload ? payload.warrantyDays : old.warrantyDays
    if (deliveredJustNow && effectiveWarrantyDays != null && effectiveWarrantyDays > 0) {
      data.warrantyExpiryDate = new Date((data.deliveredDate as Date).getTime() + effectiveWarrantyDays * 86400000)
    } else if ('warrantyDays' in payload && payload.warrantyDays != null && payload.warrantyDays > 0 && (data.deliveredDate || old.status === 'DELIVERED')) {
      // warrantyDays set/changed on an already-delivered job — recompute
      // expiry from its existing deliveredDate.
      const existing = await db.jobCard.findUnique({ where: { id: payload.id }, select: { deliveredDate: true } })
      if (existing?.deliveredDate) {
        data.warrantyExpiryDate = new Date(existing.deliveredDate.getTime() + payload.warrantyDays * 86400000)
      }
    }

    const row = await db.jobCard.update({ where: { id: payload.id }, data, include })
    if (userId) await logAction(userId, 'UPDATE', 'JOB_CARD', payload.id, old, data)
    return { success: true, data: toRecord(row) }
  } catch (e: any) {
    console.error('[JC_UPDATE_FAIL]', e)
    return { success: false, error: { code: 'JC_UPDATE_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}

export async function deleteJobCard(id: string, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const row = await db.jobCard.findUnique({ where: { id }, select: { status: true, jobNumber: true } })
    if (!row) return { success: false, error: { code: 'JC_NOT_FOUND', message: 'Job card not found' } }
    if (row.status === 'IN_REPAIR' || row.status === 'PENDING_PARTS') return { success: false, error: { code: 'JC_ACTIVE', message: 'Cannot delete a job card currently in repair or awaiting parts.' } }

    await db.jobCard.delete({ where: { id } })
    if (userId) await logAction(userId, 'DELETE', 'JOB_CARD', id, row, null)
    return { success: true }
  } catch (e: any) {
    console.error('[JC_DELETE_FAIL]', e)
    return { success: false, error: { code: 'JC_DELETE_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}

// Phase 58 §2 — Repair: parts actually consumed on a job card, backed by
// REAL inventory deduction (reuses inventoryService.reduceStockTx, the same
// helper billing/logistics/quotation already use to decrement real stock —
// not the free-text JSON blob CarJobCard's partsItems uses, which never
// touches Inventory at all).

export interface JobCardPartRecord {
  id: string
  jobCardId: string
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  createdAt: string
}

function toPartRecord(p: any): JobCardPartRecord {
  return {
    id: p.id,
    jobCardId: p.jobCardId,
    productId: p.productId,
    productName: p.product?.productName ?? '',
    quantity: p.quantity,
    unitPrice: p.unitPrice,
    createdAt: new Date(p.createdAt).toISOString(),
  }
}

export async function listJobCardParts(jobCardId: string) {
  try {
    const db = getPrisma()
    const parts = await db.jobCardPart.findMany({
      where: { jobCardId },
      include: { product: { select: { productName: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return { success: true, data: parts.map(toPartRecord) }
  } catch (e: any) {
    console.error('[JCP_LIST_FAIL]', e)
    return { success: false, error: { code: 'JCP_LIST_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}

export async function addJobCardPart(payload: {
  jobCardId: string
  productId: string
  quantity: number
}, userId?: string) {
  try {
    if (payload.quantity <= 0) return { success: false, error: { code: 'JCP-001', message: 'Quantity must be greater than zero.' } }
    const db = getPrisma()

    const job = await db.jobCard.findUnique({ where: { id: payload.jobCardId }, select: { id: true, jobNumber: true } })
    if (!job) return { success: false, error: { code: 'JCP-002', message: 'Job card not found.' } }
    const product = await db.product.findUnique({ where: { id: payload.productId }, select: { id: true, sellingPrice: true } })
    if (!product) return { success: false, error: { code: 'JCP-003', message: 'Product not found.' } }

    try {
      const part = await db.$transaction(async (tx) => {
        // Unit price is snapshotted at time of use — a later price change on
        // the Product must never retroactively rewrite what this job was
        // actually charged for.
        await inventoryService.reduceStockTx(
          tx, payload.productId, payload.quantity,
          `Used on job card ${job.jobNumber}`, 'JOB_CARD', job.jobNumber, userId
        )
        return tx.jobCardPart.create({
          data: {
            jobCardId: payload.jobCardId,
            productId: payload.productId,
            quantity: payload.quantity,
            unitPrice: product.sellingPrice,
          },
          include: { product: { select: { productName: true } } },
        })
      })
      if (userId) await logAction(userId, 'CREATE', 'JOB_CARD_PART', part.id, null, { jobCardId: payload.jobCardId, productId: payload.productId, quantity: payload.quantity })
      return { success: true, data: toPartRecord(part) }
    } catch (e: any) {
      if (e?.code === 'INV-002') return { success: false, error: { code: 'JCP-004', message: e.message } }
      throw e
    }
  } catch (e: any) {
    console.error('[JCP_ADD_FAIL]', e)
    return { success: false, error: { code: 'JCP_ADD_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}

// Undoes a mis-added part — restores the exact quantity to Inventory (a
// correction, not a purchase, so this deliberately does NOT touch
// averageCost, same convention returns.service.ts's RETURN_IN uses).
export async function removeJobCardPart(id: string, userId?: string) {
  try {
    const db = getPrisma()
    const part = await db.jobCardPart.findUnique({ where: { id } })
    if (!part) return { success: false, error: { code: 'JCP-005', message: 'Part usage record not found.' } }

    const job = await db.jobCard.findUnique({ where: { id: part.jobCardId }, select: { jobNumber: true } })

    await db.$transaction(async (tx) => {
      await tx.inventoryMovement.create({
        data: {
          productId: part.productId,
          movementType: 'REPAIR_RETURN',
          quantity: part.quantity,
          referenceType: 'JOB_CARD',
          referenceId: job?.jobNumber ?? part.jobCardId,
          remarks: `Removed from job card ${job?.jobNumber ?? part.jobCardId}`,
          createdById: userId ?? null,
        },
      })
      await tx.inventory.update({
        where: { productId: part.productId },
        data: { quantity: { increment: part.quantity } },
      })
      await tx.jobCardPart.delete({ where: { id } })
    })

    if (userId) await logAction(userId, 'DELETE', 'JOB_CARD_PART', id, part, null)
    return { success: true, data: { id } }
  } catch (e: any) {
    console.error('[JCP_REMOVE_FAIL]', e)
    return { success: false, error: { code: 'JCP_REMOVE_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}

// Phase 58 §1 (2026-07-17) — legacy Repair Shop invoicing bridge, matching
// the generate*Invoice(id) pattern already proven on CarJobCard/Placement/
// etc. Bills actualCost if the shop has recorded one (the real, final
// figure), falling back to estimatedCost so a job can still be invoiced
// before actualCost is filled in.
export async function generateJobCardInvoice(id: string, userId?: string) {
  try {
    const db = getPrisma()
    const job = await db.jobCard.findUnique({ where: { id } })
    if (!job) return { success: false, error: { code: 'JC-003', message: 'Job card not found.' } }
    if (!job.customerId) return { success: false, error: { code: 'JC-004', message: 'This job card has no linked customer. Set a customer before generating an invoice.' } }
    if (job.invoiceId) return { success: false, error: { code: 'JC-005', message: 'Invoice already generated for this job card.' } }
    const billAmount = job.actualCost > 0 ? job.actualCost : job.estimatedCost
    if (billAmount <= 0) return { success: false, error: { code: 'JC-006', message: 'This job card has no billable amount. Set a cost before generating an invoice.' } }

    // SAC 998719 — Repair and maintenance services, 18% GST
    let product = await db.product.findFirst({ where: { hsnCode: '998719', isActive: true } })
    if (!product) {
      product = await db.product.create({
        data: { productName: 'Repair & Maintenance Services', productType: 'SERVICE', hsnCode: '998719', sellingPrice: 0, taxRate: 18, unit: 'NOS', isActive: true },
      })
    }

    const result = await billingService.createInvoice({
      customerId: job.customerId,
      paymentMethod: 'CREDIT',
      gstType: 'CGST_SGST',
      items: [{ productId: product.id, quantity: 1, unitPrice: billAmount }],
      notes: `Job Card ${job.jobNumber} — ${job.title}`,
      referenceNumber: job.jobNumber,
    })
    if (!result.success) return { success: false as const, error: result.error }

    const invoice = result.data as { id: string }
    await db.jobCard.update({ where: { id }, data: { invoiceId: invoice.id } })
    if (userId) await logAction(userId, 'INVOICED', 'JOB_CARD', id, null, { invoiceId: invoice.id })
    return { success: true, data: { invoiceId: invoice.id } }
  } catch (e: any) {
    console.error('[JC_INVOICE_FAIL]', e)
    return { success: false, error: { code: 'JC_INVOICE_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}
