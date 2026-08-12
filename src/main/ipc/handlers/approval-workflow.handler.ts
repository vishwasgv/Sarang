import { approvalWorkflowService } from '../../services/approval-workflow.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateApprovalWorkflowSchema, UpdateApprovalWorkflowSchema, ActOnApprovalStepSchema } from '../../validation/approval-workflow.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function validateId(id: unknown, label = 'ID'): { success: false; error: { code: string; message: string } } | null {
  if (typeof id !== 'string' || !id.trim()) {
    return { success: false, error: { code: 'VAL-001', message: `Invalid ${label}: must be a non-empty string.` } }
  }
  return null
}

// Configuring a workflow (who approves what, at what threshold) is
// Admin-only — a structural policy decision, same trust tier as the
// Transaction Lock date. Acting on a step you've been named an approver
// for is a normal Manager-tier action.
export function register(handle: HandleFn): void {
  handle('approvalWorkflows:list', async (payload) => {
    const deny = await requirePermission('approvalWorkflows.view'); if (deny) return deny
    return approvalWorkflowService.listWorkflows(payload as string | undefined)
  })

  handle('approvalWorkflows:create', async (payload) => {
    const deny = await requirePermission('approvalWorkflows.manage'); if (deny) return deny
    const parsed = CreateApprovalWorkflowSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return approvalWorkflowService.createWorkflow(parsed.data, getCurrentSession()?.userId)
  })

  handle('approvalWorkflows:update', async (payload) => {
    const deny = await requirePermission('approvalWorkflows.manage'); if (deny) return deny
    const parsed = UpdateApprovalWorkflowSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return approvalWorkflowService.updateWorkflow(parsed.data, getCurrentSession()?.userId)
  })

  handle('approvalWorkflows:delete', async (id) => {
    const deny = await requirePermission('approvalWorkflows.manage'); if (deny) return deny
    const bad = validateId(id, 'approval workflow ID'); if (bad) return bad
    return approvalWorkflowService.deleteWorkflow(id as string, getCurrentSession()?.userId)
  })

  handle('approvalWorkflows:getInstanceForDocument', async (payload) => {
    const deny = await requirePermission('approvalWorkflows.view'); if (deny) return deny
    const p = payload as { documentType: string; documentId: string }
    return approvalWorkflowService.getInstanceForDocument(p.documentType, p.documentId)
  })

  handle('approvalWorkflows:actOnStep', async (payload) => {
    const deny = await requirePermission('approvalWorkflows.act'); if (deny) return deny
    const parsed = ActOnApprovalStepSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const userId = getCurrentSession()?.userId
    if (!userId) return { success: false, error: { code: 'AUTH-001', message: 'Not authenticated.' } }
    return approvalWorkflowService.actOnStep(parsed.data, userId)
  })
}
