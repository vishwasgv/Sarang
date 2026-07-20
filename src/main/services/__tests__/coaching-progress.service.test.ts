import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { getStudentProgressReport } from '../coaching-progress.service'

// Phase 58 §2 — Coaching Institute: a real parent-facing progress report.
// The one genuinely non-trivial piece of logic here is the per-student
// attendance percentage, derived from CoachingBatchAttendance's JSON
// present/absent arrays — worth testing directly rather than trusting it by
// inspection, especially the "student not listed in either array doesn't
// count" and malformed-JSON-safety edge cases.

function makeAttendanceRow(present: string[], absent: string[]) {
  return { presentStudentIds: JSON.stringify(present), absentStudentIds: JSON.stringify(absent) }
}

function makeMockDb(overrides: Record<string, any> = {}) {
  const db: Record<string, any> = {
    customer: {
      findUnique: vi.fn().mockResolvedValue({ id: 'stu-1', customerName: 'Test Student', phone: '9999999999' }),
    },
    coachingBatchEnrollment: {
      findMany: vi.fn().mockResolvedValue([{
        id: 'enr-1', batchId: 'batch-1', studentId: 'stu-1', status: 'ACTIVE',
        enrolledDate: new Date('2026-01-01'),
        batch: { id: 'batch-1', batchName: 'Batch A', subjectOrCourse: 'Maths', status: 'ACTIVE' },
      }]),
    },
    coachingBatchAttendance: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    studentTestScore: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    coachingFeeRecord: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    ...overrides,
  }
  return db
}

describe('coaching-progress.service — getStudentProgressReport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing student', async () => {
    const db = makeMockDb({ customer: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getStudentProgressReport('missing')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PROG-001')
  })

  it('returns null attendance percent when no attendance has been taken yet', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getStudentProgressReport('stu-1')

    expect(res.success).toBe(true)
    const batch = (res as { data: { batches: Array<{ attendance: { percent: number | null; totalSessions: number } }> } }).data.batches[0]
    expect(batch.attendance.percent).toBeNull()
    expect(batch.attendance.totalSessions).toBe(0)
  })

  it('computes attendance percent from present/absent sessions, ignoring sessions the student is not listed in', async () => {
    const db = makeMockDb({
      coachingBatchAttendance: {
        findMany: vi.fn().mockResolvedValue([
          makeAttendanceRow(['stu-1'], []),           // present
          makeAttendanceRow(['stu-1'], []),           // present
          makeAttendanceRow([], ['stu-1']),           // absent
          makeAttendanceRow(['stu-99'], ['stu-88']),  // stu-1 not part of this session — doesn't count
        ]),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getStudentProgressReport('stu-1')

    const batch = (res as { data: { batches: Array<{ attendance: { present: number; absent: number; totalSessions: number; percent: number } }> } }).data.batches[0]
    expect(batch.attendance).toEqual({ present: 2, absent: 1, totalSessions: 3, percent: 67 })
  })

  it('does not crash on a malformed attendance row and just skips it', async () => {
    const db = makeMockDb({
      coachingBatchAttendance: {
        findMany: vi.fn().mockResolvedValue([
          { presentStudentIds: 'not-json', absentStudentIds: 'also-not-json' },
          makeAttendanceRow(['stu-1'], []),
        ]),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getStudentProgressReport('stu-1')

    expect(res.success).toBe(true)
    const batch = (res as { data: { batches: Array<{ attendance: { present: number; totalSessions: number } }> } }).data.batches[0]
    expect(batch.attendance.present).toBe(1)
    expect(batch.attendance.totalSessions).toBe(1)
  })

  it('only counts attendance from on/after the enrollment date', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await getStudentProgressReport('stu-1')

    expect(db.coachingBatchAttendance.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { batchId: 'batch-1', attendanceDate: { gte: new Date('2026-01-01') } },
    }))
  })

  it('serializes test score and fee record Decimal-shaped fields to plain numbers', async () => {
    const db = makeMockDb({
      studentTestScore: { findMany: vi.fn().mockResolvedValue([{ id: 't1', testName: 'Unit Test', subject: 'Maths', marksObtained: 45, maxMarks: 50, testDate: new Date(), grade: 'A' }]) },
      coachingFeeRecord: { findMany: vi.fn().mockResolvedValue([{ feeMonth: '2026-07', amountDue: 3000, amountReceived: 3000, status: 'PAID' }]) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getStudentProgressReport('stu-1')

    const batch = (res as { data: { batches: Array<{ testScores: Array<{ marksObtained: unknown; maxMarks: unknown }>; feeRecords: Array<{ amountDue: unknown; amountReceived: unknown }> }> } }).data.batches[0]
    expect(typeof batch.testScores[0].marksObtained).toBe('number')
    expect(typeof batch.feeRecords[0].amountDue).toBe('number')
  })
})
