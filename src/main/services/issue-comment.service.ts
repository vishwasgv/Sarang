import { getPrisma } from '../database/db'

export async function listIssueComments(issueId: string) {
  try {
    const db = getPrisma()
    const comments = await db.issueComment.findMany({
      where: { issueId },
      include: { author: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return { success: true, data: comments }
  } catch (err) {
    return { success: false, error: { code: 'ISC-001', message: err instanceof Error ? err.message : 'Could not list comments.' } }
  }
}

export async function addIssueComment(payload: { issueId: string; body: string }, userId?: string) {
  try {
    if (!payload.issueId) return { success: false, error: { code: 'ISC-002', message: 'Issue ID is required.' } }
    if (!payload.body || !payload.body.trim()) return { success: false, error: { code: 'ISC-003', message: 'Comment cannot be empty.' } }
    const db = getPrisma()
    const issue = await db.issue.findUnique({ where: { id: payload.issueId } })
    if (!issue) return { success: false, error: { code: 'ISC-004', message: 'Issue not found.' } }
    const comment = await db.issueComment.create({
      data: { issueId: payload.issueId, body: payload.body.trim(), authorId: userId ?? null },
      include: { author: { select: { id: true, fullName: true } } },
    })
    return { success: true, data: comment }
  } catch (err) {
    return { success: false, error: { code: 'ISC-005', message: err instanceof Error ? err.message : 'Could not add comment.' } }
  }
}

export async function deleteIssueComment(id: string) {
  try {
    const db = getPrisma()
    await db.issueComment.delete({ where: { id } })
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'ISC-006', message: err instanceof Error ? err.message : 'Could not delete comment.' } }
  }
}
