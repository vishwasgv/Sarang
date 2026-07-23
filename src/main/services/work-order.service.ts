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

    // BUG FOUND 2026-07-22: this used to unconditionally deleteMany+createMany
    // EVERY step on EVERY save, resetting status/qcResult/qcNotes/completedAt
    // to PENDING/null even for steps that already had real progress on them —
    // adding one new step to an order that had 3 DONE steps silently wiped
    // all 3 back to PENDING. Fixed to a real per-step upsert: a step whose id
    // matches an existing row is UPDATED in place (task/notes/QC-flag/order
    // only — status/qcResult/qcNotes/completedAt are left untouched), a step
    // with no id (or an id that doesn't match anything, e.g. a race with a
    // concurrent delete) is CREATED fresh as PENDING, and any existing row
    // whose id is no longer present in the incoming payload is deleted (the
    // user removed that step) — the only guard already in place, blocking
    // edits on COMPLETED/CANCELLED orders, still applies before any of this
    // runs.
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.workOrder.findMany({ where: { productionOrderId: payload.productionOrderId }, select: { id: true } })
      const existingIds = new Set(existing.map(e => e.id))
      const incomingIds = new Set(payload.steps.filter(s => s.id).map(s => s.id))

      const toDelete = [...existingIds].filter(id => !incomingIds.has(id))
      if (toDelete.length > 0) {
        await tx.workOrder.deleteMany({ where: { id: { in: toDelete } } })
      }

      for (const s of payload.steps) {
        if (s.id && existingIds.has(s.id)) {
          await tx.workOrder.update({
            where: { id: s.id },
            data: {
              stepNumber: s.stepNumber,
              taskName: s.taskName.trim(),
              notes: s.notes?.trim() ?? null,
              isQcStep: s.isQcStep ?? false
            }
          })
        } else {
          await tx.workOrder.create({
            data: {
              productionOrderId: payload.productionOrderId,
              stepNumber: s.stepNumber,
              taskName: s.taskName.trim(),
              notes: s.notes?.trim() ?? null,
              isQcStep: s.isQcStep ?? false,
              status: 'PENDING'
            }
          })
        }
      }

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
