import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listInterviewRounds, createInterviewRound, updateInterviewRound, deleteInterviewRound } from '../interview-round.service'

function makeRound(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ir-1', candidateId: 'cand-1', jobOrderId: 'jo-1', roundNumber: 1, roundType: 'PHONE_SCREEN',
    scheduledDate: new Date('2026-08-01'), status: 'SCHEDULED', interviewerName: 'Priya', clientFeedback: null, notes: null,
    jobOrder: { id: 'jo-1', orderNumber: 'JO-00001', jobTitle: 'Backend Engineer' },
    ...overrides,
  }
}

function makeMockDb(rounds: ReturnType<typeof makeRound>[] = [makeRound()]) {
  return {
    candidate: { findUnique: vi.fn().mockResolvedValue({ id: 'cand-1' }) },
    jobOrder: { findUnique: vi.fn().mockResolvedValue({ id: 'jo-1' }) },
    interviewRound: {
      findMany: vi.fn().mockResolvedValue(rounds),
      findFirst: vi.fn().mockResolvedValue(rounds[0] ?? null),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeRound({ id: 'ir-new', ...data }))),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeRound({ ...rounds[0], ...data }))),
      delete: vi.fn().mockResolvedValue({}),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
}

describe('interview-round.service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists rounds filtered by candidateId', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await listInterviewRounds({ candidateId: 'cand-1' })
    expect(res.success).toBe(true)
    expect(db.interviewRound.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { candidateId: 'cand-1' } }))
  })

  it('rejects a missing candidate', async () => {
    const db = makeMockDb()
    db.candidate.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createInterviewRound({ candidateId: 'missing', jobOrderId: 'jo-1' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('IR-001')
  })

  it('rejects a missing job order', async () => {
    const db = makeMockDb()
    db.jobOrder.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createInterviewRound({ candidateId: 'cand-1', jobOrderId: 'missing' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('IR-002')
  })

  it('auto-assigns round 1 for a fresh candidate/job-order pairing', async () => {
    const db = makeMockDb([])
    db.interviewRound.findFirst = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createInterviewRound({ candidateId: 'cand-1', jobOrderId: 'jo-1', roundType: 'TECHNICAL' })

    expect(res.success).toBe(true)
    expect(db.interviewRound.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ roundNumber: 1 }) }))
  })

  it('auto-assigns the next round number (count+1), scoped to this candidate/job-order pairing', async () => {
    const db = makeMockDb()
    db.interviewRound.findFirst = vi.fn().mockResolvedValue(makeRound({ roundNumber: 2 }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createInterviewRound({ candidateId: 'cand-1', jobOrderId: 'jo-1' })

    expect(res.success).toBe(true)
    expect(db.interviewRound.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { candidateId: 'cand-1', jobOrderId: 'jo-1' } }))
    expect(db.interviewRound.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ roundNumber: 3 }) }))
  })

  it('honors an explicit round number override', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createInterviewRound({ candidateId: 'cand-1', jobOrderId: 'jo-1', roundNumber: 5 })
    expect(res.success).toBe(true)
    expect(db.interviewRound.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ roundNumber: 5 }) }))
    expect(db.interviewRound.findFirst).not.toHaveBeenCalled()
  })

  it('updates status and clientFeedback', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await updateInterviewRound({ id: 'ir-1', status: 'PASSED', clientFeedback: 'Strong technical skills.' })
    expect(res.success).toBe(true)
    expect(db.interviewRound.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'PASSED', clientFeedback: 'Strong technical skills.' }),
    }))
  })

  it('deletes a round', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await deleteInterviewRound('ir-1')
    expect(res.success).toBe(true)
  })
})
