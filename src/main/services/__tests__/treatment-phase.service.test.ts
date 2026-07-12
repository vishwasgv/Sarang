import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { createTreatmentPhase } from '../treatment-phase.service'

// Regression coverage for the Phase 26 re-audit finding: the handler injected
// the session's userId (a User record) into createdById, which is FK'd to
// Employee — a completely separate, unlinked table. Every create failed with
// a foreign key violation, identical to the Phase 25 tooth-record bug. Fixed
// by never passing createdById from the session, and threading userId through
// separately for the audit log instead (which is correctly FK'd to User).

function makeMockDb() {
  const db: Record<string, any> = {
    treatmentPhase: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'phase-1', ...data })
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('treatment-phase.service — createdById must never be a User id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates successfully when createdById is not supplied (the fixed handler behaviour)', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTreatmentPhase({
      patientId: 'pat-1', title: 'Initial assessment', startDate: '2026-07-01', userId: 'user-1',
    })

    expect(res.success).toBe(true)
    expect(db.treatmentPhase.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ createdById: null }) })
    )
  })

  it('records the real userId on the audit log entry, not on the FK field', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createTreatmentPhase({
      patientId: 'pat-1', title: 'Follow-up', startDate: '2026-07-02', userId: 'user-42',
    })

    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'user-42', entityType: 'TreatmentPhase' }) })
    )
  })

  it('still rejects an invalid phase value before touching the database', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTreatmentPhase({
      patientId: 'pat-1', title: 'Bad phase', startDate: '2026-07-01', phase: 'NOT_REAL', userId: 'user-1',
    })

    expect(res.success).toBe(false)
    expect(db.treatmentPhase.create).not.toHaveBeenCalled()
  })
})
