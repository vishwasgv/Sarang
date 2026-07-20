import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import {
  listBoardResolutions,
  createBoardResolution,
  updateBoardResolution,
  deleteBoardResolution,
} from '../board-resolution.service'

function makeResolution(overrides: Record<string, unknown> = {}) {
  return {
    id: 'res-1', boardMeetingId: 'bm-1', resolutionNumber: '1',
    resolutionType: 'ORDINARY', resolutionText: 'RESOLVED THAT the accounts be adopted.',
    passedUnanimously: true, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeMockDb(overrides: Record<string, unknown> = {}) {
  const db: Record<string, any> = {
    boardMeeting: { findUnique: vi.fn().mockResolvedValue({ id: 'bm-1', clientId: 'cust-1' }) },
    boardResolution: {
      findMany: vi.fn().mockResolvedValue([makeResolution()]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeResolution({ id: 'res-new', ...data }))),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeResolution({ ...data }))),
      delete: vi.fn().mockResolvedValue({}),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    ...overrides,
  }
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('board-resolution.service', () => {
  it('lists resolutions for a board meeting, oldest first', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listBoardResolutions('bm-1')

    expect(res.success).toBe(true)
    expect(db.boardResolution.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { boardMeetingId: 'bm-1' }, orderBy: { createdAt: 'asc' }
    }))
  })

  it('creates a resolution against an existing board meeting', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBoardResolution({
      boardMeetingId: 'bm-1', resolutionNumber: '2', resolutionType: 'SPECIAL',
      resolutionText: 'RESOLVED THAT the company adopt new AoA.',
    })

    expect(res.success).toBe(true)
    expect(db.boardResolution.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ boardMeetingId: 'bm-1', resolutionNumber: '2', resolutionType: 'SPECIAL' })
    }))
  })

  it('rejects creating a resolution against a board meeting that does not exist', async () => {
    const db = makeMockDb({ boardMeeting: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBoardResolution({ boardMeetingId: 'missing', resolutionNumber: '1', resolutionText: 'text' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BR-002')
    expect(db.boardResolution.create).not.toHaveBeenCalled()
  })

  it('rejects a resolution with blank text', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBoardResolution({ boardMeetingId: 'bm-1', resolutionNumber: '1', resolutionText: '   ' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BR-003')
  })

  it('updates a resolution', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateBoardResolution({ id: 'res-1', resolutionText: 'Amended text.' })

    expect(res.success).toBe(true)
    expect(db.boardResolution.update).toHaveBeenCalledWith({ where: { id: 'res-1' }, data: { resolutionText: 'Amended text.' } })
  })

  it('rejects updating a resolution to blank text', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateBoardResolution({ id: 'res-1', resolutionText: '  ' })

    expect(res.success).toBe(false)
    expect(db.boardResolution.update).not.toHaveBeenCalled()
  })

  it('deletes a resolution', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deleteBoardResolution('res-1')

    expect(res.success).toBe(true)
    expect(db.boardResolution.delete).toHaveBeenCalledWith({ where: { id: 'res-1' } })
  })
})

// Phase 58 §2 — Company Secretary: auto-sequenced resolution numbering,
// scoped per client (company), when the caller omits resolutionNumber.

describe('board-resolution.service — auto-sequenced numbering', () => {
  beforeEach(() => vi.clearAllMocks())

  it('auto-assigns "1" for a client with no prior resolutions', async () => {
    const db = makeMockDb({ boardResolution: { count: vi.fn().mockResolvedValue(0), create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve(makeResolution({ id: 'res-new', ...data }))) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBoardResolution({ boardMeetingId: 'bm-1', resolutionText: 'RESOLVED THAT...' })

    expect(res.success).toBe(true)
    expect(db.boardResolution.count).toHaveBeenCalledWith({ where: { boardMeeting: { clientId: 'cust-1' } } })
    expect(db.boardResolution.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ resolutionNumber: '1' }),
    }))
  })

  it('auto-assigns the next number after the client\'s existing resolution count', async () => {
    const db = makeMockDb({ boardResolution: { count: vi.fn().mockResolvedValue(4), create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve(makeResolution({ id: 'res-new', ...data }))) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBoardResolution({ boardMeetingId: 'bm-1', resolutionText: 'RESOLVED THAT...' })

    expect(res.success).toBe(true)
    expect(db.boardResolution.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ resolutionNumber: '5' }),
    }))
  })

  it('honors an explicitly provided resolutionNumber instead of auto-sequencing', async () => {
    const db = makeMockDb({ boardResolution: { count: vi.fn(), create: vi.fn().mockImplementation(({ data }: any) => Promise.resolve(makeResolution({ id: 'res-new', ...data }))) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createBoardResolution({ boardMeetingId: 'bm-1', resolutionNumber: '2024-03', resolutionText: 'RESOLVED THAT...' })

    expect(res.success).toBe(true)
    expect(db.boardResolution.count).not.toHaveBeenCalled()
    expect(db.boardResolution.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ resolutionNumber: '2024-03' }),
    }))
  })
})
