import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listIssueSubtasks, createIssueSubtask, toggleIssueSubtask, deleteIssueSubtask } from '../issue-subtask.service'

function makeSubtask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1', issueId: 'issue-1', title: 'Write migration', isDone: false,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeMockDb(subtasks: ReturnType<typeof makeSubtask>[] = [makeSubtask()]) {
  return {
    issue: { findUnique: vi.fn().mockResolvedValue({ id: 'issue-1' }) },
    issueSubtask: {
      findMany: vi.fn().mockResolvedValue(subtasks),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeSubtask({ id: 'sub-new', ...data }))),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeSubtask({ ...subtasks[0], ...data }))),
      delete: vi.fn().mockResolvedValue({}),
    },
  }
}

describe('issue-subtask.service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists subtasks for an issue', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await listIssueSubtasks('issue-1')
    expect(res.success).toBe(true)
  })

  it('rejects a blank title', async () => {
    const res = await createIssueSubtask({ issueId: 'issue-1', title: '   ' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('IST-003')
  })

  it('rejects a missing issue', async () => {
    const db = makeMockDb()
    db.issue.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createIssueSubtask({ issueId: 'missing', title: 'Write tests' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('IST-004')
  })

  it('creates a subtask defaulting to not-done', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await createIssueSubtask({ issueId: 'issue-1', title: 'Write tests' })
    expect(res.success).toBe(true)
    expect(db.issueSubtask.create).toHaveBeenCalledWith(expect.objectContaining({ data: { issueId: 'issue-1', title: 'Write tests' } }))
  })

  it('toggles a subtask done/undone', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await toggleIssueSubtask({ id: 'sub-1', isDone: true })
    expect(res.success).toBe(true)
    expect(db.issueSubtask.update).toHaveBeenCalledWith({ where: { id: 'sub-1' }, data: { isDone: true } })
  })

  it('deletes a subtask', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await deleteIssueSubtask('sub-1')
    expect(res.success).toBe(true)
  })
})
