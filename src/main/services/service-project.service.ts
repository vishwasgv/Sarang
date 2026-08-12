import { getPrisma } from '../database/db'
import { serializeMilestone } from './service-project-milestone.service'
import { serializeTimeEntry } from './time-entry.service'
import { parseLocalDateStart, toLocalDateOnlyIso } from '../utils/date.util'

// ServiceProject.totalContractValue is a Prisma Decimal field — Electron's
// IPC (structured clone) cannot serialize a Decimal instance and throws "An
// object could not be cloned" on every response that includes one. Every
// function below also nests `milestones[]` (its own Decimal field,
// milestoneAmount) and getServiceProject additionally nests `timeEntries[]`
// (its own Decimal fields) — both serialized via the shared helpers from
// their respective services so the fix stays in one place.
//
// Real bug found live (2026-07-28 service-vertical audit): startDate/
// expectedEndDate/completedDate are DateTime fields, which structured clone
// DOES preserve across IPC without throwing (unlike Decimal) — so this half
// was never caught by a clone error; it shipped as a live renderer crash
// instead. ProjectsScreen.tsx's edit-form populator (openEditProject) calls
// `p.startDate.slice(0, 10)` / `p.expectedEndDate.slice(0, 10)` directly,
// assuming an ISO string. Same bug class as compliance-task.service.ts's
// serializeTask — see date.util.ts's toLocalDateOnlyIso for the shared fix.
// completedDate is stamped with a real time-of-day (`new Date()` at status
// transition, not a date-only user input), so it's serialized via plain
// toISOString() instead — mirroring how createdAt/updatedAt are handled
// elsewhere, not truncated to a date-only value.
function serializeProject<T extends { totalContractValue: unknown; adSpendBudget?: unknown; milestones?: unknown[]; startDate: Date | null; expectedEndDate: Date | null; completedDate: Date | null }>(p: T): T {
  return {
    ...p,
    totalContractValue: (p as { totalContractValue: unknown }).totalContractValue == null ? null : Number((p as { totalContractValue: unknown }).totalContractValue),
    ...('adSpendBudget' in p ? { adSpendBudget: p.adSpendBudget == null ? null : Number(p.adSpendBudget) } : {}),
    ...(p.milestones ? { milestones: p.milestones.map((m) => serializeMilestone(m as Parameters<typeof serializeMilestone>[0])) } : {}),
    startDate: (p.startDate ? toLocalDateOnlyIso(p.startDate) : null) as unknown as Date,
    expectedEndDate: (p.expectedEndDate ? toLocalDateOnlyIso(p.expectedEndDate) : null) as unknown as Date,
    completedDate: (p.completedDate ? p.completedDate.toISOString() : null) as unknown as Date,
  }
}

export async function listServiceProjects(filters?: {
  clientId?: string
  assignedToId?: string
  status?: string
}) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.clientId) where.clientId = filters.clientId
    if (filters?.assignedToId) where.assignedToId = filters.assignedToId
    if (filters?.status) where.status = filters.status
    const projects = await db.serviceProject.findMany({
      where,
      include: {
        client:     { select: { id: true, customerName: true, phone: true } },
        assignedTo: { select: { id: true, fullName: true } },
        milestones: { orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }] },
        _count:     { select: { timeEntries: true, issues: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    })
    return { success: true, data: projects.map(serializeProject) }
  } catch (err) {
    return { success: false, error: { code: 'SP30-001', message: err instanceof Error ? err.message : 'Could not list projects.' } }
  }
}

export async function getServiceProject(id: string) {
  try {
    const db = getPrisma()
    const project = await db.serviceProject.findUnique({
      where: { id },
      include: {
        client:     { select: { id: true, customerName: true, phone: true } },
        assignedTo: { select: { id: true, fullName: true } },
        milestones: { orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }] },
        timeEntries: {
          include: { employee: { select: { id: true, fullName: true } } },
          orderBy: { date: 'desc' },
        },
      },
    })
    if (!project) return { success: false, error: { code: 'SP30-NOT-FOUND', message: 'Project not found.' } }
    return {
      success: true,
      data: serializeProject({ ...project, timeEntries: project.timeEntries.map(serializeTimeEntry) }),
    }
  } catch (err) {
    return { success: false, error: { code: 'SP30-002', message: err instanceof Error ? err.message : 'Could not get project.' } }
  }
}

export async function createServiceProject(payload: {
  clientId: string
  projectName: string
  projectType?: string
  stage?: string
  status?: string
  billingMethod?: string
  totalContractValue?: number
  startDate?: string
  expectedEndDate?: string
  assignedToId?: string
  notes?: string
  targetChannel?: string
  deliverableType?: string
  adSpendBudget?: number
}) {
  try {
    const db = getPrisma()
    const project = await db.serviceProject.create({
      data: {
        clientId:           payload.clientId,
        projectName:        payload.projectName.trim(),
        projectType:        payload.projectType ?? 'GENERAL',
        stage:              payload.stage ?? null,
        status:             payload.status ?? 'ACTIVE',
        billingMethod:      payload.billingMethod ?? 'FIXED_COST',
        totalContractValue: payload.totalContractValue ?? null,
        // Real bug found live (2026-07-28 service-vertical audit): a bare
        // `new Date('YYYY-MM-DD')` parses as UTC midnight — inconsistent
        // with the parseLocalDateStart fix already applied to every other
        // date-only write in this service family.
        startDate:          payload.startDate ? parseLocalDateStart(payload.startDate) : null,
        expectedEndDate:    payload.expectedEndDate ? parseLocalDateStart(payload.expectedEndDate) : null,
        assignedToId:       payload.assignedToId ?? null,
        notes:              payload.notes ?? null,
        targetChannel:      payload.targetChannel ?? null,
        deliverableType:    payload.deliverableType ?? null,
        adSpendBudget:      payload.adSpendBudget ?? null,
      },
      include: {
        client:     { select: { id: true, customerName: true, phone: true } },
        assignedTo: { select: { id: true, fullName: true } },
        milestones: true,
        _count:     { select: { timeEntries: true, issues: true } },
      },
    })
    await db.auditLog.create({ data: { action: 'CREATE', entityType: 'ServiceProject', entityId: project.id, newValue: JSON.stringify({ projectName: project.projectName }) } }).catch(() => {})
    return { success: true, data: serializeProject(project) }
  } catch (err) {
    return { success: false, error: { code: 'SP30-003', message: err instanceof Error ? err.message : 'Could not create project.' } }
  }
}

export async function updateServiceProject(payload: {
  id: string
  projectName?: string
  projectType?: string
  stage?: string | null
  status?: string
  billingMethod?: string
  totalContractValue?: number | null
  startDate?: string | null
  expectedEndDate?: string | null
  completedDate?: string | null
  assignedToId?: string | null
  notes?: string | null
  targetChannel?: string | null
  deliverableType?: string | null
  adSpendBudget?: number | null
}) {
  try {
    const db = getPrisma()
    const { id, projectName, startDate, expectedEndDate, completedDate, ...rest } = payload
    // Auto-manage completedDate based on status transition
    let autoCompletedDate: Date | null | undefined
    if (payload.status === 'COMPLETED' && completedDate === undefined) {
      autoCompletedDate = new Date()
    } else if ((payload.status === 'ACTIVE' || payload.status === 'ON_HOLD') && completedDate === undefined) {
      autoCompletedDate = null
    }
    const project = await db.serviceProject.update({
      where: { id },
      data: {
        ...rest,
        ...(projectName !== undefined ? { projectName: projectName.trim() } : {}),
        ...(startDate !== undefined       ? { startDate:       startDate       ? parseLocalDateStart(startDate)       : null } : {}),
        ...(expectedEndDate !== undefined ? { expectedEndDate: expectedEndDate ? parseLocalDateStart(expectedEndDate) : null } : {}),
        ...(completedDate !== undefined        ? { completedDate: completedDate ? new Date(completedDate) : null } : {}),
        ...(autoCompletedDate !== undefined    ? { completedDate: autoCompletedDate } : {}),
      },
      include: {
        client:     { select: { id: true, customerName: true, phone: true } },
        assignedTo: { select: { id: true, fullName: true } },
        milestones: { orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }] },
        _count:     { select: { timeEntries: true, issues: true } },
      },
    })
    await db.auditLog.create({ data: { action: payload.status === 'COMPLETED' ? 'COMPLETED' : 'UPDATE', entityType: 'ServiceProject', entityId: project.id } }).catch(() => {})
    return { success: true, data: serializeProject(project) }
  } catch (err) {
    return { success: false, error: { code: 'SP30-004', message: err instanceof Error ? err.message : 'Could not update project.' } }
  }
}

export async function deleteServiceProject(id: string) {
  try {
    const db = getPrisma()
    await db.serviceProject.delete({ where: { id } })
    await db.auditLog.create({ data: { action: 'DELETE', entityType: 'ServiceProject', entityId: id } }).catch(() => {})
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'SP30-005', message: err instanceof Error ? err.message : 'Could not delete project.' } }
  }
}
