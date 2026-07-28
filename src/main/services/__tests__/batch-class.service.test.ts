import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { enrollMember, unenrollMember, createBatchClass, updateBatchClass } from '../batch-class.service'

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
