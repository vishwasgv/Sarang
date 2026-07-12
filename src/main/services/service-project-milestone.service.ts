import { getPrisma } from '../database/db'
import { billingService } from './billing.service'

// ServiceProjectMilestone.milestoneAmount is a Prisma Decimal field —
// Electron's IPC (structured clone) cannot serialize a Decimal instance and
// throws "An object could not be cloned" on every response that includes
// one. Exported so service-project.service.ts can apply it to milestone
// rows nested under a project (listServiceProjects/getServiceProject's
// `include: { milestones }`).
export function serializeMilestone<T extends { milestoneAmount: unknown }>(m: T): T {
  return { ...m, milestoneAmount: m.milestoneAmount == null ? null : Number(m.milestoneAmount) }
}

export async function listMilestones(projectId: string) {
  try {
    const db = getPrisma()
    const milestones = await db.serviceProjectMilestone.findMany({
      where: { projectId },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    })
    return { success: true, data: milestones.map(serializeMilestone) }
  } catch (err) {
    return { success: false, error: { code: 'MS30-001', message: err instanceof Error ? err.message : 'Could not list milestones.' } }
  }
}

export async function createMilestone(payload: {
  projectId: string
  milestoneName: string
  milestoneAmount?: number
  status?: string
  dueDate?: string
  notes?: string
}) {
  try {
    const db = getPrisma()
    const milestone = await db.serviceProjectMilestone.create({
      data: {
        projectId:       payload.projectId,
        milestoneName:   payload.milestoneName.trim(),
        milestoneAmount: payload.milestoneAmount ?? null,
        status:          payload.status ?? 'UPCOMING',
        dueDate:         payload.dueDate ? new Date(payload.dueDate) : null,
        notes:           payload.notes ?? null,
      },
    })
    await db.auditLog.create({ data: { action: 'CREATE', entityType: 'ServiceProjectMilestone', entityId: milestone.id, newValue: JSON.stringify({ milestoneName: milestone.milestoneName }) } }).catch(() => {})
    return { success: true, data: serializeMilestone(milestone) }
  } catch (err) {
    return { success: false, error: { code: 'MS30-002', message: err instanceof Error ? err.message : 'Could not create milestone.' } }
  }
}

export async function updateMilestone(payload: {
  id: string
  milestoneName?: string
  milestoneAmount?: number | null
  status?: string
  dueDate?: string | null
  completedDate?: string | null
  notes?: string | null
}) {
  try {
    const db = getPrisma()
    const { id, milestoneName, dueDate, completedDate, milestoneAmount, ...rest } = payload
    if (milestoneAmount != null && milestoneAmount < 0) {
      return { success: false, error: { code: 'MS30-009', message: 'Milestone amount cannot be negative.' } }
    }
    // Auto-manage completedDate based on status transition
    let autoCompletedDate: Date | null | undefined
    if (payload.status === 'COMPLETED' && completedDate === undefined) {
      autoCompletedDate = new Date()
    } else if ((payload.status === 'UPCOMING' || payload.status === 'IN_PROGRESS') && completedDate === undefined) {
      autoCompletedDate = null
    }
    const milestone = await db.serviceProjectMilestone.update({
      where: { id },
      data: {
        ...rest,
        ...(milestoneAmount !== undefined ? { milestoneAmount } : {}),
        ...(milestoneName !== undefined  ? { milestoneName: milestoneName.trim() } : {}),
        ...(dueDate !== undefined        ? { dueDate:       dueDate       ? new Date(dueDate)       : null } : {}),
        ...(completedDate !== undefined  ? { completedDate: completedDate ? new Date(completedDate) : null } : {}),
        ...(autoCompletedDate !== undefined ? { completedDate: autoCompletedDate } : {}),
      },
    })
    await db.auditLog.create({ data: { action: payload.status === 'COMPLETED' ? 'COMPLETED' : 'UPDATE', entityType: 'ServiceProjectMilestone', entityId: milestone.id } }).catch(() => {})
    return { success: true, data: serializeMilestone(milestone) }
  } catch (err) {
    return { success: false, error: { code: 'MS30-003', message: err instanceof Error ? err.message : 'Could not update milestone.' } }
  }
}

// Phase 40: closes a stub explicitly shaped for invoicing when Phase 30 added
// ServiceProjectMilestone.invoiceId and a status value of INVOICED, but never
// added the function that actually generates one. Same find-or-create
// service-product + billingService.createInvoice pattern as
// property-deal.service.ts's generateCommissionInvoice.
// Sentinel written to ServiceProjectMilestone.invoiceId while a generation
// is in flight — see the identical pattern (and its rationale) in
// time-entry.service.ts's INVOICE_CLAIM_SENTINEL.
const INVOICE_CLAIM_SENTINEL = 'PENDING_INVOICE_GENERATION'

export async function generateMilestoneInvoice(milestoneId: string) {
  const db = getPrisma()
  try {
    // Atomic claim first — a single UPDATE...WHERE invoiceId IS NULL is one
    // SQL statement, executed atomically under SQLite's single-writer lock,
    // so two near-simultaneous calls for the same milestone can't both pass.
    const claim = await db.serviceProjectMilestone.updateMany({
      where: { id: milestoneId, invoiceId: null },
      data: { invoiceId: INVOICE_CLAIM_SENTINEL },
    })
    if (claim.count === 0) {
      const existing = await db.serviceProjectMilestone.findUnique({ where: { id: milestoneId }, select: { id: true } })
      if (!existing) return { success: false, error: { code: 'MS30-005', message: 'Milestone not found.' } }
      return { success: false, error: { code: 'MS30-006', message: 'Invoice already generated for this milestone.' } }
    }

    try {
      const milestone = await db.serviceProjectMilestone.findUnique({
        where: { id: milestoneId },
        include: { project: { select: { id: true, clientId: true, projectName: true } } },
      })
      if (!milestone || milestone.milestoneAmount == null || Number(milestone.milestoneAmount) <= 0) {
        await db.serviceProjectMilestone.update({ where: { id: milestoneId }, data: { invoiceId: null } })
        return { success: false, error: { code: 'MS30-007', message: 'Set a milestone amount greater than zero before generating an invoice.' } }
      }

      let product = await db.product.findFirst({ where: { hsnCode: '998311', isActive: true } })
      if (!product) {
        product = await db.product.create({
          data: { productName: 'Professional Consulting Services', productType: 'SERVICE', hsnCode: '998311', sellingPrice: 0, taxRate: 18, unit: 'NOS', isActive: true },
        })
      }

      const result = await billingService.createInvoice({
        customerId: milestone.project.clientId,
        paymentMethod: 'CREDIT',
        gstType: 'CGST_SGST',
        items: [{
          productId: product.id,
          quantity: 1,
          unitPrice: Number(milestone.milestoneAmount),
          taxRate: 18,
        }],
        notes: `Milestone: ${milestone.milestoneName} — ${milestone.project.projectName}`,
        referenceNumber: milestoneId.slice(0, 12),
      })
      if (!result.success) {
        await db.serviceProjectMilestone.update({ where: { id: milestoneId }, data: { invoiceId: null } })
        return result
      }

      const invoice = result.data as { id: string }
      await db.serviceProjectMilestone.update({ where: { id: milestoneId }, data: { invoiceId: invoice.id, status: 'INVOICED' } })
      await db.auditLog.create({ data: { action: 'INVOICED', entityType: 'ServiceProjectMilestone', entityId: milestoneId, newValue: JSON.stringify({ invoiceId: invoice.id }) } }).catch(() => {})

      return { success: true, data: { invoiceId: invoice.id } }
    } catch (err) {
      await db.serviceProjectMilestone.update({ where: { id: milestoneId }, data: { invoiceId: null } }).catch(() => {})
      throw err
    }
  } catch (err) {
    return { success: false, error: { code: 'MS30-008', message: err instanceof Error ? err.message : 'Could not generate milestone invoice.' } }
  }
}

export async function deleteMilestone(id: string) {
  try {
    const db = getPrisma()
    const milestone = await db.serviceProjectMilestone.findUnique({ where: { id }, select: { invoiceId: true } })
    if (milestone?.invoiceId) {
      return { success: false, error: { code: 'MS30-010', message: 'Cannot delete a milestone that has an associated invoice.' } }
    }
    await db.serviceProjectMilestone.delete({ where: { id } })
    await db.auditLog.create({ data: { action: 'DELETE', entityType: 'ServiceProjectMilestone', entityId: id } }).catch(() => {})
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'MS30-004', message: err instanceof Error ? err.message : 'Could not delete milestone.' } }
  }
}
