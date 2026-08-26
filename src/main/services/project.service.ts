import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { generateSequenceNumber, SequenceContendedError } from './sequence.service'
import { billingService } from './billing.service'

export interface ProjectRecord {
  id: string
  projectNumber: string
  title: string
  description: string | null
  status: 'OPEN' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  customerId: string | null
  customerName: string | null
  assignedToId: string | null
  assignedToName: string | null
  estimatedHours: number
  estimatedAmount: number
  startDate: string | null
  dueDate: string | null
  completedDate: string | null
  notes: string | null
  totalTasks: number
  doneTasks: number
  totalLoggedHours: number
  invoiceId: string | null
  // Phase 67 §9.1 — Consultant item 1: engagement-letter -> project
  // auto-conversion tracking.
  quotationId: string | null
  quotationNumber: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectTaskRecord {
  id: string
  projectId: string
  title: string
  description: string | null
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE'
  priority: 'LOW' | 'MEDIUM' | 'HIGH'
  estimatedHours: number
  dueDate: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

function toRecord(p: any): ProjectRecord {
  const doneTasks = (p.tasks ?? []).filter((t: any) => t.status === 'DONE').length
  const totalLoggedHours = (p.workLogs ?? []).reduce((s: number, l: any) => s + l.hours, 0)
  return {
    id: p.id,
    projectNumber: p.projectNumber,
    title: p.title,
    description: p.description ?? null,
    status: p.status,
    priority: p.priority,
    customerId: p.customerId ?? null,
    customerName: p.customer?.customerName ?? null,
    assignedToId: p.assignedToId ?? null,
    assignedToName: p.assignedTo?.fullName ?? null,
    estimatedHours: p.estimatedHours,
    estimatedAmount: p.estimatedAmount,
    startDate: p.startDate ? new Date(p.startDate).toISOString() : null,
    dueDate: p.dueDate ? new Date(p.dueDate).toISOString() : null,
    completedDate: p.completedDate ? new Date(p.completedDate).toISOString() : null,
    notes: p.notes ?? null,
    totalTasks: (p.tasks ?? []).length,
    doneTasks,
    totalLoggedHours,
    invoiceId: p.invoiceId ?? null,
    quotationId: p.quotationId ?? null,
    quotationNumber: p.quotation?.quotationNumber ?? null,
    createdAt: new Date(p.createdAt).toISOString(),
    updatedAt: new Date(p.updatedAt).toISOString()
  }
}

const include = {
  customer: { select: { customerName: true } },
  assignedTo: { select: { fullName: true } },
  quotation: { select: { quotationNumber: true } },
  tasks: { select: { status: true } },
  workLogs: { select: { hours: true } }
}

export async function listProjects(payload?: {
  status?: string
  customerId?: string
  limit?: number
}): Promise<{ success: boolean; data?: { projects: ProjectRecord[]; total: number }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (payload?.status) where.status = payload.status
    if (payload?.customerId) where.customerId = payload.customerId

    const rows = await db.project.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
      take: payload?.limit ?? 200
    })
    return { success: true, data: { projects: rows.map(toRecord), total: rows.length } }
  } catch (e: any) {
    console.error('[PRJ_LIST_FAIL]', e)
    return { success: false, error: { code: 'PRJ_LIST_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}

export async function getProject(id: string): Promise<{ success: boolean; data?: ProjectRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const row = await db.project.findUnique({ where: { id }, include })
    if (!row) return { success: false, error: { code: 'PRJ_NOT_FOUND', message: 'Project not found' } }
    return { success: true, data: toRecord(row) }
  } catch (e: any) {
    console.error('[PRJ_GET_FAIL]', e)
    return { success: false, error: { code: 'PRJ_GET_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}

export async function createProject(payload: {
  title: string
  description?: string
  priority?: string
  customerId?: string
  assignedToId?: string
  estimatedHours?: number
  estimatedAmount?: number
  startDate?: string
  dueDate?: string
  notes?: string
  // Phase 67 §9.1 — Consultant item 1: engagement-letter -> project
  // auto-conversion. Set when this project is created directly from an
  // ACCEPTED Quotation (this vertical's "engagement letter").
  quotationId?: string
}, userId?: string): Promise<{ success: boolean; data?: ProjectRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    if (payload.quotationId) {
      const quotation = await db.quotation.findUnique({ where: { id: payload.quotationId }, select: { status: true, project: { select: { id: true } } } })
      if (!quotation) return { success: false, error: { code: 'PRJ-009', message: 'Quotation not found.' } }
      if (quotation.status !== 'ACCEPTED') return { success: false, error: { code: 'PRJ-010', message: 'Only an accepted quotation can be converted into a project.' } }
      if (quotation.project) return { success: false, error: { code: 'PRJ-011', message: 'This quotation has already been converted into a project.' } }
    }
    const row = await db.$transaction(async (tx) => {
      const projectNumber = await generateSequenceNumber(
        tx, 'project_number_sequence', 'PRJ', 5,
        async () => {
          const last = await tx.project.findFirst({ orderBy: { createdAt: 'desc' }, select: { projectNumber: true } })
          return last ? parseInt(last.projectNumber.replace('PRJ-', ''), 10) : 0
        }
      )
      return tx.project.create({
        data: {
          projectNumber,
          title: payload.title,
          description: payload.description ?? null,
          priority: payload.priority ?? 'MEDIUM',
          customerId: payload.customerId ?? null,
          assignedToId: payload.assignedToId ?? null,
          estimatedHours: payload.estimatedHours ?? 0,
          estimatedAmount: payload.estimatedAmount ?? 0,
          startDate: payload.startDate ? new Date(payload.startDate) : null,
          dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
          notes: payload.notes ?? null,
          createdById: userId ?? null,
          quotationId: payload.quotationId ?? null
        },
        include
      })
    })

    if (userId) await logAction(userId, 'CREATE', 'PROJECT', row.id, null, { projectNumber: row.projectNumber, title: payload.title })
    return { success: true, data: toRecord(row) }
  } catch (e: unknown) {
    if (e instanceof SequenceContendedError) {
      return { success: false, error: { code: 'PRJ-002', message: 'The system is busy creating another project right now. Please try again in a moment.' } }
    }
    return { success: false, error: { code: 'PRJ_CREATE_FAIL', message: 'Something unexpected happened. Please try again.' } }
  }
}

// Phase 67 §9.1 — Consultant item 1: engagement-letter -> project
// auto-conversion tracking. Same shape as service-ticket.service.ts's own
// getQuoteToJobConversionStats — how many ACCEPTED quotations actually
// became real project engagements.
export async function getEngagementConversionStats() {
  try {
    const db = getPrisma()
    const [acceptedCount, convertedCount] = await Promise.all([
      db.quotation.count({ where: { status: 'ACCEPTED' } }),
      db.quotation.count({ where: { status: 'ACCEPTED', project: { isNot: null } } }),
    ])
    return {
      success: true,
      data: {
        acceptedQuotations: acceptedCount,
        convertedToProject: convertedCount,
        conversionRatePercent: acceptedCount > 0 ? Math.round((convertedCount / acceptedCount) * 1000) / 10 : 0,
      },
    }
  } catch (e) {
    return { success: false, error: { code: 'PRJ-013', message: e instanceof Error ? e.message : 'Could not compute engagement conversion stats.' } }
  }
}

// Phase 67 §9.1 — Consultant item 5: proposal win-rate tracking. A
// "proposal" is a Quotation in this codebase's own vocabulary — kept
// deliberately lightweight (the audit tags this a Feature, not a Report),
// same shape as service-ticket.service.ts's own getQuoteToJobConversionStats.
export async function getProposalWinRateStats(): Promise<{ success: boolean; data?: { totalProposals: number; won: number; lost: number; pending: number; winRatePercent: number }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const [total, won, lost] = await Promise.all([
      db.quotation.count(),
      db.quotation.count({ where: { status: 'ACCEPTED' } }),
      db.quotation.count({ where: { status: 'EXPIRED' } })
    ])
    const decided = won + lost
    return {
      success: true,
      data: {
        totalProposals: total,
        won,
        lost,
        pending: total - decided,
        winRatePercent: decided > 0 ? Math.round((won / decided) * 1000) / 10 : 0
      }
    }
  } catch (e) {
    return { success: false, error: { code: 'PRJ-012', message: e instanceof Error ? e.message : 'Could not compute proposal win-rate stats.' } }
  }
}

export async function updateProject(payload: {
  id: string
  title?: string
  description?: string
  status?: string
  priority?: string
  customerId?: string | null
  assignedToId?: string | null
  estimatedHours?: number
  estimatedAmount?: number
  startDate?: string | null
  dueDate?: string | null
  completedDate?: string | null
  notes?: string
}, userId?: string): Promise<{ success: boolean; data?: ProjectRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const old = await db.project.findUnique({ where: { id: payload.id }, select: { status: true, title: true } })
    if (!old) return { success: false, error: { code: 'PRJ_NOT_FOUND', message: 'Project not found' } }

    const data: Record<string, unknown> = {}
    if (payload.title !== undefined) data.title = payload.title
    if (payload.description !== undefined) data.description = payload.description
    if (payload.status !== undefined) {
      data.status = payload.status
      if (payload.status === 'COMPLETED' && old.status !== 'COMPLETED') data.completedDate = new Date()
    }
    if (payload.priority !== undefined) data.priority = payload.priority
    if ('customerId' in payload) data.customerId = payload.customerId ?? null
    if ('assignedToId' in payload) data.assignedToId = payload.assignedToId ?? null
    if (payload.estimatedHours !== undefined) data.estimatedHours = payload.estimatedHours
    if (payload.estimatedAmount !== undefined) data.estimatedAmount = payload.estimatedAmount
    if ('startDate' in payload) data.startDate = payload.startDate ? new Date(payload.startDate) : null
    if ('dueDate' in payload) data.dueDate = payload.dueDate ? new Date(payload.dueDate) : null
    if ('completedDate' in payload) data.completedDate = payload.completedDate ? new Date(payload.completedDate) : null
    if (payload.notes !== undefined) data.notes = payload.notes

    const row = await db.project.update({ where: { id: payload.id }, data, include })
    if (userId) await logAction(userId, 'UPDATE', 'PROJECT', payload.id, old, data)
    return { success: true, data: toRecord(row) }
  } catch (e: any) {
    console.error('[PRJ_UPDATE_FAIL]', e)
    return { success: false, error: { code: 'PRJ_UPDATE_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}

export async function deleteProject(id: string, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const row = await db.project.findUnique({ where: { id }, select: { status: true, title: true } })
    if (!row) return { success: false, error: { code: 'PRJ_NOT_FOUND', message: 'Project not found' } }
    if (row.status === 'IN_PROGRESS') return { success: false, error: { code: 'PRJ_ACTIVE', message: 'Cannot delete an in-progress project. Change status first.' } }

    await db.project.delete({ where: { id } })
    if (userId) await logAction(userId, 'DELETE', 'PROJECT', id, row, null)
    return { success: true }
  } catch (e: any) {
    console.error('[PRJ_DELETE_FAIL]', e)
    return { success: false, error: { code: 'PRJ_DELETE_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}

// Phase 58 §1 (2026-07-17) — legacy SERVICE/CONSULTANT invoicing bridge,
// matching the generate*Invoice(id) pattern already proven on CarJobCard/
// Placement/etc. Bills the project's estimatedAmount as a single SERVICE
// line — this is the legacy Project model's only stored monetary figure
// (no per-task or per-hour billing exists on this model).
// Real bug found 2026-07-23: this had no atomic claim on invoiceId — just a
// plain read-then-check (`if (project.invoiceId) return error`) with the
// actual write only happening via a plain update() AFTER
// billingService.createInvoice() had already run. Two concurrent "Generate
// Invoice" calls for the same project could both pass the stale check and
// each create a real, separate Invoice — a genuine double-bill. Fixed with
// the same atomic conditional-claim + release-on-failure shape used by
// car-job-card.service.ts / job-card.service.ts / property-deal.service.ts.
const PROJECT_INVOICE_CLAIM_SENTINEL = 'PENDING_INVOICE_GENERATION'

export async function generateProjectInvoice(id: string, userId?: string) {
  const db = getPrisma()
  const claim = await db.project.updateMany({ where: { id, invoiceId: null }, data: { invoiceId: PROJECT_INVOICE_CLAIM_SENTINEL } })
  if (claim.count === 0) {
    const existing = await db.project.findUnique({ where: { id }, select: { id: true } })
    if (!existing) return { success: false, error: { code: 'PRJ-003', message: 'Project not found.' } }
    return { success: false, error: { code: 'PRJ-005', message: 'Invoice already generated for this project.' } }
  }

  try {
    const project = await db.project.findUnique({ where: { id } })
    if (!project) {
      await db.project.update({ where: { id }, data: { invoiceId: null } })
      return { success: false, error: { code: 'PRJ-003', message: 'Project not found.' } }
    }
    if (!project.customerId) {
      await db.project.update({ where: { id }, data: { invoiceId: null } })
      return { success: false, error: { code: 'PRJ-004', message: 'This project has no linked customer. Set a customer before generating an invoice.' } }
    }
    if (project.estimatedAmount <= 0) {
      await db.project.update({ where: { id }, data: { invoiceId: null } })
      return { success: false, error: { code: 'PRJ-006', message: 'This project has no billable amount. Set an amount before generating an invoice.' } }
    }

    // SAC 998313 — IT consulting and support services, 18% GST
    let product = await db.product.findFirst({ where: { hsnCode: '998313', isActive: true } })
    if (!product) {
      product = await db.product.create({
        data: { productName: 'Professional / Consulting Services', productType: 'SERVICE', hsnCode: '998313', sellingPrice: 0, taxRate: 18, unit: 'NOS', isActive: true },
      })
    }

    const result = await billingService.createInvoice({
      customerId: project.customerId,
      paymentMethod: 'CREDIT',
      gstType: 'CGST_SGST',
      items: [{ productId: product.id, quantity: 1, unitPrice: project.estimatedAmount }],
      notes: `Project ${project.projectNumber} — ${project.title}`,
      referenceNumber: project.projectNumber,
    })
    if (!result.success) {
      await db.project.update({ where: { id }, data: { invoiceId: null } })
      return { success: false as const, error: result.error }
    }

    const invoice = result.data as { id: string }
    await db.project.update({ where: { id }, data: { invoiceId: invoice.id } })
    if (userId) await logAction(userId, 'INVOICED', 'PROJECT', id, null, { invoiceId: invoice.id })
    return { success: true, data: { invoiceId: invoice.id } }
  } catch (e: any) {
    await db.project.update({ where: { id }, data: { invoiceId: null } }).catch(() => {})
    console.error('[PRJ_INVOICE_FAIL]', e)
    return { success: false, error: { code: 'PRJ_INVOICE_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}

// Project Tasks
export async function listProjectTasks(projectId: string): Promise<{ success: boolean; data?: { tasks: ProjectTaskRecord[] }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const rows = await db.projectTask.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } })
    const tasks: ProjectTaskRecord[] = rows.map(t => ({
      id: t.id,
      projectId: t.projectId,
      title: t.title,
      description: t.description ?? null,
      status: t.status as ProjectTaskRecord['status'],
      priority: t.priority as ProjectTaskRecord['priority'],
      estimatedHours: t.estimatedHours,
      dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
      completedAt: t.completedAt ? new Date(t.completedAt).toISOString() : null,
      createdAt: new Date(t.createdAt).toISOString(),
      updatedAt: new Date(t.updatedAt).toISOString()
    }))
    return { success: true, data: { tasks } }
  } catch (e: any) {
    console.error('[TASK_LIST_FAIL]', e)
    return { success: false, error: { code: 'TASK_LIST_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}

export async function createProjectTask(payload: {
  projectId: string
  title: string
  description?: string
  priority?: string
  estimatedHours?: number
  dueDate?: string
}, userId?: string): Promise<{ success: boolean; data?: ProjectTaskRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const project = await db.project.findUnique({ where: { id: payload.projectId }, select: { id: true } })
    if (!project) return { success: false, error: { code: 'PRJ_NOT_FOUND', message: 'Project not found' } }

    const row = await db.projectTask.create({
      data: {
        projectId: payload.projectId,
        title: payload.title,
        description: payload.description ?? null,
        priority: payload.priority ?? 'MEDIUM',
        estimatedHours: payload.estimatedHours ?? 0,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : null
      }
    })
    return {
      success: true, data: {
        id: row.id, projectId: row.projectId, title: row.title, description: row.description ?? null,
        status: row.status as ProjectTaskRecord['status'], priority: row.priority as ProjectTaskRecord['priority'],
        estimatedHours: row.estimatedHours, dueDate: row.dueDate ? new Date(row.dueDate).toISOString() : null,
        completedAt: null, createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString()
      }
    }
  } catch (e: any) {
    console.error('[TASK_CREATE_FAIL]', e)
    return { success: false, error: { code: 'TASK_CREATE_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}

export async function updateProjectTask(payload: {
  id: string
  title?: string
  description?: string
  status?: string
  priority?: string
  estimatedHours?: number
  dueDate?: string | null
}, userId?: string): Promise<{ success: boolean; data?: ProjectTaskRecord; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const data: Record<string, unknown> = {}
    if (payload.title !== undefined) data.title = payload.title
    if (payload.description !== undefined) data.description = payload.description
    if (payload.status !== undefined) {
      data.status = payload.status
      data.completedAt = payload.status === 'DONE' ? new Date() : null
    }
    if (payload.priority !== undefined) data.priority = payload.priority
    if (payload.estimatedHours !== undefined) data.estimatedHours = payload.estimatedHours
    if ('dueDate' in payload) data.dueDate = payload.dueDate ? new Date(payload.dueDate) : null

    const row = await db.projectTask.update({ where: { id: payload.id }, data })
    return {
      success: true, data: {
        id: row.id, projectId: row.projectId, title: row.title, description: row.description ?? null,
        status: row.status as ProjectTaskRecord['status'], priority: row.priority as ProjectTaskRecord['priority'],
        estimatedHours: row.estimatedHours, dueDate: row.dueDate ? new Date(row.dueDate).toISOString() : null,
        completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null,
        createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString()
      }
    }
  } catch (e: any) {
    console.error('[TASK_UPDATE_FAIL]', e)
    return { success: false, error: { code: 'TASK_UPDATE_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}

export async function deleteProjectTask(id: string, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const row = await db.projectTask.findUnique({ where: { id }, select: { title: true, projectId: true } })
    await db.projectTask.delete({ where: { id } })
    if (userId && row) await logAction(userId, 'DELETE', 'PROJECT_TASK', id, row, null)
    return { success: true }
  } catch (e: any) {
    console.error('[TASK_DELETE_FAIL]', e)
    return { success: false, error: { code: 'TASK_DELETE_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}
