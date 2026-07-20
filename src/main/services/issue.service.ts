import { getPrisma } from '../database/db'

export async function listIssues(filters?: {
  projectId?: string
  status?: string
  priority?: string
  assignedToId?: string
  sprintId?: string
}) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.projectId) where.projectId = filters.projectId
    if (filters?.status) where.status = filters.status
    if (filters?.priority) where.priority = filters.priority
    if (filters?.assignedToId) where.assignedToId = filters.assignedToId
    if (filters?.sprintId !== undefined) where.sprintId = filters.sprintId || null
    const issues = await db.issue.findMany({
      where,
      include: {
        assignedTo: { select: { id: true, fullName: true } },
        sprint:     { select: { id: true, sprintNumber: true, name: true } },
        project:    { select: { id: true, projectName: true } },
      },
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' },
      ],
    })
    return { success: true, data: issues }
  } catch (err) {
    return { success: false, error: { code: 'IS30-001', message: err instanceof Error ? err.message : 'Could not list issues.' } }
  }
}

export async function createIssue(payload: {
  projectId: string
  title: string
  description?: string
  priority?: string
  status?: string
  assignedToId?: string
  sprintId?: string
  storyPoints?: number
}) {
  try {
    const db = getPrisma()
    const issue = await db.issue.create({
      data: {
        projectId:    payload.projectId,
        title:        payload.title.trim(),
        description:  payload.description ?? null,
        priority:     payload.priority ?? 'MED',
        status:       payload.status ?? 'OPEN',
        assignedToId: payload.assignedToId ?? null,
        sprintId:     payload.sprintId ?? null,
        storyPoints:  payload.storyPoints ?? null,
      },
      include: {
        assignedTo: { select: { id: true, fullName: true } },
        sprint:     { select: { id: true, sprintNumber: true, name: true } },
        project:    { select: { id: true, projectName: true } },
      },
    })
    await db.auditLog.create({ data: { action: 'CREATE', entityType: 'Issue', entityId: issue.id, newValue: JSON.stringify({ title: issue.title }) } }).catch(() => {})
    return { success: true, data: issue }
  } catch (err) {
    return { success: false, error: { code: 'IS30-002', message: err instanceof Error ? err.message : 'Could not create issue.' } }
  }
}

export async function updateIssue(payload: {
  id: string
  title?: string
  description?: string | null
  priority?: string
  status?: string
  assignedToId?: string | null
  sprintId?: string | null
  resolvedDate?: string | null
  storyPoints?: number | null
}) {
  try {
    const db = getPrisma()
    const { id, title, resolvedDate, ...rest } = payload
    // Auto-manage resolvedDate based on status transition
    let resolvedDateOverride: Date | null | undefined
    if ((payload.status === 'RESOLVED' || payload.status === 'CLOSED') && resolvedDate === undefined) {
      resolvedDateOverride = new Date()            // set timestamp when closing
    } else if ((payload.status === 'OPEN' || payload.status === 'IN_PROGRESS') && resolvedDate === undefined) {
      resolvedDateOverride = null                  // clear stale timestamp on re-open
    }
    const issue = await db.issue.update({
      where: { id },
      data: {
        ...rest,
        ...(title !== undefined              ? { title: title.trim() } : {}),
        ...(resolvedDate !== undefined        ? { resolvedDate: resolvedDate ? new Date(resolvedDate) : null } : {}),
        ...(resolvedDateOverride !== undefined ? { resolvedDate: resolvedDateOverride } : {}),
      },
      include: {
        assignedTo: { select: { id: true, fullName: true } },
        sprint:     { select: { id: true, sprintNumber: true, name: true } },
        project:    { select: { id: true, projectName: true } },
      },
    })
    await db.auditLog.create({ data: { action: (payload.status === 'RESOLVED' || payload.status === 'CLOSED') ? payload.status : 'UPDATE', entityType: 'Issue', entityId: issue.id } }).catch(() => {})
    return { success: true, data: issue }
  } catch (err) {
    return { success: false, error: { code: 'IS30-003', message: err instanceof Error ? err.message : 'Could not update issue.' } }
  }
}

export async function deleteIssue(id: string) {
  try {
    const db = getPrisma()
    await db.issue.delete({ where: { id } })
    await db.auditLog.create({ data: { action: 'DELETE', entityType: 'Issue', entityId: id } }).catch(() => {})
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'IS30-004', message: err instanceof Error ? err.message : 'Could not delete issue.' } }
  }
}
