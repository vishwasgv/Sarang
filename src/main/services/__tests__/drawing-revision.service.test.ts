import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import {
  listDrawingRevisions, createDrawingRevision, updateDrawingRevision, deleteDrawingRevision,
  issueNewRevision, getRevisionHistory,
} from '../drawing-revision.service'

function makeRevision(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dr-1', projectId: 'proj-1', drawingNumber: 'A-101', title: 'Ground Floor Plan',
    discipline: 'ARCHITECTURAL', revisionNumber: 'A', status: 'DRAFT',
    issuedDate: null, notes: null, createdAt: new Date(), updatedAt: new Date(),
    supersedesId: null, approvedByName: null, approvedDate: null,
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeRevision> | null = makeRevision()) {
  const db: Record<string, any> = {
    drawingRevision: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      findUnique: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeRevision({ id: 'dr-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeRevision({ ...existing, ...data }))
      ),
      delete: vi.fn().mockResolvedValue({}),
    },
  }
  db.$transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db))
  return db
}

describe('drawing-revision.service — basic CRUD', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists revisions for a project', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listDrawingRevisions('proj-1')
    expect(res.success).toBe(true)
  })

  it('rejects creating a revision with a blank drawing number', async () => {
    const res = await createDrawingRevision({ projectId: 'proj-1', drawingNumber: '  ', title: 'Plan' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DR-002')
  })

  it('creates a revision with default revisionNumber "A"', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createDrawingRevision({ projectId: 'proj-1', drawingNumber: 'A-101', title: 'Ground Floor Plan' })
    expect(res.success).toBe(true)
    expect(db.drawingRevision.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ revisionNumber: 'A' }),
    }))
  })

  it('deletes a revision', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deleteDrawingRevision('dr-1')
    expect(res.success).toBe(true)
    expect(db.drawingRevision.delete).toHaveBeenCalledWith({ where: { id: 'dr-1' } })
  })
})

// Phase 58 §2 — Architect: client approval/sign-off trail (signer name +
// date), not just a status label.

describe('drawing-revision.service.updateDrawingRevision — approval sign-off', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects moving status to APPROVED without an approvedByName (payload or existing)', async () => {
    const db = makeMockDb(makeRevision({ approvedByName: null }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateDrawingRevision({ id: 'dr-1', status: 'APPROVED' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DR-007')
    expect(db.drawingRevision.update).not.toHaveBeenCalled()
  })

  it('accepts APPROVED when approvedByName is provided in the same call, and stamps a real approvedDate', async () => {
    const db = makeMockDb(makeRevision())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateDrawingRevision({ id: 'dr-1', status: 'APPROVED', approvedByName: 'Jane Client' })

    expect(res.success).toBe(true)
    expect(db.drawingRevision.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'APPROVED', approvedByName: 'Jane Client', approvedDate: expect.any(Date) }),
    }))
  })

  it('re-saving other fields on an already-approved revision does not require re-typing the name', async () => {
    const db = makeMockDb(makeRevision({ status: 'APPROVED', approvedByName: 'Jane Client', approvedDate: new Date() }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateDrawingRevision({ id: 'dr-1', status: 'APPROVED', notes: 'no change' })

    expect(res.success).toBe(true)
    expect(db.drawingRevision.update).toHaveBeenCalled()
  })

  it('non-APPROVED status transitions are unaffected by the approval check', async () => {
    const db = makeMockDb(makeRevision())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateDrawingRevision({ id: 'dr-1', status: 'ISSUED_FOR_REVIEW' })

    expect(res.success).toBe(true)
    expect(db.drawingRevision.findUnique).not.toHaveBeenCalled()
  })
})

// Phase 58 §2 — Architect: real drawing revision history, chained via
// supersedesId instead of a mutable revisionNumber field.

describe('drawing-revision.service.issueNewRevision', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a blank revision number', async () => {
    const res = await issueNewRevision({ previousRevisionId: 'dr-1', revisionNumber: '  ' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DR-008')
  })

  it('rejects a missing previous revision', async () => {
    const db = makeMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await issueNewRevision({ previousRevisionId: 'missing', revisionNumber: 'B' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DR-009')
  })

  it('rejects issuing against an already-SUPERSEDED revision', async () => {
    const db = makeMockDb(makeRevision({ status: 'SUPERSEDED' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await issueNewRevision({ previousRevisionId: 'dr-1', revisionNumber: 'C' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DR-010')
  })

  it('creates a new row linked via supersedesId and flips the predecessor to SUPERSEDED', async () => {
    const db = makeMockDb(makeRevision({ id: 'dr-1', drawingNumber: 'A-101', title: 'Ground Floor Plan', discipline: 'ARCHITECTURAL', status: 'APPROVED' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await issueNewRevision({ previousRevisionId: 'dr-1', revisionNumber: 'B', notes: 'Client requested layout change' })

    expect(res.success).toBe(true)
    expect(db.drawingRevision.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        projectId: 'proj-1', drawingNumber: 'A-101', title: 'Ground Floor Plan',
        revisionNumber: 'B', status: 'DRAFT', supersedesId: 'dr-1', notes: 'Client requested layout change',
      }),
    }))
    expect(db.drawingRevision.update).toHaveBeenCalledWith({ where: { id: 'dr-1' }, data: { status: 'SUPERSEDED' } })
  })

  it('inherits title/discipline from the predecessor when not overridden', async () => {
    const db = makeMockDb(makeRevision({ id: 'dr-1', title: 'Ground Floor Plan', discipline: 'STRUCTURAL' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await issueNewRevision({ previousRevisionId: 'dr-1', revisionNumber: 'B' })

    expect(db.drawingRevision.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ title: 'Ground Floor Plan', discipline: 'STRUCTURAL' }),
    }))
  })
})

describe('drawing-revision.service.getRevisionHistory', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists every revision for a drawing number, oldest first', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getRevisionHistory('proj-1', 'A-101')

    expect(res.success).toBe(true)
    expect(db.drawingRevision.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId: 'proj-1', drawingNumber: 'A-101' }, orderBy: { createdAt: 'asc' },
    }))
  })
})
