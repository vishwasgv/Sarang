import { getPrisma } from '../database/db'
import { parseLocalDateStart } from '../utils/date.util'

export async function getAttendance(batchId: string, date: string) {
  const db = getPrisma()
  // Real bug found: this used to normalise via Date.UTC — a different
  // calendar-day anchor than every other date-only field in this codebase
  // (local midnight, via parseLocalDateStart), so a business running west of
  // UTC would look up the wrong stored day. Anchor local, matching
  // saveAttendance below (and the batchId_attendanceDate unique constraint
  // it writes against).
  const dayStart = parseLocalDateStart(date)
  const dayEnd = new Date(dayStart.getTime() + 86400000)

  const record = await db.coachingBatchAttendance.findFirst({
    where: {
      batchId,
      attendanceDate: { gte: dayStart, lt: dayEnd },
    },
    include: { takenBy: { select: { id: true, fullName: true } } },
  })
  return { success: true, data: record ?? null }
}

export async function saveAttendance(payload: {
  batchId: string
  attendanceDate: string
  presentStudentIds: string[]
  absentStudentIds: string[]
  takenById?: string
  notes?: string
}) {
  const db = getPrisma()
  const attendanceDate = parseLocalDateStart(payload.attendanceDate)

  const record = await db.coachingBatchAttendance.upsert({
    where: { batchId_attendanceDate: { batchId: payload.batchId, attendanceDate } },
    create: {
      batchId: payload.batchId,
      attendanceDate,
      presentStudentIds: JSON.stringify(payload.presentStudentIds),
      absentStudentIds: JSON.stringify(payload.absentStudentIds),
      takenById: payload.takenById || null,
      notes: payload.notes || null,
    },
    update: {
      presentStudentIds: JSON.stringify(payload.presentStudentIds),
      absentStudentIds: JSON.stringify(payload.absentStudentIds),
      takenById: payload.takenById || null,
      notes: payload.notes || null,
    },
    include: { takenBy: { select: { id: true, fullName: true } } },
  })
  return { success: true, data: record }
}

export async function listAttendanceDates(batchId: string) {
  const db = getPrisma()
  const records = await db.coachingBatchAttendance.findMany({
    where: { batchId },
    orderBy: { attendanceDate: 'desc' },
    select: {
      id: true,
      attendanceDate: true,
      presentStudentIds: true,
      absentStudentIds: true,
      takenBy: { select: { id: true, fullName: true } },
      notes: true,
    },
  })
  return { success: true, data: records }
}
