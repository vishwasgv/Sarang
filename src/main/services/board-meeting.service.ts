import { getPrisma } from '../database/db'
import { parseLocalDateStart, parseLocalDateEnd, toLocalDateOnlyIso } from '../utils/date.util'

// meetingDate/createdAt/updatedAt are Prisma DateTime fields, preserved as
// real Date instances across IPC's structured clone — but ROCFilingsScreen.tsx's
// board-meeting edit-form populator calls `m.meetingDate.slice(0, 10)`
// assuming an ISO string. Same bug class as compliance-task.service.ts's
// serializeTask / roc-filing.service.ts's serializeFiling — see those for
// the full writeup.
//
// Real bug found live (2026-08-27 Phase 68 audit): this used a plain
// `.toISOString()` instead of toLocalDateOnlyIso — meetingDate is stored at
// LOCAL midnight (parseLocalDateStart below), which is 18:30 UTC the
// PREVIOUS calendar day in IST, so `.slice(0, 10)` displayed every meeting
// one day early. Same exact bug, same fix, as roc-filing.service.ts's own
// serializeFiling (found and fixed in the same session, sibling file).
function serializeMeeting<T extends { meetingDate: Date; createdAt: Date; updatedAt: Date }>(m: T): T {
  return {
    ...m,
    meetingDate: toLocalDateOnlyIso(m.meetingDate) as unknown as Date,
    createdAt: m.createdAt.toISOString() as unknown as Date,
    updatedAt: m.updatedAt.toISOString() as unknown as Date,
  }
}

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
      // BUG FOUND 2026-07-22: both bounds used to be new Date(dateString),
      // parsed as UTC midnight instead of local midnight; toDate also
      // lacked an end-of-day adjustment, excluding same-day meetings with
      // a real time-of-day.
      // Real bug found 2026-07-23: the toDate fix above still parsed the
      // string as UTC midnight FIRST before setHours() locked in
      // end-of-day — setHours() only rewrites H/M/S/ms, never the
      // Year/Month/Date a UTC parse already got wrong in any negative-UTC-
      // offset timezone. parseLocalDateEnd constructs local end-of-day
      // directly from the string's Y/M/D instead.
      where.meetingDate = {
        ...(filters?.fromDate ? { gte: parseLocalDateStart(filters.fromDate) } : {}),
        ...(filters?.toDate ? { lte: parseLocalDateEnd(filters.toDate) } : {}),
      }
    }
    const meetings = await db.boardMeeting.findMany({
      where,
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
      },
      orderBy: [{ meetingDate: 'desc' }],
    })
    return { success: true, data: meetings.map(serializeMeeting) }
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
        // Real bug found live (2026-07-28 service-vertical audit): a bare
        // `new Date('YYYY-MM-DD')` parses as UTC midnight — inconsistent
        // with listBoardMeetings' own read-side filter (parseLocalDateStart/
        // End already used there).
        meetingDate: parseLocalDateStart(payload.meetingDate),
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
    return { success: true, data: serializeMeeting(meeting) }
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
        ...(meetingDate !== undefined ? { meetingDate: parseLocalDateStart(meetingDate) } : {}),
      },
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
      },
    })
    await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'BoardMeeting', entityId: meeting.id } }).catch(() => {})
    return { success: true, data: serializeMeeting(meeting) }
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

// Phase 68 §9.1 — Company Secretary item 3: board-meeting minutes cadence
// reminder. Companies Act practice expects minutes finalized within 30 days
// of the meeting; this is a worklist of meetings still marked
// minutesDone=false past that window, worst (most-overdue) first — same
// "chase" shape as CA Firm's getClientsWithStalePendingDocuments.
const MINUTES_OVERDUE_DAYS = 30

export interface OverdueMinutesRow {
  meetingId: string
  clientId: string
  clientName: string
  meetingType: string
  meetingDate: string
  daysOverdue: number
}

export async function getMeetingsWithOverdueMinutes(): Promise<
  { success: true; data: OverdueMinutesRow[] } | { success: false; error: { code: string; message: string } }
> {
  try {
    const db = getPrisma()
    const meetings = await db.boardMeeting.findMany({
      where: { minutesDone: false },
      include: { client: { select: { id: true, customerName: true } } },
      orderBy: { meetingDate: 'asc' },
    })
    const now = Date.now()
    const rows: OverdueMinutesRow[] = meetings
      .map((m) => {
        const daysSinceMeeting = Math.floor((now - m.meetingDate.getTime()) / (24 * 60 * 60 * 1000))
        return {
          meetingId: m.id,
          clientId: m.clientId,
          clientName: m.client.customerName,
          meetingType: m.meetingType,
          meetingDate: toLocalDateOnlyIso(m.meetingDate),
          daysOverdue: daysSinceMeeting - MINUTES_OVERDUE_DAYS,
        }
      })
      .filter((r) => r.daysOverdue > 0)
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
    return { success: true, data: rows }
  } catch (err) {
    return { success: false, error: { code: 'BM29-005', message: err instanceof Error ? err.message : 'Could not compute overdue minutes.' } }
  }
}
