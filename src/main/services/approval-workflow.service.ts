import type { Prisma } from '@prisma/client'
import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { ServiceError } from '../errors/service-error'
import type { CreateApprovalWorkflowPayload, UpdateApprovalWorkflowPayload, SubmitForApprovalPayload, ActOnApprovalStepPayload } from '../validation/approval-workflow.validation'

type Tx = Prisma.TransactionClient

// Multi-level sales/purchase approval workflows — fully greenfield, opt-in
// by design (Section 5.2's own ranking: low touch-frequency, invisible
// unless a threshold is crossed). A PENDING_APPROVAL state is inserted into
// SalesOrder/PurchaseOrder's own flat string status machine between DRAFT
// and CONFIRMED/APPROVED — this service never mutates that status itself,
// it only tracks the approval instance; the caller (sales-order.service.ts/
// purchase-order.service.ts) reads the result and moves its own document.
async function getDocumentAmount(documentType: string, documentId: string, tx?: Tx): Promise<number | null> {
  const db = tx ?? getPrisma()
  if (documentType === 'SALES_ORDER') {
    const so = await db.salesOrder.findUnique({ where: { id: documentId }, select: { totalAmount: true } })
    return so?.totalAmount ?? null
  }
  const po = await db.purchaseOrder.findUnique({ where: { id: documentId }, select: { totalAmount: true } })
  return po?.totalAmount ?? null
}

export const approvalWorkflowService = {
  async createWorkflow(payload: CreateApprovalWorkflowPayload, userId?: string) {
    try {
      const db = getPrisma()
      const workflow = await db.approvalWorkflow.create({
        data: {
          documentType: payload.documentType,
          name: payload.name,
          steps: {
            create: payload.steps.map(s => ({
              sequenceOrder: s.sequenceOrder,
              approverRoleId: s.approverRoleId ?? null,
              approverUserId: s.approverUserId ?? null,
              minAmountThreshold: s.minAmountThreshold
            }))
          }
        },
        include: { steps: { orderBy: { sequenceOrder: 'asc' } } }
      })
      await logAction({ userId, action: 'APPROVAL_WORKFLOW_CREATED', entityType: 'ApprovalWorkflow', entityId: workflow.id, newValue: { name: workflow.name, documentType: workflow.documentType } })
      return { success: true, data: workflow }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to create approval workflow.' } }
    }
  },

  async updateWorkflow(payload: UpdateApprovalWorkflowPayload, userId?: string) {
    try {
      const db = getPrisma()
      const existing = await db.approvalWorkflow.findUnique({ where: { id: payload.id } })
      if (!existing) return { success: false, error: { code: 'AW-001', message: 'Approval workflow not found.' } }
      const updated = await db.approvalWorkflow.update({
        where: { id: payload.id },
        data: { name: payload.name ?? existing.name, isActive: payload.isActive ?? existing.isActive }
      })
      await logAction({ userId, action: 'APPROVAL_WORKFLOW_UPDATED', entityType: 'ApprovalWorkflow', entityId: payload.id, newValue: payload })
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to update approval workflow.' } }
    }
  },

  async listWorkflows(documentType?: string) {
    try {
      const db = getPrisma()
      const where: Record<string, unknown> = {}
      if (documentType) where.documentType = documentType
      const workflows = await db.approvalWorkflow.findMany({ where, include: { steps: { orderBy: { sequenceOrder: 'asc' } } }, orderBy: { createdAt: 'desc' } })
      return { success: true, data: workflows }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to list approval workflows.' } }
    }
  },

  async deleteWorkflow(id: string, userId?: string) {
    try {
      const db = getPrisma()
      const existing = await db.approvalWorkflow.findUnique({ where: { id } })
      if (!existing) return { success: false, error: { code: 'AW-001', message: 'Approval workflow not found.' } }
      await db.approvalWorkflow.delete({ where: { id } })
      await logAction({ userId, action: 'APPROVAL_WORKFLOW_DELETED', entityType: 'ApprovalWorkflow', entityId: id })
      return { success: true }
    } catch (err) {
      return { success: false, error: { code: 'AW-002', message: 'Cannot delete a workflow that already has approval history — deactivate it instead.' } }
    }
  },

  // Returns requiresApproval:false when no active workflow exists for this
  // documentType, or when the document's own amount is below every step's
  // threshold — the caller proceeds straight to CONFIRMED/APPROVED in
  // either case, exactly as if this feature didn't exist.
  async submitForApproval(payload: SubmitForApprovalPayload, userId?: string) {
    try {
      const db = getPrisma()
      const workflow = await db.approvalWorkflow.findFirst({
        where: { documentType: payload.documentType, isActive: true },
        include: { steps: { orderBy: { sequenceOrder: 'asc' } } }
      })
      if (!workflow) return { success: true, data: { requiresApproval: false } }

      const qualifyingSteps = workflow.steps.filter(s => s.minAmountThreshold <= payload.amount)
      if (qualifyingSteps.length === 0) return { success: true, data: { requiresApproval: false } }

      const isSalesOrder = payload.documentType === 'SALES_ORDER'
      const instance = await db.approvalInstance.create({
        data: {
          workflowId: workflow.id,
          documentType: payload.documentType,
          salesOrderId: isSalesOrder ? payload.documentId : null,
          purchaseOrderId: isSalesOrder ? null : payload.documentId,
          status: 'PENDING'
        }
      })
      await logAction({ userId, action: 'APPROVAL_SUBMITTED', entityType: 'ApprovalInstance', entityId: instance.id, newValue: { documentType: payload.documentType, documentId: payload.documentId, amount: payload.amount } })
      return { success: true, data: { requiresApproval: true, instance, qualifyingSteps } }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to submit for approval.' } }
    }
  },

  async getInstanceForDocument(documentType: string, documentId: string) {
    try {
      const db = getPrisma()
      const where = documentType === 'SALES_ORDER' ? { salesOrderId: documentId } : { purchaseOrderId: documentId }
      const instance = await db.approvalInstance.findFirst({
        where,
        include: { workflow: { include: { steps: { orderBy: { sequenceOrder: 'asc' } } } }, actions: { include: { step: true }, orderBy: { actionedAt: 'asc' } } },
        orderBy: { createdAt: 'desc' }
      })
      return { success: true, data: instance }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to fetch approval status.' } }
    }
  },

  // Rejecting any single step rejects the whole instance immediately.
  // Approving marks that one step approved; the instance itself only moves
  // to APPROVED once every step whose own threshold actually applies to
  // this document's real (live-looked-up, not snapshotted) amount has been
  // approved — a step below the threshold is silently skipped, never
  // blocking.
  // Wrapped in one db.$transaction: two different steps of the same instance
  // actioned around the same moment (e.g. two approvers each clearing their
  // own step within seconds of each other) used to each compute allApproved
  // off the OTHER call's pre-write `instance.actions` snapshot, so neither
  // ever saw both actions together and the instance could get stuck on
  // PENDING forever despite every qualifying step having been approved.
  // SQLite's busy_timeout (db.ts) serializes the two transactions' writes,
  // so re-reading actions fresh via tx AFTER this call's own insert is
  // guaranteed to include a concurrent writer's already-committed row.
  async actOnStep(payload: ActOnApprovalStepPayload, userId: string) {
    const db = getPrisma()
    try {
      return await db.$transaction(async (tx) => {
        const instance = await tx.approvalInstance.findUnique({
          where: { id: payload.instanceId },
          include: { workflow: { include: { steps: true } }, actions: true }
        })
        if (!instance) return { success: false, error: { code: 'AW-003', message: 'Approval instance not found.' } }
        if (instance.status !== 'PENDING') return { success: false, error: { code: 'AW-004', message: `This approval is already ${instance.status.toLowerCase()}.` } }

        const step = instance.workflow.steps.find(s => s.id === payload.stepId)
        if (!step) return { success: false, error: { code: 'AW-005', message: 'This step does not belong to this approval instance.' } }

        if (step.approverUserId && step.approverUserId !== userId) {
          return { success: false, error: { code: 'AW-006', message: 'You are not the designated approver for this step.' } }
        }
        if (step.approverRoleId) {
          const actor = await tx.user.findUnique({ where: { id: userId }, select: { roleId: true } })
          if (!actor || actor.roleId !== step.approverRoleId) {
            return { success: false, error: { code: 'AW-006', message: 'You do not hold the role required to approve this step.' } }
          }
        }
        if (instance.actions.some(a => a.stepId === payload.stepId)) {
          return { success: false, error: { code: 'AW-007', message: 'This step has already been actioned.' } }
        }

        await tx.approvalAction.create({
          data: { instanceId: instance.id, stepId: payload.stepId, actionById: userId, action: payload.action, comment: payload.comment ?? null }
        })

        if (payload.action === 'REJECTED') {
          await tx.approvalInstance.update({ where: { id: instance.id }, data: { status: 'REJECTED' } })
          // Real bug found live: this and the APPROVED-branch logAction call
          // below must pass `tx` — the whole point of wrapping this function
          // in db.$transaction (see the comment above actOnStep) was to make
          // the action-insert and status-update atomic, but calling plain
          // logAction() from inside that still-open transaction opens a
          // SECOND, nested db.$transaction() against the same connection —
          // the exact documented self-deadlock class in audit.service.ts's
          // own LogActionParams.tx comment (found once already for
          // journal-entry.service.ts's reverseEntryTx). It threw
          // "Transaction already closed" -> SYS-001, silently rolling back
          // the whole approval (the ApprovalAction row never actually
          // persisted, despite the UI reporting no crash).
          await logAction({ userId, action: 'APPROVAL_REJECTED', entityType: 'ApprovalInstance', entityId: instance.id, newValue: { stepId: payload.stepId, comment: payload.comment }, tx })
          return { success: true, data: { status: 'REJECTED' } }
        }

        const documentId = instance.salesOrderId ?? instance.purchaseOrderId!
        const amount = (await getDocumentAmount(instance.documentType, documentId, tx)) ?? 0
        const qualifyingSteps = instance.workflow.steps.filter(s => s.minAmountThreshold <= amount)
        const freshActions = await tx.approvalAction.findMany({ where: { instanceId: instance.id } })
        const approvedStepIds = new Set(freshActions.filter(a => a.action === 'APPROVED').map(a => a.stepId))
        const allApproved = qualifyingSteps.every(s => approvedStepIds.has(s.id))

        if (allApproved) {
          await tx.approvalInstance.update({ where: { id: instance.id }, data: { status: 'APPROVED' } })
        }
        await logAction({ userId, action: 'APPROVAL_STEP_APPROVED', entityType: 'ApprovalInstance', entityId: instance.id, newValue: { stepId: payload.stepId, fullyApproved: allApproved }, tx })
        return { success: true, data: { status: allApproved ? 'APPROVED' : 'PENDING' } }
      })
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
  }
}
