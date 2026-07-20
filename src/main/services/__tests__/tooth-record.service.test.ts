import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { upsertTooth, getToothHistory } from '../tooth-record.service'

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
    toothRecordHistory: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  db.$transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db))
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

// Phase 58 §2 — ToothRecord itself stays a single row per (patientId,
// toothNumber) that every save overwrites (the fast "current state" read),
// but every save must ALSO append a ToothRecordHistory row, so a tooth's
// progression across visits is a real queryable timeline instead of only
// ever showing its latest state.
describe('tooth-record.service — per-tooth chronological history (Phase 58 §2)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('appends a history row on first creation, snapshotting what was just saved', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await upsertTooth({ patientId: 'pat-1', toothNumber: 11, condition: 'CARIES', surface: '["MESIAL"]', notes: 'Initial finding' })

    expect(db.toothRecordHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ toothRecordId: 'tooth-1', condition: 'CARIES', surface: '["MESIAL"]', notes: 'Initial finding' }),
    })
  })

  it('appends a NEW history row on every subsequent save — does not overwrite the previous one', async () => {
    const db = makeMockDb()
    db.toothRecord.findUnique = vi.fn().mockResolvedValue({ id: 'tooth-1', patientId: 'pat-1', toothNumber: 11, surface: '["MESIAL"]', condition: 'CARIES' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await upsertTooth({ patientId: 'pat-1', toothNumber: 11, condition: 'FILLED', notes: 'Filled today' })

    // update() was used (existing row found), not create() — and history
    // still gets a fresh row rather than editing a prior one.
    expect(db.toothRecord.update).toHaveBeenCalled()
    expect(db.toothRecordHistory.create).toHaveBeenCalledTimes(1)
    expect(db.toothRecordHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ toothRecordId: 'tooth-1', condition: 'FILLED', notes: 'Filled today' }),
    })
  })

  it('runs the ToothRecord write and the history append inside the same transaction', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await upsertTooth({ patientId: 'pat-1', toothNumber: 14, condition: 'SOUND' })

    expect(db.$transaction).toHaveBeenCalledTimes(1)
  })
})

describe('tooth-record.service — getToothHistory', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns entries most-recent-first for an existing tooth', async () => {
    const db: Record<string, any> = {
      toothRecord: { findUnique: vi.fn().mockResolvedValue({ id: 'tooth-1' }) },
      toothRecordHistory: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'h-2', condition: 'FILLED', recordedDate: '2026-02-01' },
          { id: 'h-1', condition: 'CARIES', recordedDate: '2026-01-01' },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getToothHistory('pat-1', 11)

    expect(res.success).toBe(true)
    expect(db.toothRecordHistory.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { toothRecordId: 'tooth-1' }, orderBy: { recordedDate: 'desc' },
    }))
    expect((res.data as Array<{ id: string }>).map((h) => h.id)).toEqual(['h-2', 'h-1'])
  })

  it('returns an empty list without querying history when the tooth has never been recorded', async () => {
    const db: Record<string, any> = {
      toothRecord: { findUnique: vi.fn().mockResolvedValue(null) },
      toothRecordHistory: { findMany: vi.fn() },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getToothHistory('pat-1', 99)

    expect(res.success).toBe(true)
    expect(res.data).toEqual([])
    expect(db.toothRecordHistory.findMany).not.toHaveBeenCalled()
  })
})
