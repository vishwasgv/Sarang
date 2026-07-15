import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

export interface WorkLogRecord {
  id: string
  projectId: string | null
  ticketId: string | null
  jobCardId: string | null
  userId: string | null
  userName: string | null
  title: string
  description: string | null
  hours: number
  logDate: string
  billable: boolean
  createdAt: string
}

function toRecord(l: any): WorkLogRecord {
  return {
    id: l.id,
    projectId: l.projectId ?? null,
    ticketId: l.ticketId ?? null,
    jobCardId: l.jobCardId ?? null,
    userId: l.userId ?? null,
    userName: l.user?.fullName ?? null,
    title: l.title,
    description: l.description ?? null,
    hours: l.hours,
    logDate: new Date(l.logDate).toISOString(),
    billable: l.billable,
    createdAt: new Date(l.createdAt).toISOString()
  }
}

export async function listWorkLogs(payload: {
  projectId?: string
  ticketId?: string
  jobCardId?: string
  limit?: number
}): Promise<{ success: boolean; data?: { logs: WorkLogRecord[]; totalHours: number }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (payload.projectId) where.projectId = payload.projectId
    if (payload.ticketId) where.ticketId = payload.ticketId
    if (payload.jobCardId) where.jobCardId = payload.jobCardId

    const rows = await db.workLog.findMany({
      where,
      include: { user: { select: { fullName: true } } },
      orderBy: { logDate: 'desc' },
      take: payload.limit ?? 100
    })

    const logs = rows.map(toRecord)
    const totalHours = logs.reduce((s, l) => s + l.hours, 0)
    return { success: true, data: { logs, totalHours } }
  } catch (e: any) {
    console.error('[LOG_LIST_FAIL]', e)
    return { success: false, error: { code: 'LOG_LIST_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}

export async function createWorkLog(payload: {
  projectId?: string
  ticketId?: string
  jobCardId?: string
  title: string
  description?: string
  hours: number
  logDate?: string
  billable?: boolean
}, userId?: string): Promise<{ success: boolean; data?: WorkLogRecord; error?: { code: string; message: string } }> {
  try {
    if (!payload.projectId && !payload.ticketId && !payload.jobCardId) {
      return { success: false, error: { code: 'LOG_NO_ENTITY', message: 'Must link to a project, ticket, or job card' } }
    }
    if (payload.hours <= 0) {
      return { success: false, error: { code: 'LOG_INVALID_HOURS', message: 'Hours must be greater than 0' } }
    }

    const db = getPrisma()
    const row = await db.workLog.create({
      data: {
        projectId: payload.projectId ?? null,
        ticketId: payload.ticketId ?? null,
        jobCardId: payload.jobCardId ?? null,
        userId: userId ?? null,
        title: payload.title,
        description: payload.description ?? null,
        hours: payload.hours,
        logDate: payload.logDate ? new Date(payload.logDate) : new Date(),
        billable: payload.billable ?? true
      },
      include: { user: { select: { fullName: true } } }
    })
    return { success: true, data: toRecord(row) }
  } catch (e: any) {
    console.error('[LOG_CREATE_FAIL]', e)
    return { success: false, error: { code: 'LOG_CREATE_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}

export async function deleteWorkLog(id: string, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const row = await db.workLog.delete({ where: { id } })
    if (userId) await logAction(userId, 'DELETE', 'WORK_LOG', id, row, null)
    return { success: true }
  } catch (e: any) {
    console.error('[LOG_DELETE_FAIL]', e)
    return { success: false, error: { code: 'LOG_DELETE_FAIL', message: 'Something went wrong. Please try again.' } }
  }
}
