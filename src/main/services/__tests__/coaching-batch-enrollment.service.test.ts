import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listEnrollmentsByBatch, listEnrollmentsByStudent, createEnrollment, updateEnrollment, promoteFromWaitlist } from '../coaching-batch-enrollment.service'

// Regression coverage for the Phase 31 re-audit finding:
// CoachingBatchEnrollment.discountAmount/effectiveFee are Prisma Decimal
// fields, returned unserialized by every function below. Electron's IPC
// can't serialize a Decimal instance and throws "An object could not be
// cloned". listEnrollmentsByStudent additionally nests `batch`, which has
// its own Decimal field (feePerMonth) — a second crash surface in the same
// response, fixed by reusing coaching-batch.service.ts's exported
// serializeBatch rather than duplicating the conversion. Live-verified: all
// four functions crashed with real Decimal data present.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeEnrollment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'enr-1', batchId: 'batch-1', studentId: 'stu-1',
    enrolledDate: new Date(), status: 'ACTIVE', discountType: 'NONE',
    discountAmount: new FakeDecimal(0) as unknown as number,
    effectiveFee: new FakeDecimal(3000) as unknown as number,
    notes: null,
    student: { id: 'stu-1', customerName: 'Ramesh Kumar', phone: null },
    ...overrides,
  }
}

function makeBatchWithFee(overrides: Record<string, unknown> = {}) {
  return {
    id: 'batch-1', batchName: 'JEE 2027 Morning Batch', subjectOrCourse: 'Mathematics',
    feePerMonth: new FakeDecimal(3000) as unknown as number,
    maxCapacity: 20,
    ...overrides,
  }
}

function makeMockDb(existingEnrollment: ReturnType<typeof makeEnrollment> | null = null) {
  const db: Record<string, any> = {
    coachingBatchEnrollment: {
      findMany: vi.fn().mockResolvedValue(existingEnrollment ? [existingEnrollment] : []),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeEnrollment({ id: 'enr-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeEnrollment({ ...existingEnrollment, ...data }))
      ),
    },
    coachingBatch: {
      findUnique: vi.fn().mockResolvedValue(makeBatchWithFee()),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('coaching-batch-enrollment.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createEnrollment returns discountAmount and effectiveFee as plain numbers', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createEnrollment({ batchId: 'batch-1', studentId: 'stu-1', effectiveFee: 3000 })

    expect(res.success).toBe(true)
    const data = (res as { data: { discountAmount: unknown; effectiveFee: unknown } }).data
    expect(typeof data.discountAmount).toBe('number')
    expect(typeof data.effectiveFee).toBe('number')
  })

  it('listEnrollmentsByBatch returns effectiveFee as a plain number, not a Decimal instance', async () => {
    const db = makeMockDb(makeEnrollment())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listEnrollmentsByBatch('batch-1')

    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ effectiveFee: unknown }> }).data[0].effectiveFee).toBe('number')
  })

  it('listEnrollmentsByStudent serializes both effectiveFee and nested batch.feePerMonth', async () => {
    const db = makeMockDb(makeEnrollment({ batch: makeBatchWithFee() }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listEnrollmentsByStudent('stu-1')

    expect(res.success).toBe(true)
    const enr = (res as { data: Array<{ effectiveFee: unknown; batch: { feePerMonth: unknown } }> }).data[0]
    expect(typeof enr.effectiveFee).toBe('number')
    expect(typeof enr.batch.feePerMonth).toBe('number')
  })

  it('updateEnrollment returns effectiveFee as a plain number', async () => {
    const db = makeMockDb(makeEnrollment())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateEnrollment({ id: 'enr-1', effectiveFee: 2500 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { effectiveFee: unknown } }).data.effectiveFee).toBe('number')
  })

})

// Phase 58 §2 — a batch at capacity used to hard-reject any new enrollment;
// it now enrolls onto a real WAITLISTED queue instead, promotable once a
// seat frees up.

describe('coaching-batch-enrollment.service — waitlist', () => {
  beforeEach(() => vi.clearAllMocks())

  it('enrolls as WAITLISTED (not rejected) when the batch is already at capacity', async () => {
    const db = makeMockDb()
    db.coachingBatch.findUnique = vi.fn().mockResolvedValue(makeBatchWithFee({ maxCapacity: 1 }))
    db.coachingBatchEnrollment.count = vi.fn().mockResolvedValue(1)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createEnrollment({ batchId: 'batch-1', studentId: 'stu-2', effectiveFee: 3000 })

    expect(res.success).toBe(true)
    const data = (res as { data: { status: string; waitlisted: boolean } }).data
    expect(data.status).toBe('WAITLISTED')
    expect(data.waitlisted).toBe(true)
    expect(db.coachingBatchEnrollment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'WAITLISTED' }),
    }))
  })

  it('enrolls as ACTIVE (waitlisted: false) when there is room', async () => {
    const db = makeMockDb()
    db.coachingBatch.findUnique = vi.fn().mockResolvedValue(makeBatchWithFee({ maxCapacity: 20 }))
    db.coachingBatchEnrollment.count = vi.fn().mockResolvedValue(5)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createEnrollment({ batchId: 'batch-1', studentId: 'stu-2', effectiveFee: 3000 })

    expect(res.success).toBe(true)
    const data = (res as { data: { status: string; waitlisted: boolean } }).data
    expect(data.status).toBe('ACTIVE')
    expect(data.waitlisted).toBe(false)
  })

  it('promoteFromWaitlist rejects a missing enrollment', async () => {
    const db = makeMockDb()
    db.coachingBatchEnrollment.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await promoteFromWaitlist('missing')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('ENR-004')
  })

  it('promoteFromWaitlist rejects an enrollment that is not WAITLISTED', async () => {
    const db = makeMockDb()
    db.coachingBatchEnrollment.findUnique = vi.fn().mockResolvedValue(makeEnrollment({ status: 'ACTIVE' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await promoteFromWaitlist('enr-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('ENR-005')
  })

  it('promoteFromWaitlist rejects if the batch is still full at promote time', async () => {
    const db = makeMockDb()
    db.coachingBatchEnrollment.findUnique = vi.fn().mockResolvedValue(makeEnrollment({ status: 'WAITLISTED' }))
    db.coachingBatch.findUnique = vi.fn().mockResolvedValue(makeBatchWithFee({ maxCapacity: 1 }))
    db.coachingBatchEnrollment.count = vi.fn().mockResolvedValue(1)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await promoteFromWaitlist('enr-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('ENR-006')
  })

  it('promoteFromWaitlist flips a waitlisted enrollment to ACTIVE once a seat is free', async () => {
    const db = makeMockDb()
    db.coachingBatchEnrollment.findUnique = vi.fn().mockResolvedValue(makeEnrollment({ status: 'WAITLISTED' }))
    db.coachingBatch.findUnique = vi.fn().mockResolvedValue(makeBatchWithFee({ maxCapacity: 20 }))
    db.coachingBatchEnrollment.count = vi.fn().mockResolvedValue(5)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await promoteFromWaitlist('enr-1')

    expect(res.success).toBe(true)
    expect(db.coachingBatchEnrollment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'enr-1' },
      data: { status: 'ACTIVE' },
    }))
  })
})
