import { getPrisma } from '../database/db'

export async function listBoardMeetings(filters?: {
  clientId?: string
  meetingType?: string
  fromDate?: string
  toDate?: string
}) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.clientId) where.clientId = filters.clientId
    if (filters?.meetingType) where.meetingType = filters.meetingType
    if (filters?.fromDate || filters?.toDate) {
      where.meetingDate = {
        ...(filters?.fromDate ? { gte: new Date(filters.fromDate) } : {}),
        ...(filters?.toDate   ? { lte: new Date(filters.toDate)   } : {}),
      }
    }
    const meetings = await db.boardMeeting.findMany({
      where,
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
      },
      orderBy: [{ meetingDate: 'desc' }],
    })
    return { success: true, data: meetings }
  } catch (err) {
    return { success: false, error: { code: 'BM29-001', message: err instanceof Error ? err.message : 'Could not list board meetings.' } }
  }
}

export async function createBoardMeeting(payload: {
  clientId: string
  meetingType?: string
  meetingDate: string
  meetingTime?: string
  venue?: string
  agenda?: string
  notes?: string
}) {
  try {
    const db = getPrisma()
    const meeting = await db.boardMeeting.create({
      data: {
        clientId:    payload.clientId,
        meetingType: payload.meetingType ?? 'BOARD',
        meetingDate: new Date(payload.meetingDate),
        meetingTime: payload.meetingTime ?? null,
        venue:       payload.venue ?? null,
        agenda:      payload.agenda ?? null,
        notes:       payload.notes ?? null,
      },
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
      },
    })
    await db.auditLog.create({ data: { action: 'CREATE', entityType: 'BoardMeeting', entityId: meeting.id, newValue: JSON.stringify({ meetingType: meeting.meetingType }) } }).catch(() => {})
    return { success: true, data: meeting }
  } catch (err) {
    return { success: false, error: { code: 'BM29-002', message: err instanceof Error ? err.message : 'Could not create board meeting.' } }
  }
}

export async function updateBoardMeeting(payload: {
  id: string
  meetingType?: string
  meetingDate?: string
  meetingTime?: string | null
  venue?: string | null
  agenda?: string | null
  quorumMet?: boolean
  minutesDone?: boolean
  minutesText?: string | null
  noticesSent?: boolean
  notes?: string | null
}) {
  try {
    const db = getPrisma()
    const { id, meetingDate, ...rest } = payload
    const meeting = await db.boardMeeting.update({
      where: { id },
      data: {
        ...rest,
        ...(meetingDate !== undefined ? { meetingDate: new Date(meetingDate) } : {}),
      },
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
      },
    })
    await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'BoardMeeting', entityId: meeting.id } }).catch(() => {})
    return { success: true, data: meeting }
  } catch (err) {
    return { success: false, error: { code: 'BM29-003', message: err instanceof Error ? err.message : 'Could not update board meeting.' } }
  }
}

export async function deleteBoardMeeting(id: string) {
  try {
    const db = getPrisma()
    await db.boardMeeting.delete({ where: { id } })
    await db.auditLog.create({ data: { action: 'DELETE', entityType: 'BoardMeeting', entityId: id } }).catch(() => {})
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'BM29-004', message: err instanceof Error ? err.message : 'Could not delete board meeting.' } }
  }
}
