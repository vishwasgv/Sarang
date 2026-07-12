import { getPrisma } from '../database/db'

export async function listTestScores(filters?: { enrollmentId?: string; batchId?: string }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.enrollmentId) where.enrollmentId = filters.enrollmentId
    if (filters?.batchId) where.enrollment = { batchId: filters.batchId }

    const scores = await db.studentTestScore.findMany({
      where,
      include: {
        enrollment: {
          select: {
            id: true, batchId: true,
            student: { select: { id: true, customerName: true } },
            batch: { select: { id: true, batchName: true, subjectOrCourse: true } },
          },
        },
      },
      orderBy: { testDate: 'desc' },
    })
    return { success: true, data: scores }
  } catch (err) {
    return { success: false, error: { code: 'STS-001', message: err instanceof Error ? err.message : 'Could not list test scores.' } }
  }
}

export async function createTestScore(payload: {
  enrollmentId: string
  testName: string
  subject?: string
  marksObtained: number
  maxMarks: number
  testDate: string
  grade?: string
  notes?: string
}) {
  try {
    const db = getPrisma()
    const enrollment = await db.coachingBatchEnrollment.findUnique({ where: { id: payload.enrollmentId }, select: { id: true } })
    if (!enrollment) return { success: false, error: { code: 'STS-002', message: 'Enrollment not found.' } }
    if (!payload.testName.trim()) return { success: false, error: { code: 'STS-003', message: 'Test name is required.' } }
    if (payload.maxMarks <= 0) return { success: false, error: { code: 'STS-004', message: 'Max marks must be greater than zero.' } }
    if (payload.marksObtained < 0 || payload.marksObtained > payload.maxMarks) {
      return { success: false, error: { code: 'STS-005', message: `Marks obtained must be between 0 and ${payload.maxMarks}.` } }
    }

    const score = await db.studentTestScore.create({
      data: {
        enrollmentId: payload.enrollmentId,
        testName: payload.testName.trim(),
        subject: payload.subject?.trim() || null,
        marksObtained: payload.marksObtained,
        maxMarks: payload.maxMarks,
        testDate: new Date(payload.testDate),
        grade: payload.grade?.trim() || null,
        notes: payload.notes?.trim() || null,
      },
    })
    await db.auditLog.create({
      data: { action: 'CREATE', entityType: 'StudentTestScore', entityId: score.id, newValue: JSON.stringify({ enrollmentId: payload.enrollmentId, testName: score.testName }) },
    }).catch(() => {})
    return { success: true, data: score }
  } catch (err) {
    return { success: false, error: { code: 'STS-006', message: err instanceof Error ? err.message : 'Could not create test score.' } }
  }
}

export async function updateTestScore(payload: {
  id: string
  testName?: string
  subject?: string | null
  marksObtained?: number
  maxMarks?: number
  testDate?: string
  grade?: string | null
  notes?: string | null
}) {
  try {
    const db = getPrisma()
    const existing = await db.studentTestScore.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'STS-007', message: 'Test score not found.' } }

    const nextMax = payload.maxMarks ?? existing.maxMarks
    const nextMarks = payload.marksObtained ?? existing.marksObtained
    if (nextMax <= 0) return { success: false, error: { code: 'STS-004', message: 'Max marks must be greater than zero.' } }
    if (nextMarks < 0 || nextMarks > nextMax) {
      return { success: false, error: { code: 'STS-005', message: `Marks obtained must be between 0 and ${nextMax}.` } }
    }

    const { id, testDate, subject, grade, notes, ...rest } = payload
    const score = await db.studentTestScore.update({
      where: { id },
      data: {
        ...rest,
        ...(testDate !== undefined ? { testDate: new Date(testDate) } : {}),
        ...(subject !== undefined ? { subject: subject?.trim() || null } : {}),
        ...(grade !== undefined ? { grade: grade?.trim() || null } : {}),
        ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
      },
    })
    await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'StudentTestScore', entityId: id } }).catch(() => {})
    return { success: true, data: score }
  } catch (err) {
    return { success: false, error: { code: 'STS-008', message: err instanceof Error ? err.message : 'Could not update test score.' } }
  }
}

export async function deleteTestScore(id: string) {
  try {
    const db = getPrisma()
    await db.studentTestScore.delete({ where: { id } })
    await db.auditLog.create({ data: { action: 'DELETE', entityType: 'StudentTestScore', entityId: id } }).catch(() => {})
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'STS-009', message: err instanceof Error ? err.message : 'Could not delete test score.' } }
  }
}
