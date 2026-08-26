import { getPrisma } from '../database/db'
import { parseLocalDateStart, toLocalDateOnlyIso } from '../utils/date.util'

// Real bug found live (2026-07-28 sales/agency/education-vertical audit):
// StudentTestScore.testDate is a non-nullable DateTime field returned across
// Electron's IPC boundary as a raw Prisma Date instance — structured clone
// preserves it without throwing (unlike a Prisma Decimal, caught immediately
// in dev), so this shipped as a live, always-reproducible renderer crash:
// TestScoresScreen.tsx's edit-form populator (openEdit) calls
// `s.testDate.split('T')[0]` directly, assuming an ISO string. Same bug
// class as sprint.service.ts's serializeSprint / compliance-task.service.ts's
// serializeTask — see date.util.ts's toLocalDateOnlyIso for the shared fix.
// Also fixes the write-side half: a bare `new Date('YYYY-MM-DD')` parses as
// UTC midnight, inconsistent with this codebase's established
// parseLocalDateStart helper used for every other date-only write.
function serializeTestScore<T extends { testDate: Date }>(s: T): T {
  return { ...s, testDate: toLocalDateOnlyIso(s.testDate) as unknown as Date }
}

// Phase 68 §9.1 — Coaching Institute item 1: auto-calculated grade. A fixed,
// documented percentage-threshold scale — computed ONLY when the caller
// doesn't supply an explicit grade (a teacher's own override, e.g. for a
// viva/practical component this scale doesn't fit, always wins).
const GRADE_THRESHOLDS: Array<{ minPercent: number; grade: string }> = [
  { minPercent: 90, grade: 'A+' },
  { minPercent: 80, grade: 'A' },
  { minPercent: 70, grade: 'B' },
  { minPercent: 60, grade: 'C' },
  { minPercent: 50, grade: 'D' },
  { minPercent: 0, grade: 'F' },
]

function computeGrade(marksObtained: number, maxMarks: number): string {
  const percent = (marksObtained / maxMarks) * 100
  return (GRADE_THRESHOLDS.find((t) => percent >= t.minPercent) ?? GRADE_THRESHOLDS[GRADE_THRESHOLDS.length - 1]).grade
}

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
    return { success: true, data: scores.map(serializeTestScore) }
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
        testDate: parseLocalDateStart(payload.testDate),
        grade: payload.grade?.trim() || computeGrade(payload.marksObtained, payload.maxMarks),
        notes: payload.notes?.trim() || null,
      },
    })
    await db.auditLog.create({
      data: { action: 'CREATE', entityType: 'StudentTestScore', entityId: score.id, newValue: JSON.stringify({ enrollmentId: payload.enrollmentId, testName: score.testName }) },
    }).catch(() => {})
    return { success: true, data: serializeTestScore(score) }
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
    // An explicit grade in THIS call always wins (e.g. a teacher's own
    // override); otherwise, if marks/maxMarks changed, recompute from the
    // new values so the grade never silently goes stale — same "explicit
    // wins, otherwise recompute from current effective values" discipline
    // as driving.service.ts's computeResult.
    const gradeUpdate = grade !== undefined
      ? { grade: grade?.trim() || null }
      : (payload.marksObtained !== undefined || payload.maxMarks !== undefined ? { grade: computeGrade(nextMarks, nextMax) } : {})
    const score = await db.studentTestScore.update({
      where: { id },
      data: {
        ...rest,
        ...(testDate !== undefined ? { testDate: parseLocalDateStart(testDate) } : {}),
        ...(subject !== undefined ? { subject: subject?.trim() || null } : {}),
        ...gradeUpdate,
        ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
      },
    })
    await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'StudentTestScore', entityId: id } }).catch(() => {})
    return { success: true, data: serializeTestScore(score) }
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
