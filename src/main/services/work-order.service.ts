import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

export interface WorkOrderRecord {
  id: string
  productionOrderId: string
  stepNumber: number
  taskName: string
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED'
  // Phase 58 §2 — QC/inspection gate: a step flagged as a checkpoint
  // requires a pass/fail result before it can be marked DONE.
  isQcStep: boolean
  qcResult: 'PASS' | 'FAIL' | null
  qcNotes: string | null
  notes: string | null
  completedAt: string | null
  createdAt: string
}

export async function listWorkOrders(productionOrderId: string): Promise<{ success: boolean; data?: WorkOrderRecord[]; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const rows = await db.workOrder.findMany({
      where: { productionOrderId },
      orderBy: { stepNumber: 'asc' }
    })
    return { success: true, data: rows.map(toRecord) }
  } catch (err) {
    return { success: false, error: { code: 'WO-001', message: err instanceof Error ? err.message : 'Failed to load work orders.' } }
  }
}

export async function upsertWorkOrders(payload: {
  productionOrderId: string
  steps: Array<{ id?: string; stepNumber: number; taskName: string; notes?: string; isQcStep?: boolean }>
}, userId?: string): Promise<{ success: boolean; data?: WorkOrderRecord[]; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()

    const order = await db.productionOrder.findUnique({ where: { id: payload.productionOrderId }, select: { id: true, status: true } })
    if (!order) return { success: false, error: { code: 'WO-002', message: 'Production order not found.' } }
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      return { success: false, error: { code: 'WO-003', message: `Cannot edit work orders on a ${order.status} order.` } }
    }

    const result = await db.$transaction(async (tx) => {
      // Replace all steps for this order
      await tx.workOrder.deleteMany({ where: { productionOrderId: payload.productionOrderId } })
      await tx.workOrder.createMany({
        data: payload.steps.map(s => ({
          productionOrderId: payload.productionOrderId,
          stepNumber: s.stepNumber,
          taskName: s.taskName.trim(),
          notes: s.notes?.trim() ?? null,
          isQcStep: s.isQcStep ?? false,
          status: 'PENDING'
        }))
      })
      return tx.workOrder.findMany({
        where: { productionOrderId: payload.productionOrderId },
        orderBy: { stepNumber: 'asc' }
      })
    })

    await logAction(userId, 'WORK_ORDERS_UPSERTED', 'WorkOrder', payload.productionOrderId, undefined, { stepCount: payload.steps.length })
    return { success: true, data: result.map(toRecord) }
  } catch (err) {
    return { success: false, error: { code: 'WO-004', message: err instanceof Error ? err.message : 'Failed to save work orders.' } }
  }
}

export async function updateWorkOrderStatus(payload: {
  id: string
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED'
  // Phase 58 §2 — required (server-enforced, not just a UI prompt) when
  // marking a QC-flagged step DONE.
  qcResult?: 'PASS' | 'FAIL'
  qcNotes?: string
}, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const existing = await db.workOrder.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'WO-006', message: 'Work order step not found.' } }

    if (existing.isQcStep && payload.status === 'DONE' && !payload.qcResult) {
      return { success: false, error: { code: 'WO-007', message: `"${existing.taskName}" is a QC checkpoint — record a pass/fail result before marking it done.` } }
    }

    await db.workOrder.update({
      where: { id: payload.id },
      data: {
        status: payload.status,
        completedAt: payload.status === 'DONE' ? new Date() : null,
        ...(existing.isQcStep && payload.qcResult ? { qcResult: payload.qcResult, qcNotes: payload.qcNotes?.trim() || null } : {})
      }
    })
    await logAction(userId, 'WORK_ORDER_STATUS_UPDATED', 'WorkOrder', payload.id, undefined, { status: payload.status, qcResult: payload.qcResult })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'WO-005', message: err instanceof Error ? err.message : 'Failed to update work order.' } }
  }
}

function toRecord(w: { id: string; productionOrderId: string; stepNumber: number; taskName: string; status: string; isQcStep: boolean; qcResult: string | null; qcNotes: string | null; notes: string | null; completedAt: Date | null; createdAt: Date }): WorkOrderRecord {
  return {
    id: w.id,
    productionOrderId: w.productionOrderId,
    stepNumber: w.stepNumber,
    taskName: w.taskName,
    status: w.status as WorkOrderRecord['status'],
    isQcStep: w.isQcStep,
    qcResult: w.qcResult as WorkOrderRecord['qcResult'],
    qcNotes: w.qcNotes,
    notes: w.notes,
    completedAt: w.completedAt?.toISOString() ?? null,
    createdAt: w.createdAt.toISOString()
  }
}
