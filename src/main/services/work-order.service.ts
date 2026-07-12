import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

export interface WorkOrderRecord {
  id: string
  productionOrderId: string
  stepNumber: number
  taskName: string
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED'
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
  steps: Array<{ id?: string; stepNumber: number; taskName: string; notes?: string }>
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
}, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    await db.workOrder.update({
      where: { id: payload.id },
      data: {
        status: payload.status,
        completedAt: payload.status === 'DONE' ? new Date() : null
      }
    })
    await logAction(userId, 'WORK_ORDER_STATUS_UPDATED', 'WorkOrder', payload.id)
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'WO-005', message: err instanceof Error ? err.message : 'Failed to update work order.' } }
  }
}

function toRecord(w: { id: string; productionOrderId: string; stepNumber: number; taskName: string; status: string; notes: string | null; completedAt: Date | null; createdAt: Date }): WorkOrderRecord {
  return {
    id: w.id,
    productionOrderId: w.productionOrderId,
    stepNumber: w.stepNumber,
    taskName: w.taskName,
    status: w.status as WorkOrderRecord['status'],
    notes: w.notes,
    completedAt: w.completedAt?.toISOString() ?? null,
    createdAt: w.createdAt.toISOString()
  }
}
