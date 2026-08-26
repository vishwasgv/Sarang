import { getPrisma } from '../database/db'
import { buildWhatsAppLink } from './notification-queue.service'

// Phase 58 §2 — Coaching Institute: a real parent-facing progress report,
// aggregating attendance, academic test scores, and fee status per batch a
// student is enrolled in — the same underlying data already tracked by
// coaching-batch-attendance.service.ts / StudentTestScore / CoachingFeeRecord,
// just assembled into one printable view instead of living in three
// separate screens a parent never sees.

export function attendancePercentFor(
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

// Phase 68 §9.1 — Coaching Institute item 3: one-tap parent WhatsApp report
// card. Same underlying data getStudentProgressReport already aggregates
// (attendance %, latest test scores, fee status), scoped to ONE enrollment
// (a report card is naturally per-batch/subject, not a cross-batch dump),
// composed into a real WhatsApp deep-link — "one tap" means the caller just
// opens the returned link, no manual typing.
export async function sendProgressReportWhatsApp(enrollmentId: string) {
  try {
    const db = getPrisma()
    const enrollment = await db.coachingBatchEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        student: { select: { id: true, customerName: true, phone: true } },
        batch: { select: { batchName: true, subjectOrCourse: true } },
      },
    })
    if (!enrollment) return { success: false, error: { code: 'PROG-003', message: 'Enrollment not found.' } }
    if (!enrollment.student.phone) return { success: false, error: { code: 'PROG-004', message: 'No phone number on file for this student.' } }

    const [attendanceRows, testScores, feeRecords] = await Promise.all([
      db.coachingBatchAttendance.findMany({
        where: { batchId: enrollment.batchId, attendanceDate: { gte: enrollment.enrolledDate } },
        select: { presentStudentIds: true, absentStudentIds: true },
      }),
      db.studentTestScore.findMany({ where: { enrollmentId }, orderBy: { testDate: 'desc' }, take: 3 }),
      db.coachingFeeRecord.findMany({ where: { enrollmentId }, orderBy: { feeMonth: 'desc' }, take: 1, select: { status: true, amountDue: true, amountReceived: true } }),
    ])

    const attendance = attendancePercentFor(enrollment.studentId, attendanceRows)
    const attendanceLine = attendance.percent != null ? `Attendance: ${attendance.percent}% (${attendance.present}/${attendance.totalSessions} sessions)` : 'Attendance: no sessions recorded yet'

    const testLines = testScores.length > 0
      ? testScores.map((t) => `  • ${t.testName}: ${Number(t.marksObtained)}/${Number(t.maxMarks)}${t.grade ? ` (${t.grade})` : ''}`).join('\n')
      : '  • No tests recorded yet'

    const fee = feeRecords[0]
    const dueAmount = fee ? Number(fee.amountDue) - Number(fee.amountReceived) : 0
    const feeLine = fee ? (dueAmount > 0 ? `Fee: ₹${dueAmount} due (${fee.status})` : `Fee: up to date (${fee.status})`) : 'Fee: no record yet'

    const message = `Dear Parent, progress report for ${enrollment.student.customerName} — ${enrollment.batch.batchName} (${enrollment.batch.subjectOrCourse}):\n${attendanceLine}\nRecent Tests:\n${testLines}\n${feeLine}\nPowered by Sarang | www.aszurex.com`
    const link = await buildWhatsAppLink(enrollment.student.phone, message)

    return { success: true, data: { link } }
  } catch (err) {
    return { success: false, error: { code: 'PROG-005', message: err instanceof Error ? err.message : 'Could not build the WhatsApp report card.' } }
  }
}
