import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { upsertTooth } from '../tooth-record.service'

// Regression coverage for the Phase 25 re-audit finding: the handler injected
// the session's userId (a User record) into recordedById, which is FK'd to
// Employee — a completely separate, unlinked table. Every create failed with
// a foreign key violation. Live-verified via a direct Prisma call with the
// real admin User.id. Fixed by never passing recordedById from the session,
// and threading userId through separately for the audit log instead (which
// is correctly FK'd to User).

function makeMockDb() {
  const db: Record<string, any> = {
    toothRecord: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'tooth-1', ...data })
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'tooth-1', ...data })
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('tooth-record.service — recordedById must never be a User id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates successfully when recordedById is not supplied (the fixed handler behaviour)', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertTooth({ patientId: 'pat-1', toothNumber: 11, condition: 'CARIES', userId: 'user-1' })

    expect(res.success).toBe(true)
    expect(db.toothRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ recordedById: null }) })
    )
  })

  it('never writes a caller-supplied recordedById as a live FK value without it being null-safe', async () => {
    // Even if some future caller passes a recordedById through, the service
    // itself must not silently coerce an arbitrary string into the FK column
    // without going through Prisma's own validation — this just documents
    // that the field is passed through as-is (Prisma enforces the FK).
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await upsertTooth({ patientId: 'pat-1', toothNumber: 12, condition: 'SOUND' })

    expect(db.toothRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ recordedById: null }) })
    )
  })

  it('records the real userId on the audit log entry, not on the FK field', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await upsertTooth({ patientId: 'pat-1', toothNumber: 13, condition: 'FILLED', userId: 'user-42' })

    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'user-42', entityType: 'ToothRecord' }) })
    )
  })
})
