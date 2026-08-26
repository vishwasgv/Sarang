import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { enrollMember, unenrollMember, createBatchClass, updateBatchClass, markBatchClassAttendance, getBatchClassAttendance, getClassOccupancySummary } from '../batch-class.service'

// Regression coverage for the Phase 27 re-audit finding: enrollMember's
// existing-enrollment/capacity check ran as a separate statement from the
// write, outside any transaction — a TOCTOU race. Live-verified with a real
// concurrent test: two simultaneous enroll calls against a capacity-1 class
// both returned success:true, but the final DB state showed only one member
// enrolled — the other's enrollment was silently overwritten and lost. Fixed
// by running the whole check-then-write inside one interactive transaction.

function makeClass(overrides: Record<string, unknown> = {}) {
  return {
    id: 'class-1', className: 'Yoga', instructorId: null, maxCapacity: 1,
    enrolledMemberIds: '[]', scheduleDays: '["MON"]', scheduleTime: '07:00',
    roomOrLocation: null, startDate: new Date(), endDate: null, status: 'ACTIVE',
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeMockDb(cls: ReturnType<typeof makeClass> | null) {
  const db: Record<string, any> = {
    batchClass: {
      findUnique: vi.fn().mockResolvedValue(cls),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'class-new', ...data })
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...cls, ...data })
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  db.$transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db))
  return db
}

// Real bug found live (2026-07-28 service-vertical audit): startDate/endDate
// used to be constructed via a bare `new Date('YYYY-MM-DD')` (UTC
// midnight), inconsistent with this app's own local-date convention used
// elsewhere.
describe('batch-class.service — local-date construction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createBatchClass stores startDate/endDate at local midnight, not UTC midnight', async () => {
    const db = makeMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBatchClass({ className: 'Yoga', maxCapacity: 10, scheduleDays: '["MON"]', scheduleTime: '07:00', startDate: '2026-08-15', endDate: '2026-12-31' })

    expect(res.success).toBe(true)
    const createCall = db.batchClass.create.mock.calls[0][0] as { data: { startDate: Date; endDate: Date } }
    expect(createCall.data.startDate).toEqual(new Date(2026, 7, 15))
    expect(createCall.data.endDate).toEqual(new Date(2026, 11, 31))
  })

  it('updateBatchClass stores an updated startDate at local midnight too', async () => {
    const db = makeMockDb(makeClass())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateBatchClass({ id: 'class-1', startDate: '2026-09-01' })

    expect(res.success).toBe(true)
    const updateCall = db.batchClass.update.mock.calls[0][0] as { data: { startDate: Date } }
    expect(updateCall.data.startDate).toEqual(new Date(2026, 8, 1))
  })

  it('markBatchClassAttendance stores sessionDate at local midnight, not UTC midnight (same bug class, found on this second pass)', async () => {
    const db: Record<string, any> = {
      batchClassAttendance: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), upsert: vi.fn().mockResolvedValue({}) },
    }
    db.$transaction = vi.fn((ops: unknown[]) => Promise.all(ops as Promise<unknown>[]))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await markBatchClassAttendance('class-1', ['member-1'], '2026-08-26')

    const deleteCall = db.batchClassAttendance.deleteMany.mock.calls[0][0] as { where: { sessionDate: Date } }
    expect(deleteCall.where.sessionDate).toEqual(new Date(2026, 7, 26))
    const upsertCall = db.batchClassAttendance.upsert.mock.calls[0][0] as { where: { classId_memberId_sessionDate: { sessionDate: Date } } }
    expect(upsertCall.where.classId_memberId_sessionDate.sessionDate).toEqual(new Date(2026, 7, 26))
  })

  it('getBatchClassAttendance filters by sessionDate at local midnight, not UTC midnight', async () => {
    const db: Record<string, any> = { batchClassAttendance: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await getBatchClassAttendance('class-1', '2026-08-26')

    const call = db.batchClassAttendance.findMany.mock.calls[0][0] as { where: { sessionDate: Date } }
    expect(call.where.sessionDate).toEqual(new Date(2026, 7, 26))
  })
})

describe('batch-class.service — enrollment atomicity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('enrolls successfully when the class has room', async () => {
    const db = makeMockDb(makeClass({ maxCapacity: 5, enrolledMemberIds: '[]' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await enrollMember('class-1', 'member-1')

    expect(res.success).toBe(true)
    expect(db.batchClass.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { enrolledMemberIds: JSON.stringify(['member-1']) } })
    )
  })

  it('runs the capacity check and the write inside a single transaction', async () => {
    const db = makeMockDb(makeClass({ maxCapacity: 5 }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await enrollMember('class-1', 'member-1')

    expect(db.$transaction).toHaveBeenCalledTimes(1)
  })

  it('rejects enrollment once the class is at capacity', async () => {
    const db = makeMockDb(makeClass({ maxCapacity: 1, enrolledMemberIds: JSON.stringify(['existing-member']) }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await enrollMember('class-1', 'member-2')

    expect(res.success).toBe(false)
    expect(db.batchClass.update).not.toHaveBeenCalled()
  })

  it('rejects a duplicate enrollment for the same member', async () => {
    const db = makeMockDb(makeClass({ maxCapacity: 5, enrolledMemberIds: JSON.stringify(['member-1']) }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await enrollMember('class-1', 'member-1')

    expect(res.success).toBe(false)
    expect(db.batchClass.update).not.toHaveBeenCalled()
  })

  it('unenroll removes the member and runs inside a single transaction', async () => {
    const db = makeMockDb(makeClass({ enrolledMemberIds: JSON.stringify(['member-1', 'member-2']) }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await unenrollMember('class-1', 'member-1')

    expect(res.success).toBe(true)
    expect(db.batchClass.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { enrolledMemberIds: JSON.stringify(['member-2']) } })
    )
    expect(db.$transaction).toHaveBeenCalledTimes(1)
  })
})

// Phase 68 §9.1 — Gym/Studio item 3: occupancy-based class scheduling.
describe('batch-class.service — getClassOccupancySummary', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sorts worst-first (highest occupancy) and computes occupancyPercent from enrolled/maxCapacity', async () => {
    const db = {
      batchClass: {
        findMany: vi.fn().mockResolvedValue([
          makeClass({ id: 'c1', className: 'Yoga', maxCapacity: 10, enrolledMemberIds: JSON.stringify(['a', 'b']), instructor: { fullName: 'Priya' } }),
          makeClass({ id: 'c2', className: 'Zumba', maxCapacity: 10, enrolledMemberIds: JSON.stringify(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']), instructor: null }),
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getClassOccupancySummary()

    expect(res.success).toBe(true)
    const rows = (res as any).data.rows
    expect(rows.map((r: any) => r.className)).toEqual(['Zumba', 'Yoga'])
    expect(rows[0].occupancyPercent).toBe(80)
    expect(rows[1].occupancyPercent).toBe(20)
  })

  it('flags at-capacity and near-capacity counts correctly in the summary', async () => {
    const db = {
      batchClass: {
        findMany: vi.fn().mockResolvedValue([
          makeClass({ id: 'c1', maxCapacity: 5, enrolledMemberIds: JSON.stringify(['a', 'b', 'c', 'd', 'e']) }), // 100%
          makeClass({ id: 'c2', maxCapacity: 5, enrolledMemberIds: JSON.stringify(['a', 'b', 'c', 'd']) }), // 80%
          makeClass({ id: 'c3', maxCapacity: 10, enrolledMemberIds: JSON.stringify(['a']) }), // 10%
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getClassOccupancySummary()

    expect((res as any).data.summary).toEqual({ totalClasses: 3, atCapacityCount: 1, nearCapacityCount: 1, underbookedCount: 1 })
  })

  it('tolerates a malformed enrolledMemberIds JSON string rather than throwing', async () => {
    const db = { batchClass: { findMany: vi.fn().mockResolvedValue([makeClass({ enrolledMemberIds: 'not-json' })]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getClassOccupancySummary()

    expect(res.success).toBe(true)
    expect((res as any).data.rows[0].enrolled).toBe(0)
  })
})
