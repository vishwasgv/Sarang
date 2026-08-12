import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { approvalWorkflowService } from '../approval-workflow.service'

function makeStep(overrides: Record<string, unknown> = {}) {
  return { id: 'step-1', workflowId: 'wf-1', sequenceOrder: 1, approverRoleId: 'role-mgr', approverUserId: null, minAmountThreshold: 50000, ...overrides }
}

function makeWorkflow(overrides: Record<string, unknown> = {}) {
  return { id: 'wf-1', documentType: 'PURCHASE_ORDER', name: 'Big Spend Approval', isActive: true, steps: [makeStep()], ...overrides }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  const db = {
    approvalWorkflow: {
      create: vi.fn().mockResolvedValue(makeWorkflow()),
      findUnique: vi.fn().mockResolvedValue(makeWorkflow()),
      findFirst: vi.fn().mockResolvedValue(makeWorkflow()),
      findMany: vi.fn().mockResolvedValue([makeWorkflow()]),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({})
    },
    approvalInstance: {
      create: vi.fn().mockResolvedValue({ id: 'inst-1', workflowId: 'wf-1', status: 'PENDING' }),
      findUnique: vi.fn().mockResolvedValue({ id: 'inst-1', workflowId: 'wf-1', status: 'PENDING', salesOrderId: null, purchaseOrderId: 'po-1', documentType: 'PURCHASE_ORDER', workflow: makeWorkflow(), actions: [] }),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({})
    },
    approvalAction: { create: vi.fn().mockResolvedValue({}) },
    purchaseOrder: { findUnique: vi.fn().mockResolvedValue({ totalAmount: 60000 }) },
    salesOrder: { findUnique: vi.fn().mockResolvedValue({ totalAmount: 60000 }) },
    user: { findUnique: vi.fn().mockResolvedValue({ roleId: 'role-mgr' }) },
    ...overrides
  } as Record<string, any>
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('approvalWorkflowService.submitForApproval', () => {
  it('returns requiresApproval:false when no active workflow exists for this documentType', async () => {
    const db = makeDb({ approvalWorkflow: { findFirst: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await approvalWorkflowService.submitForApproval({ documentType: 'PURCHASE_ORDER', documentId: 'po-1', amount: 60000 })

    expect(res.success).toBe(true)
    expect((res as any).data).toEqual({ requiresApproval: false })
    expect(db.approvalInstance.create).not.toHaveBeenCalled()
  })

  it('returns requiresApproval:false when the amount is below every step\'s threshold', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await approvalWorkflowService.submitForApproval({ documentType: 'PURCHASE_ORDER', documentId: 'po-1', amount: 10000 })

    expect(res.success).toBe(true)
    expect((res as any).data).toEqual({ requiresApproval: false })
  })

  it('creates a real ApprovalInstance when the amount qualifies', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await approvalWorkflowService.submitForApproval({ documentType: 'PURCHASE_ORDER', documentId: 'po-1', amount: 60000 })

    expect(res.success).toBe(true)
    expect((res as any).data.requiresApproval).toBe(true)
    expect(db.approvalInstance.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ purchaseOrderId: 'po-1', salesOrderId: null, status: 'PENDING' })
    }))
  })
})

describe('approvalWorkflowService.actOnStep', () => {
  it('rejects when the acting user does not hold the required role', async () => {
    const db = makeDb({ user: { findUnique: vi.fn().mockResolvedValue({ roleId: 'role-cashier' }) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await approvalWorkflowService.actOnStep({ instanceId: 'inst-1', stepId: 'step-1', action: 'APPROVED' }, 'user-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('AW-006')
    expect(db.approvalAction.create).not.toHaveBeenCalled()
  })

  it('rejects a step that was already actioned', async () => {
    const db = makeDb({
      approvalInstance: { findUnique: vi.fn().mockResolvedValue({ id: 'inst-1', workflowId: 'wf-1', status: 'PENDING', salesOrderId: null, purchaseOrderId: 'po-1', documentType: 'PURCHASE_ORDER', workflow: makeWorkflow(), actions: [{ stepId: 'step-1', action: 'APPROVED' }] }) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await approvalWorkflowService.actOnStep({ instanceId: 'inst-1', stepId: 'step-1', action: 'APPROVED' }, 'user-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('AW-007')
  })

  it('a single-step workflow moves the instance straight to APPROVED', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await approvalWorkflowService.actOnStep({ instanceId: 'inst-1', stepId: 'step-1', action: 'APPROVED' }, 'user-1')

    expect(res.success).toBe(true)
    expect((res as any).data.status).toBe('APPROVED')
    expect(db.approvalInstance.update).toHaveBeenCalledWith({ where: { id: 'inst-1' }, data: { status: 'APPROVED' } })
  })

  it('a two-step workflow stays PENDING after only the first step approves', async () => {
    const twoStepWorkflow = makeWorkflow({ steps: [makeStep({ id: 'step-1', sequenceOrder: 1 }), makeStep({ id: 'step-2', sequenceOrder: 2, approverRoleId: 'role-admin' })] })
    const db = makeDb({
      approvalInstance: { findUnique: vi.fn().mockResolvedValue({ id: 'inst-1', workflowId: 'wf-1', status: 'PENDING', salesOrderId: null, purchaseOrderId: 'po-1', documentType: 'PURCHASE_ORDER', workflow: twoStepWorkflow, actions: [] }), update: vi.fn().mockResolvedValue({}) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await approvalWorkflowService.actOnStep({ instanceId: 'inst-1', stepId: 'step-1', action: 'APPROVED' }, 'user-1')

    expect(res.success).toBe(true)
    expect((res as any).data.status).toBe('PENDING')
    expect(db.approvalInstance.update).not.toHaveBeenCalled()
  })

  it('a step below the document\'s real amount threshold is silently skipped, never blocking full approval', async () => {
    // step-2's own threshold (200000) exceeds the real PO amount (60000) — it
    // must not be required for the instance to reach APPROVED.
    const mixedWorkflow = makeWorkflow({ steps: [makeStep({ id: 'step-1', sequenceOrder: 1, minAmountThreshold: 50000 }), makeStep({ id: 'step-2', sequenceOrder: 2, minAmountThreshold: 200000, approverRoleId: 'role-admin' })] })
    const db = makeDb({
      approvalInstance: { findUnique: vi.fn().mockResolvedValue({ id: 'inst-1', workflowId: 'wf-1', status: 'PENDING', salesOrderId: null, purchaseOrderId: 'po-1', documentType: 'PURCHASE_ORDER', workflow: mixedWorkflow, actions: [] }), update: vi.fn().mockResolvedValue({}) },
      purchaseOrder: { findUnique: vi.fn().mockResolvedValue({ totalAmount: 60000 }) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await approvalWorkflowService.actOnStep({ instanceId: 'inst-1', stepId: 'step-1', action: 'APPROVED' }, 'user-1')

    expect(res.success).toBe(true)
    expect((res as any).data.status).toBe('APPROVED')
  })

  it('rejecting any single step rejects the whole instance immediately', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await approvalWorkflowService.actOnStep({ instanceId: 'inst-1', stepId: 'step-1', action: 'REJECTED', comment: 'Over budget' }, 'user-1')

    expect(res.success).toBe(true)
    expect((res as any).data.status).toBe('REJECTED')
    expect(db.approvalInstance.update).toHaveBeenCalledWith({ where: { id: 'inst-1' }, data: { status: 'REJECTED' } })
  })

  it('rejects acting on an already-decided (non-PENDING) instance', async () => {
    const db = makeDb({ approvalInstance: { findUnique: vi.fn().mockResolvedValue({ id: 'inst-1', workflowId: 'wf-1', status: 'APPROVED', salesOrderId: null, purchaseOrderId: 'po-1', documentType: 'PURCHASE_ORDER', workflow: makeWorkflow(), actions: [] }) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await approvalWorkflowService.actOnStep({ instanceId: 'inst-1', stepId: 'step-1', action: 'APPROVED' }, 'user-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('AW-004')
  })
})
