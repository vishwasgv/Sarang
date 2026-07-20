import { getPrisma } from '../database/db'

// Phase 58 §2 — Coaching Institute: a real parent-facing progress report,
// aggregating attendance, academic test scores, and fee status per batch a
// student is enrolled in — the same underlying data already tracked by
// coaching-batch-attendance.service.ts / StudentTestScore / CoachingFeeRecord,
// just assembled into one printable view instead of living in three
// separate screens a parent never sees.

function attendancePercentFor(
  studentId: string,
  rows: { presentStudentIds: string; absentStudentIds: string }[]
) {
  let present = 0
  let absent = 0
  for (const row of rows) {
    let presentIds: string[] = []
    let absentIds: string[] = []
    try { presentIds = JSON.parse(row.presentStudentIds) } catch { /* malformed row, skip */ }
    try { absentIds = JSON.parse(row.absentStudentIds) } catch { /* malformed row, skip */ }
    if (presentIds.includes(studentId)) present++
    else if (absentIds.includes(studentId)) absent++
    // A student not listed in either array wasn't part of that session
    // (e.g. the date predates their enrollment) — doesn't count either way.
  }
  const totalSessions = present + absent
  const percent = totalSessions > 0 ? Math.round((present / totalSessions) * 100) : null
  return { present, absent, totalSessions, percent }
}

export async function getStudentProgressReport(studentId: string) {
  try {
    const db = getPrisma()
    const student = await db.customer.findUnique({
      where: { id: studentId },
      select: { id: true, customerName: true, phone: true },
    })
    if (!student) return { success: false, error: { code: 'PROG-001', message: 'Student not found.' } }

    const enrollments = await db.coachingBatchEnrollment.findMany({
      where: { studentId },
      include: { batch: { select: { id: true, batchName: true, subjectOrCourse: true, status: true } } },
      orderBy: { enrolledDate: 'desc' },
    })

    const batches = await Promise.all(enrollments.map(async (enr) => {
      const [attendanceRows, testScores, feeRecords] = await Promise.all([
        db.coachingBatchAttendance.findMany({
          where: { batchId: enr.batchId, attendanceDate: { gte: enr.enrolledDate } },
          select: { presentStudentIds: true, absentStudentIds: true },
        }),
        db.studentTestScore.findMany({
          where: { enrollmentId: enr.id },
          orderBy: { testDate: 'desc' },
        }),
        db.coachingFeeRecord.findMany({
          where: { enrollmentId: enr.id },
          orderBy: { feeMonth: 'desc' },
          select: { feeMonth: true, amountDue: true, amountReceived: true, status: true },
        }),
      ])

      return {
        enrollmentId: enr.id,
        batch: enr.batch,
        enrollmentStatus: enr.status,
        enrolledDate: enr.enrolledDate,
        attendance: attendancePercentFor(studentId, attendanceRows),
        testScores: testScores.map((t) => ({ ...t, marksObtained: Number(t.marksObtained), maxMarks: Number(t.maxMarks) })),
        feeRecords: feeRecords.map((f) => ({ ...f, amountDue: Number(f.amountDue), amountReceived: Number(f.amountReceived) })),
      }
    }))

    return { success: true, data: { student, batches } }
  } catch (err) {
    return { success: false, error: { code: 'PROG-002', message: err instanceof Error ? err.message : 'Could not build progress report.' } }
  }
}
