import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listBatches, createBatch, updateBatch, getBatchKPIs } from '../coaching-batch.service'

// Regression coverage for the Phase 31 re-audit finding: CoachingBatch.
// feePerMonth is a Prisma Decimal field, returned unserialized by
// listBatches/createBatch/updateBatch. Electron's IPC can't serialize a
// Decimal instance and throws "An object could not be cloned". Live-verified:
// creating a batch with a real feePerMonth crashed (row silently written to
// the DB anyway), and listBatches() then also crashed with that real row
// present — BatchesScreen stayed stuck on "Loading…" forever with zero user
// feedback (the crash happens inside an async Promise.all, not during
// render, so no error boundary trips either). A FakeDecimal test double
// (toString/valueOf only, like a real Decimal.js instance) proves
// serializeBatch actually converts the field to a plain number.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeBatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'batch-1', batchName: 'JEE 2027 Morning Batch', subjectOrCourse: 'Mathematics',
    instructorId: null, scheduleDays: '[]', scheduleTime: null, roomOrLocation: null,
    maxCapacity: 20, startDate: new Date(), endDate: null, status: 'ACTIVE',
    feePerMonth: new FakeDecimal(3000) as unknown as number,
    createdAt: new Date(), updatedAt: new Date(),
    instructor: null, _count: { enrollments: 0 },
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeBatch> | null = null) {
  const db: Record<string, any> = {
    coachingBatch: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      count: vi.fn().mockResolvedValue(existing ? 1 : 0),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeBatch({ id: 'batch-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeBatch({ ...existing, ...data }))
      ),
    },
    coachingBatchEnrollment: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('coaching-batch.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createBatch returns feePerMonth as a plain number', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBatch({ batchName: 'JEE 2027 Morning Batch', subjectOrCourse: 'Mathematics', startDate: '2026-07-01', feePerMonth: 3000 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { feePerMonth: unknown } }).data.feePerMonth).toBe('number')
    expect((res as { data: { feePerMonth: unknown } }).data.feePerMonth).toBe(3000)
  })

  it('listBatches returns feePerMonth as a plain number, not a Decimal instance', async () => {
    const db = makeMockDb(makeBatch())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listBatches({})

    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ feePerMonth: unknown }> }).data[0].feePerMonth).toBe('number')
  })

  it('updateBatch returns feePerMonth as a plain number', async () => {
    const db = makeMockDb(makeBatch())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateBatch({ id: 'batch-1', feePerMonth: 3500 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { feePerMonth: unknown } }).data.feePerMonth).toBe('number')
  })

  it('getBatchKPIs computes totalMonthlyRevenue as a plain number (own conversion, unaffected by the bug)', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    db.coachingBatchEnrollment.findMany = vi.fn().mockResolvedValue([
      { effectiveFee: new FakeDecimal(3000) }, { effectiveFee: new FakeDecimal(2000) },
    ])

    const res = await getBatchKPIs()

    expect(res.success).toBe(true)
    expect((res as { data: { totalMonthlyRevenue: number } }).data.totalMonthlyRevenue).toBe(5000)
  })
})

// Real bug found live (2026-07-28 sales/agency/education-vertical audit):
// CoachingBatch.startDate (non-nullable) / endDate (nullable) are DateTime
// fields that used to be returned across Electron's IPC boundary as raw
// Prisma Date instances — structured clone preserves them without throwing
// (unlike a Decimal, caught immediately in dev), so this shipped as a live,
// always-reproducible renderer crash: BatchesScreen.tsx's edit-form
// populator (openEditBatch) calls `b.startDate.split('T')[0]` /
// `b.endDate.split('T')[0]` directly, assuming ISO strings — crashing on
// EVERY batch edit.
describe('coaching-batch.service — startDate/endDate IPC serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createBatch stores startDate/endDate at local midnight (not a bare UTC-midnight parse) and returns them as ISO strings', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBatch({ batchName: 'JEE 2027 Morning Batch', subjectOrCourse: 'Mathematics', startDate: '2026-03-10', endDate: '2026-12-20', feePerMonth: 3000 })

    expect(res.success).toBe(true)
    const call = db.coachingBatch.create.mock.calls[0][0]
    const storedStart: Date = call.data.startDate
    const storedEnd: Date = call.data.endDate
    expect(storedStart.getDate()).toBe(10)
    expect(storedStart.getHours()).toBe(0) // local midnight, not shifted by a bare UTC parse
    expect(storedEnd.getDate()).toBe(20)

    const data = (res as { data: { startDate: unknown; endDate: unknown } }).data
    expect(typeof data.startDate).toBe('string')
    expect(data.startDate).not.toBeInstanceOf(Date)
    expect((data.startDate as string).slice(0, 10)).toBe('2026-03-10')
    expect(typeof data.endDate).toBe('string')
    expect((data.endDate as string).slice(0, 10)).toBe('2026-12-20')
  })

  it('listBatches returns startDate/endDate as ISO strings, not raw Date instances', async () => {
    const db = makeMockDb(makeBatch({ startDate: new Date(2026, 2, 10), endDate: new Date(2026, 11, 20) }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listBatches({})

    expect(res.success).toBe(true)
    const row = (res as { data: Array<{ startDate: unknown; endDate: unknown }> }).data[0]
    expect(typeof row.startDate).toBe('string')
    expect(row.startDate).not.toBeInstanceOf(Date)
    expect(typeof row.endDate).toBe('string')
  })

  it('updateBatch stores a changed startDate at local midnight and returns it serialized', async () => {
    const db = makeMockDb(makeBatch())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateBatch({ id: 'batch-1', startDate: '2026-05-01' })

    expect(res.success).toBe(true)
    const call = db.coachingBatch.update.mock.calls[0][0]
    const stored: Date = call.data.startDate
    expect(stored.getDate()).toBe(1)
    expect(stored.getHours()).toBe(0)
    const data = (res as { data: { startDate: unknown } }).data
    expect(typeof data.startDate).toBe('string')
  })

  it('endDate stays null when never set (no crash on a batch with no end date)', async () => {
    const db = makeMockDb(makeBatch({ endDate: null }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listBatches({})

    expect(res.success).toBe(true)
    const row = (res as { data: Array<{ endDate: unknown }> }).data[0]
    expect(row.endDate).toBeNull()
  })
})
