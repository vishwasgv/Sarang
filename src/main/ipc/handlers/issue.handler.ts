import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { listIssues, createIssue, updateIssue, deleteIssue } from '../../services/issue.service'
import { listIssueComments, addIssueComment, deleteIssueComment } from '../../services/issue-comment.service'
import { listIssueSubtasks, createIssueSubtask, toggleIssueSubtask, deleteIssueSubtask } from '../../services/issue-subtask.service'
import {
  CreateIssueSchema, UpdateIssueSchema, DeleteIssueSchema,
  IssueIdParamSchema, EntityIdSchema, AddIssueCommentSchema, CreateIssueSubtaskSchema, ToggleIssueSubtaskSchema,
} from '../../validation/issue.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('issue:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { projectId?: string; status?: string; priority?: string; assignedToId?: string; sprintId?: string }
    return listIssues(payload)
  })

  handle('issue:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateIssueSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createIssue(parsed.data)
  })

  handle('issue:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateIssueSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateIssue(parsed.data)
  })

  handle('issue:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = DeleteIssueSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteIssue(parsed.data.id)
  })

  // Phase 58 §2 — Software Agency: comments

  handle('issueComment:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = IssueIdParamSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return listIssueComments(parsed.data.issueId)
  })

  handle('issueComment:add', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = AddIssueCommentSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return addIssueComment(parsed.data, getCurrentSession()?.userId)
  })

  handle('issueComment:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = EntityIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteIssueComment(parsed.data.id)
  })

  // Phase 58 §2 — Software Agency: subtasks

  handle('issueSubtask:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = IssueIdParamSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return listIssueSubtasks(parsed.data.issueId)
  })

  handle('issueSubtask:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateIssueSubtaskSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createIssueSubtask(parsed.data)
  })

  handle('issueSubtask:toggle', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = ToggleIssueSubtaskSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return toggleIssueSubtask(parsed.data)
  })

  handle('issueSubtask:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = EntityIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteIssueSubtask(parsed.data.id)
  })
}
