import { getPrisma } from '../database/db'
import { billingService } from './billing.service'

// TreatmentPlan.totalEstimatedCost is a Prisma Decimal, not a plain number —
// Electron's IPC (structured clone) cannot serialize a Decimal instance and
// throws "An object could not be cloned" on every response that includes one,
// including from create()/update() returning the row they just wrote. This
// was masked until now by the recordedById/createdById FK bug always
// throwing first.
function serializePlan<T extends { totalEstimatedCost: unknown }>(plan: T): T {
  return { ...plan, totalEstimatedCost: Number(plan.totalEstimatedCost) }
}

export async function listTreatmentPlans(patientId: string) {
  try {
    const db = getPrisma()
    const plans = await db.treatmentPlan.findMany({
      where: { patientId },
      include: { createdBy: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: plans.map(serializePlan) }
  } catch (err) {
    return { success: false, error: { code: 'TP-001', message: err instanceof Error ? err.message : 'Could not list treatment plans.' } }
  }
}

export async function getTreatmentPlan(id: string) {
  try {
    const db = getPrisma()
    const plan = await db.treatmentPlan.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, customerName: true, phone: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    })
    if (!plan) return { success: false, error: { code: 'TP-002', message: 'Treatment plan not found.' } }
    return { success: true, data: serializePlan(plan) }
  } catch (err) {
    return { success: false, error: { code: 'TP-002', message: err instanceof Error ? err.message : 'Could not fetch treatment plan.' } }
  }
}

export async function createTreatmentPlan(payload: {
  patientId: string
  createdById?: string
  userId?: string
  title?: string
  status?: string
  planItems?: string
  totalEstimatedCost?: number
  notes?: string
}) {
  try {
    const db = getPrisma()
    const plan = await db.treatmentPlan.create({
      data: {
        patientId: payload.patientId,
        createdById: payload.createdById ?? null,
        title: payload.title ?? 'Treatment Plan',
        status: payload.status ?? 'PROPOSED',
        planItems: payload.planItems ?? '[]',
        totalEstimatedCost: payload.totalEstimatedCost ?? 0,
        notes: payload.notes ?? null,
      },
    })

    await db.auditLog.create({
      data: { userId: payload.userId ?? null, action: 'CREATE', entityType: 'TreatmentPlan', entityId: plan.id, newValue: JSON.stringify({ patientId: payload.patientId }) },
    }).catch(() => {})

    return { success: true, data: serializePlan(plan) }
  } catch (err) {
    return { success: false, error: { code: 'TP-003', message: err instanceof Error ? err.message : 'Could not create treatment plan.' } }
  }
}

export async function updateTreatmentPlan(payload: {
  id: string
  title?: string
  status?: string
  planItems?: string
  totalEstimatedCost?: number
  notes?: string | null
  acceptedDate?: string | null
  completedDate?: string | null
}) {
  try {
    const db = getPrisma()
    const { id, acceptedDate, completedDate, ...rest } = payload
    const plan = await db.treatmentPlan.update({
      where: { id },
      data: {
        ...rest,
        ...(acceptedDate !== undefined ? { acceptedDate: acceptedDate ? new Date(acceptedDate) : null } : {}),
        ...(completedDate !== undefined ? { completedDate: completedDate ? new Date(completedDate) : null } : {}),
      },
    })

    await db.auditLog.create({
      data: { action: 'UPDATE', entityType: 'TreatmentPlan', entityId: id },
    }).catch(() => {})

    return { success: true, data: serializePlan(plan) }
  } catch (err) {
    return { success: false, error: { code: 'TP-004', message: err instanceof Error ? err.message : 'Could not update treatment plan.' } }
  }
}

async function findOrCreateDentalServiceProduct() {
  const db = getPrisma()
  const hsnCode = '999312' // dental services
  let product = await db.product.findFirst({ where: { hsnCode, isActive: true } })
  if (!product) {
    product = await db.product.create({
      data: { productName: 'Dental Treatment Services', productType: 'SERVICE', hsnCode, sellingPrice: 0, taxRate: 18, unit: 'NOS', isActive: true },
    })
  }
  return product
}

// Phase 67 §9.1 item 21.1 — Dental Clinic: treatment-plan conversion
// tracking (quoted→accepted→billed). Mirrors generateInvoiceForServiceProject's
// own "one product, one line per real chargeable item" pattern (time-entry.service.ts)
// rather than inventing a new invoice-generation shape. Only a plan that's
// actually been accepted (not still PROPOSED, not DECLINED) can be billed —
// billing an unaccepted plan would silently invent acceptance the patient
// never gave. A plan can only be billed once: `invoiceId` is the claim.
export async function generateInvoiceFromTreatmentPlan(payload: { treatmentPlanId: string }, userId?: string) {
  try {
    const db = getPrisma()
    const plan = await db.treatmentPlan.findUnique({ where: { id: payload.treatmentPlanId } })
    if (!plan) return { success: false, error: { code: 'TP-005', message: 'Treatment plan not found.' } }
    if (plan.invoiceId) return { success: false, error: { code: 'TP-006', message: 'This treatment plan has already been billed.' } }
    if (plan.status === 'PROPOSED' || plan.status === 'DECLINED') {
      return { success: false, error: { code: 'TP-007', message: 'Only an accepted treatment plan can be billed.' } }
    }

    let items: Array<{ toothNumber?: number; procedure: string; estimatedCost: number; itemStatus: string }> = []
    try { items = JSON.parse(plan.planItems) } catch { items = [] }
    const billableItems = items.filter((i) => i.estimatedCost > 0)
    if (billableItems.length === 0) return { success: false, error: { code: 'TP-008', message: 'This plan has no priced items to bill.' } }

    const product = await findOrCreateDentalServiceProduct()
    const result = await billingService.createInvoice({
      customerId: plan.patientId,
      paymentMethod: 'CREDIT',
      gstType: 'CGST_SGST',
      items: billableItems.map((i) => ({
        productId: product.id,
        quantity: 1,
        unitPrice: i.estimatedCost,
        variantInfo: (i.toothNumber ? `Tooth #${i.toothNumber} — ${i.procedure}` : i.procedure).slice(0, 100),
      })),
      notes: plan.title,
      referenceNumber: plan.id.slice(0, 12),
    }, userId)
    if (!result.success) return result

    const invoice = result.data as { id: string }
    await db.treatmentPlan.update({ where: { id: plan.id }, data: { invoiceId: invoice.id } })
    await db.auditLog.create({
      data: { userId: userId ?? null, action: 'INVOICED', entityType: 'TreatmentPlan', entityId: plan.id, newValue: JSON.stringify({ invoiceId: invoice.id }) },
    }).catch(() => {})

    return { success: true, data: { invoiceId: invoice.id } }
  } catch (err) {
    return { success: false, error: { code: 'TP-009', message: err instanceof Error ? err.message : 'Could not generate invoice for treatment plan.' } }
  }
}
