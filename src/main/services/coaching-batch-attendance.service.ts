import { getPrisma } from '../database/db'

export async function getAttendance(batchId: string, date: string) {
  const db = getPrisma()
  const d = new Date(date)
  // Normalise to midnight UTC to match stored date
  const dayStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1))

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
  const attendanceDate = new Date(payload.attendanceDate)

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
