import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listIssueComments, addIssueComment, deleteIssueComment } from '../issue-comment.service'

function makeComment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cmt-1', issueId: 'issue-1', authorId: 'user-1', body: 'Looks good to me.',
    createdAt: new Date(), author: { id: 'user-1', fullName: 'Priya Sharma' },
    ...overrides,
  }
}

function makeMockDb(comments: ReturnType<typeof makeComment>[] = [makeComment()]) {
  return {
    issue: { findUnique: vi.fn().mockResolvedValue({ id: 'issue-1' }) },
    issueComment: {
      findMany: vi.fn().mockResolvedValue(comments),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(makeComment({ id: 'cmt-new', ...data }))),
      delete: vi.fn().mockResolvedValue({}),
    },
  }
}

describe('issue-comment.service', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists comments oldest-first for an issue', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await listIssueComments('issue-1')
    expect(res.success).toBe(true)
    expect(db.issueComment.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { issueId: 'issue-1' }, orderBy: { createdAt: 'asc' } }))
  })

  it('rejects an empty comment body', async () => {
    const res = await addIssueComment({ issueId: 'issue-1', body: '   ' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('ISC-003')
  })

  it('rejects a missing issue', async () => {
    const db = makeMockDb()
    db.issue.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await addIssueComment({ issueId: 'missing', body: 'Hello' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('ISC-004')
  })

  it('attributes the comment to the real logged-in user, not a caller-supplied value', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await addIssueComment({ issueId: 'issue-1', body: 'Shipping this today.' }, 'user-42')
    expect(res.success).toBe(true)
    expect(db.issueComment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ authorId: 'user-42', body: 'Shipping this today.' }),
    }))
  })

  it('allows an anonymous/system comment when no session user is passed', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await addIssueComment({ issueId: 'issue-1', body: 'Auto note' })
    expect(res.success).toBe(true)
    expect(db.issueComment.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ authorId: null }) }))
  })

  it('deletes a comment', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await deleteIssueComment('cmt-1')
    expect(res.success).toBe(true)
  })
})
