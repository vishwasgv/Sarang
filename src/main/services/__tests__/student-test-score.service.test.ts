import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import {
  listTestScores,
  createTestScore,
  updateTestScore,
  deleteTestScore,
} from '../student-test-score.service'

function makeScore(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sts-1', enrollmentId: 'enr-1', testName: 'Unit Test 1', subject: 'Mathematics',
    marksObtained: 42, maxMarks: 50, testDate: new Date(), grade: 'A', notes: null,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeMockDb(overrides: Record<string, unknown> = {}) {
  const db: Record<string, any> = {
    coachingBatchEnrollment: { findUnique: vi.fn().mockResolvedValue({ id: 'enr-1' }) },
    studentTestScore: {
      findMany: vi.fn().mockResolvedValue([makeScore()]),
      findUnique: vi.fn().mockResolvedValue(makeScore()),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeScore({ id: 'sts-new', ...data }))),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeScore({ ...data }))),
      delete: vi.fn().mockResolvedValue({}),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    ...overrides,
  }
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('student-test-score.service — createTestScore', () => {
  it('creates a test score against an existing enrollment', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTestScore({ enrollmentId: 'enr-1', testName: 'Unit Test 1', marksObtained: 42, maxMarks: 50, testDate: '2026-07-01' })

    expect(res.success).toBe(true)
    expect(db.studentTestScore.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ enrollmentId: 'enr-1', testName: 'Unit Test 1', marksObtained: 42, maxMarks: 50 })
    }))
  })

  it('rejects when the enrollment does not exist', async () => {
    const db = makeMockDb({ coachingBatchEnrollment: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTestScore({ enrollmentId: 'missing', testName: 'Test', marksObtained: 10, maxMarks: 20, testDate: '2026-07-01' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('STS-002')
    expect(db.studentTestScore.create).not.toHaveBeenCalled()
  })

  it('rejects a blank test name', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTestScore({ enrollmentId: 'enr-1', testName: '  ', marksObtained: 10, maxMarks: 20, testDate: '2026-07-01' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('STS-003')
  })

  it('rejects maxMarks of zero or less', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTestScore({ enrollmentId: 'enr-1', testName: 'Test', marksObtained: 0, maxMarks: 0, testDate: '2026-07-01' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('STS-004')
  })

  it('rejects marksObtained greater than maxMarks (cannot score more than the test is worth)', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTestScore({ enrollmentId: 'enr-1', testName: 'Test', marksObtained: 55, maxMarks: 50, testDate: '2026-07-01' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('STS-005')
  })

  it('rejects negative marksObtained', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTestScore({ enrollmentId: 'enr-1', testName: 'Test', marksObtained: -5, maxMarks: 50, testDate: '2026-07-01' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('STS-005')
  })
})

describe('student-test-score.service — updateTestScore', () => {
  it('updates a test score', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateTestScore({ id: 'sts-1', marksObtained: 45 })

    expect(res.success).toBe(true)
  })

  it('validates marksObtained against the EXISTING maxMarks when maxMarks is not part of this update', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never) // existing maxMarks = 50 per makeScore()

    const res = await updateTestScore({ id: 'sts-1', marksObtained: 60 }) // > existing maxMarks of 50

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('STS-005')
  })

  it('returns an error when the test score does not exist', async () => {
    const db = makeMockDb({ studentTestScore: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn(), create: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateTestScore({ id: 'missing', marksObtained: 10 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('STS-007')
  })
})

// Real bug found live (2026-07-28 sales/agency/education-vertical audit):
// StudentTestScore.testDate is a non-nullable DateTime field that used to be
// returned across Electron's IPC boundary as a raw Prisma Date instance —
// structured clone preserves it without throwing (unlike a Decimal, caught
// immediately in dev), so this shipped as a live, always-reproducible
// renderer crash: TestScoresScreen.tsx's edit-form populator calls
// `s.testDate.split('T')[0]` directly, assuming an ISO string.
describe('student-test-score.service — testDate IPC serialization', () => {
  it('createTestScore returns testDate as an ISO string, not a raw Date instance', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTestScore({ enrollmentId: 'enr-1', testName: 'Unit Test 1', marksObtained: 42, maxMarks: 50, testDate: '2026-03-10' })

    expect(res.success).toBe(true)
    const data = (res as { data: { testDate: unknown } }).data
    expect(typeof data.testDate).toBe('string')
    expect(data.testDate).not.toBeInstanceOf(Date)
    expect((data.testDate as string).slice(0, 10)).toBe('2026-03-10')
  })

  it('listTestScores returns testDate as an ISO string for every row', async () => {
    const db = makeMockDb()
    db.studentTestScore.findMany = vi.fn().mockResolvedValue([makeScore({ testDate: new Date(2026, 2, 10) })])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listTestScores({})

    expect(res.success).toBe(true)
    const row = (res as { data: Array<{ testDate: unknown }> }).data[0]
    expect(typeof row.testDate).toBe('string')
    expect(row.testDate).not.toBeInstanceOf(Date)
  })

  it('updateTestScore returns testDate as an ISO string and stores a changed date at local midnight (not UTC)', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateTestScore({ id: 'sts-1', testDate: '2026-03-15' })

    expect(res.success).toBe(true)
    const call = db.studentTestScore.update.mock.calls[0][0]
    const stored: Date = call.data.testDate
    expect(stored.getDate()).toBe(15)
    expect(stored.getHours()).toBe(0) // local midnight, not shifted by a bare UTC parse
    const data = (res as { data: { testDate: unknown } }).data
    expect(typeof data.testDate).toBe('string')
  })
})

// Phase 68 §9.1 — Coaching Institute item 1: auto-calculated grade.
describe('student-test-score.service — computeGrade auto-calculation', () => {
  it.each([
    [45, 50, 'A+'],  // 90%
    [40, 50, 'A'],   // 80%
    [35, 50, 'B'],   // 70%
    [30, 50, 'C'],   // 60%
    [25, 50, 'D'],   // 50%
    [24, 50, 'F'],   // 49% — just below the D threshold
    [0, 50, 'F'],
  ])('assigns grade for %i/%i => %s', async (marksObtained, maxMarks, expectedGrade) => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTestScore({ enrollmentId: 'enr-1', testName: 'Test', marksObtained, maxMarks, testDate: '2026-07-01' })

    expect(res.success).toBe(true)
    expect(db.studentTestScore.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ grade: expectedGrade })
    }))
  })

  it('an explicit grade always wins over auto-calculation on create', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createTestScore({ enrollmentId: 'enr-1', testName: 'Test', marksObtained: 45, maxMarks: 50, testDate: '2026-07-01', grade: 'Distinction' })

    expect(db.studentTestScore.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ grade: 'Distinction' })
    }))
  })

  it('recomputes the grade on update when marksObtained changes and no explicit grade is given', async () => {
    // existing score is maxMarks 50, grade 'A' (via makeScore()) — pushing
    // marksObtained down to 30/50 (60%) should recompute to 'C', not stay 'A'.
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateTestScore({ id: 'sts-1', marksObtained: 30 })

    expect(db.studentTestScore.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ grade: 'C' })
    }))
  })

  it('an explicit grade on update always wins, even when marks also changed', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateTestScore({ id: 'sts-1', marksObtained: 30, grade: 'Needs Improvement' })

    expect(db.studentTestScore.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ grade: 'Needs Improvement' })
    }))
  })

  it('leaves the grade untouched on update when neither marks nor grade are part of the payload', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateTestScore({ id: 'sts-1', notes: 'Late submission' })

    const call = db.studentTestScore.update.mock.calls[0][0]
    expect(call.data).not.toHaveProperty('grade')
  })

  it('clears the grade on update when an explicit null/blank grade is given', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateTestScore({ id: 'sts-1', grade: null })

    expect(db.studentTestScore.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ grade: null })
    }))
  })
})

describe('student-test-score.service — list/delete', () => {
  it('lists scores filtered by batch via the enrollment relation', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await listTestScores({ batchId: 'batch-1' })

    expect(db.studentTestScore.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { enrollment: { batchId: 'batch-1' } }
    }))
  })

  it('deletes a test score', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deleteTestScore('sts-1')

    expect(res.success).toBe(true)
    expect(db.studentTestScore.delete).toHaveBeenCalledWith({ where: { id: 'sts-1' } })
  })
})
