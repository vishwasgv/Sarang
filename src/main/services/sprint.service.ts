import { getPrisma } from '../database/db'

function startOfDay(d: Date): Date {
  const s = new Date(d); s.setHours(0, 0, 0, 0); return s
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r
}

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

// Phase 58 §2 — Software Agency: basic sprint burndown, derived entirely from
// real Issue timestamps (storyPoints, status, resolvedDate) — no separate
// daily-snapshot mechanism needed since resolvedDate is already reliably
// stamped by updateIssue() on every status transition.
export async function getSprintBurndown(sprintId: string) {
  try {
    const db = getPrisma()
    const sprint = await db.sprint.findUnique({
      where: { id: sprintId },
      include: { issues: { select: { id: true, storyPoints: true, status: true, resolvedDate: true } } },
    })
    if (!sprint) return { success: false, error: { code: 'SR30-005', message: 'Sprint not found.' } }

    const pointsMode = sprint.issues.some((i) => i.storyPoints != null)
    const weight = (i: { storyPoints: number | null }): number => (pointsMode ? (i.storyPoints ?? 0) : 1)
    const totalPoints = sprint.issues.reduce((s, i) => s + weight(i), 0)

    const start = startOfDay(sprint.startDate)
    const end = startOfDay(sprint.endDate)
    const totalDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000))
    const dayCount = Math.min(totalDays + 1, 120) // defensive cap; real sprints are days-to-weeks long

    const days: Array<{ date: string; remainingPoints: number; idealRemainingPoints: number }> = []
    for (let idx = 0; idx < dayCount; idx++) {
      const day = addDays(start, idx)
      const endOfThatDay = new Date(day); endOfThatDay.setHours(23, 59, 59, 999)
      const remaining = sprint.issues.reduce((s, i) => {
        const isDoneByThen = (i.status === 'RESOLVED' || i.status === 'CLOSED') && i.resolvedDate != null && i.resolvedDate <= endOfThatDay
        return s + (isDoneByThen ? 0 : weight(i))
      }, 0)
      const idealRemaining = totalDays > 0 ? totalPoints * (1 - idx / totalDays) : totalPoints
      days.push({
        date: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`,
        remainingPoints: remaining,
        idealRemainingPoints: Math.round(idealRemaining * 10) / 10,
      })
    }

    return {
      success: true,
      data: {
        sprintId: sprint.id, sprintNumber: sprint.sprintNumber, name: sprint.name, status: sprint.status,
        pointsMode, totalPoints, issueCount: sprint.issues.length, days,
      },
    }
  } catch (err) {
    return { success: false, error: { code: 'SR30-006', message: err instanceof Error ? err.message : 'Could not compute sprint burndown.' } }
  }
}

// Phase 58 §2 — Software Agency: velocity across the project's completed
// sprints. Uses the SAME points-vs-issue-count weight convention as the
// burndown above, decided once globally so bars stay comparable.
export async function getProjectVelocity(projectId: string, limit = 6) {
  try {
    const db = getPrisma()
    const sprints = await db.sprint.findMany({
      where: { projectId, status: 'COMPLETED' },
      include: { issues: { select: { storyPoints: true, status: true } } },
      orderBy: { sprintNumber: 'desc' },
      take: limit,
    })
    const allIssues = sprints.flatMap((s) => s.issues)
    const pointsMode = allIssues.some((i) => i.storyPoints != null)
    const weight = (i: { storyPoints: number | null }): number => (pointsMode ? (i.storyPoints ?? 0) : 1)

    const result = sprints
      .map((s) => ({
        sprintId: s.id,
        sprintNumber: s.sprintNumber,
        name: s.name,
        totalPoints: s.issues.reduce((sum, i) => sum + weight(i), 0),
        completedPoints: s.issues.filter((i) => i.status === 'RESOLVED' || i.status === 'CLOSED').reduce((sum, i) => sum + weight(i), 0),
      }))
      .sort((a, b) => a.sprintNumber - b.sprintNumber)

    const avgVelocity = result.length > 0 ? result.reduce((s, r) => s + r.completedPoints, 0) / result.length : 0

    return { success: true, data: { projectId, pointsMode, sprints: result, avgVelocity: Math.round(avgVelocity * 10) / 10 } }
  } catch (err) {
    return { success: false, error: { code: 'SR30-007', message: err instanceof Error ? err.message : 'Could not compute project velocity.' } }
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
