import { getPrisma } from '../database/db'
import { serializeMilestone } from './service-project-milestone.service'
import { serializeTimeEntry } from './time-entry.service'

// ServiceProject.totalContractValue is a Prisma Decimal field — Electron's
// IPC (structured clone) cannot serialize a Decimal instance and throws "An
// object could not be cloned" on every response that includes one. Every
// function below also nests `milestones[]` (its own Decimal field,
// milestoneAmount) and getServiceProject additionally nests `timeEntries[]`
// (its own Decimal fields) — both serialized via the shared helpers from
// their respective services so the fix stays in one place.
function serializeProject<T extends { totalContractValue: unknown; adSpendBudget?: unknown; milestones?: unknown[] }>(p: T): T {
  return {
    ...p,
    totalContractValue: (p as { totalContractValue: unknown }).totalContractValue == null ? null : Number((p as { totalContractValue: unknown }).totalContractValue),
    ...('adSpendBudget' in p ? { adSpendBudget: p.adSpendBudget == null ? null : Number(p.adSpendBudget) } : {}),
    ...(p.milestones ? { milestones: p.milestones.map((m) => serializeMilestone(m as Parameters<typeof serializeMilestone>[0])) } : {}),
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
        totalContractValue: payload.totalContractValue ?? null,
        startDate:          payload.startDate ? new Date(payload.startDate) : null,
        expectedEndDate:    payload.expectedEndDate ? new Date(payload.expectedEndDate) : null,
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
        ...(startDate !== undefined       ? { startDate:       startDate       ? new Date(startDate)       : null } : {}),
        ...(expectedEndDate !== undefined ? { expectedEndDate: expectedEndDate ? new Date(expectedEndDate) : null } : {}),
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
