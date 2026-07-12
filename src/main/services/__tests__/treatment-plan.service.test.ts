import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { createTreatmentPlan } from '../treatment-plan.service'

// Regression coverage for two Phase 25 re-audit findings:
// 1. The handler injected the session's userId into createdById, which is
//    FK'd to Employee (a separate, unlinked table from User) — every create
//    failed with a foreign key violation, live-verified with the real admin
//    User.id. Fixed by never passing the session's userId as createdById;
//    threading it through as userId for the audit log instead.
// 2. totalEstimatedCost is a Prisma Decimal, which Electron's IPC cannot
//    serialize ("An object could not be cloned") — masked until finding #1
//    was fixed, since the FK violation always threw first. Fixed by
//    converting it to a plain number before returning.

// Mimics Prisma's Decimal: a class instance, not a plain number, whose
// numeric value only comes out via toString()/valueOf() — exactly the shape
// that crashes Electron's structured-clone IPC serialization.
class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeMockDb() {
  const db: Record<string, any> = {
    treatmentPlan: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'plan-1', ...data, totalEstimatedCost: new FakeDecimal((data.totalEstimatedCost as number) ?? 0) })
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('treatment-plan.service — createdById must never be a User id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates successfully when createdById is not supplied (the fixed handler behaviour)', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTreatmentPlan({ patientId: 'pat-1', title: 'Root canal', userId: 'user-1' })

    expect(res.success).toBe(true)
    expect(db.treatmentPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ createdById: null }) })
    )
  })

  it('records the real userId on the audit log entry, not on the FK field', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createTreatmentPlan({ patientId: 'pat-1', title: 'Crown', userId: 'user-42' })

    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'user-42', entityType: 'TreatmentPlan' }) })
    )
  })

  it('returns totalEstimatedCost as a plain number, never a Decimal instance (IPC-serialization safety)', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTreatmentPlan({ patientId: 'pat-1', title: 'Bridge', totalEstimatedCost: 12000 })

    expect(res.success).toBe(true)
    const cost = (res as { data: { totalEstimatedCost: unknown } }).data.totalEstimatedCost
    expect(typeof cost).toBe('number')
    expect(cost).toBe(12000)
  })
})
