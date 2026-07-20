import { getPrisma } from '../database/db'

export async function listIssueSubtasks(issueId: string) {
  try {
    const db = getPrisma()
    const subtasks = await db.issueSubtask.findMany({
      where: { issueId },
      orderBy: { createdAt: 'asc' },
    })
    return { success: true, data: subtasks }
  } catch (err) {
    return { success: false, error: { code: 'IST-001', message: err instanceof Error ? err.message : 'Could not list subtasks.' } }
  }
}

export async function createIssueSubtask(payload: { issueId: string; title: string }) {
  try {
    if (!payload.issueId) return { success: false, error: { code: 'IST-002', message: 'Issue ID is required.' } }
    if (!payload.title || !payload.title.trim()) return { success: false, error: { code: 'IST-003', message: 'Subtask title is required.' } }
    const db = getPrisma()
    const issue = await db.issue.findUnique({ where: { id: payload.issueId } })
    if (!issue) return { success: false, error: { code: 'IST-004', message: 'Issue not found.' } }
    const subtask = await db.issueSubtask.create({
      data: { issueId: payload.issueId, title: payload.title.trim() },
    })
    return { success: true, data: subtask }
  } catch (err) {
    return { success: false, error: { code: 'IST-005', message: err instanceof Error ? err.message : 'Could not create subtask.' } }
  }
}

export async function toggleIssueSubtask(payload: { id: string; isDone: boolean }) {
  try {
    const db = getPrisma()
    const subtask = await db.issueSubtask.update({
      where: { id: payload.id },
      data: { isDone: payload.isDone },
    })
    return { success: true, data: subtask }
  } catch (err) {
    return { success: false, error: { code: 'IST-006', message: err instanceof Error ? err.message : 'Could not update subtask.' } }
  }
}

export async function deleteIssueSubtask(id: string) {
  try {
    const db = getPrisma()
    await db.issueSubtask.delete({ where: { id } })
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'IST-007', message: err instanceof Error ? err.message : 'Could not delete subtask.' } }
  }
}
