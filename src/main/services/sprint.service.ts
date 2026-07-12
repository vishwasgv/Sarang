import { getPrisma } from '../database/db'

export async function listSprints(projectId: string) {
  try {
    const db = getPrisma()
    const sprints = await db.sprint.findMany({
      where: { projectId },
      include: {
        issues: {
          include: { assignedTo: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { sprintNumber: 'asc' },
    })
    return { success: true, data: sprints }
  } catch (err) {
    return { success: false, error: { code: 'SR30-001', message: err instanceof Error ? err.message : 'Could not list sprints.' } }
  }
}

export async function createSprint(payload: {
  projectId: string
  name?: string
  goal?: string
  startDate: string
  endDate: string
}) {
  try {
    const db = getPrisma()
    // Auto-assign next sprint number
    const last = await db.sprint.findFirst({
      where: { projectId: payload.projectId },
      orderBy: { sprintNumber: 'desc' },
    })
    const sprintNumber = (last?.sprintNumber ?? 0) + 1
    const sprint = await db.sprint.create({
      data: {
        projectId:    payload.projectId,
        sprintNumber,
        name:      payload.name ?? `Sprint ${sprintNumber}`,
        goal:      payload.goal ?? null,
        startDate: new Date(payload.startDate),
        endDate:   new Date(payload.endDate),
      },
      include: {
        issues: { include: { assignedTo: { select: { id: true, fullName: true } } } },
      },
    })
    await db.auditLog.create({ data: { action: 'CREATE', entityType: 'Sprint', entityId: sprint.id, newValue: JSON.stringify({ sprintNumber: sprint.sprintNumber, name: sprint.name }) } }).catch(() => {})
    return { success: true, data: sprint }
  } catch (err) {
    return { success: false, error: { code: 'SR30-002', message: err instanceof Error ? err.message : 'Could not create sprint.' } }
  }
}

export async function updateSprint(payload: {
  id: string
  name?: string | null
  goal?: string | null
  startDate?: string
  endDate?: string
  status?: string
}) {
  try {
    const db = getPrisma()
    const { id, startDate, endDate, ...rest } = payload
    const sprint = await db.sprint.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
        ...(endDate   !== undefined ? { endDate:   new Date(endDate)   } : {}),
      },
      include: {
        issues: { include: { assignedTo: { select: { id: true, fullName: true } } } },
      },
    })
    await db.auditLog.create({ data: { action: payload.status === 'ACTIVE' ? 'STARTED' : payload.status === 'COMPLETED' ? 'COMPLETED' : 'UPDATE', entityType: 'Sprint', entityId: sprint.id } }).catch(() => {})
    return { success: true, data: sprint }
  } catch (err) {
    return { success: false, error: { code: 'SR30-003', message: err instanceof Error ? err.message : 'Could not update sprint.' } }
  }
}

export async function deleteSprint(id: string) {
  try {
    const db = getPrisma()
    // Unlink issues from sprint before deleting
    await db.issue.updateMany({ where: { sprintId: id }, data: { sprintId: null } })
    await db.sprint.delete({ where: { id } })
    await db.auditLog.create({ data: { action: 'DELETE', entityType: 'Sprint', entityId: id } }).catch(() => {})
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'SR30-004', message: err instanceof Error ? err.message : 'Could not delete sprint.' } }
  }
}
