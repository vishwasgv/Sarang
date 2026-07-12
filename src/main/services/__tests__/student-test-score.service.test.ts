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
