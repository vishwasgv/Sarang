import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { upsertProgram } from '../exercise-program.service'

// Regression coverage for the Phase 26 re-audit finding: the handler injected
// the session's userId (a User record) into createdById, which is FK'd to
// Employee — a completely separate, unlinked table. Every create failed with
// a foreign key violation, identical to the Phase 25 tooth-record bug. Fixed
// by never passing createdById from the session, and threading userId through
// separately for the audit log instead (which is correctly FK'd to User).

function makeMockDb(existing: Record<string, unknown> | null = null) {
  const db: Record<string, any> = {
    exerciseProgram: {
      findFirst: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'prog-1', ...data })
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: existing?.id ?? 'prog-1', ...existing, ...data })
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('exercise-program.service — createdById must never be a User id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates successfully when createdById is not supplied (the fixed handler behaviour)', async () => {
    const db = makeMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertProgram({ patientId: 'pat-1', exercises: '[]', userId: 'user-1' })

    expect(res.success).toBe(true)
    expect(db.exerciseProgram.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ createdById: null }) })
    )
  })

  it('records the real userId on the audit log entry for a new program, not on the FK field', async () => {
    const db = makeMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await upsertProgram({ patientId: 'pat-1', exercises: '[]', userId: 'user-42' })

    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'user-42', action: 'CREATE', entityType: 'ExerciseProgram' }) })
    )
  })

  it('records the real userId on the audit log entry for an updated program', async () => {
    const db = makeMockDb({ id: 'prog-9', patientId: 'pat-1', isActive: true })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await upsertProgram({ patientId: 'pat-1', exercises: '["new"]', userId: 'user-7' })

    expect(db.exerciseProgram.update).toHaveBeenCalled()
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'user-7', action: 'UPDATE', entityType: 'ExerciseProgram' }) })
    )
  })
})
