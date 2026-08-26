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
  // Phase 67 §9.1 — Manufacturing item 3: per-stage rejection quantity,
  // independent of the binary qcResult — a batch can PASS overall with a
  // handful of units still rejected at this specific stage.
  qtyInspected: number | null
  qtyRejected: number | null
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
  // Phase 67 §9.1 — Manufacturing item 3: optional per-stage inspection
  // counts, only meaningful alongside a qcResult. qtyRejected is validated
  // against qtyInspected when both are given — never silently accepted as
  // an impossible rejected-more-than-inspected count.
  qtyInspected?: number
  qtyRejected?: number
}, userId?: string): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const existing = await db.workOrder.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'WO-006', message: 'Work order step not found.' } }

    if (existing.isQcStep && payload.status === 'DONE' && !payload.qcResult) {
      return { success: false, error: { code: 'WO-007', message: `"${existing.taskName}" is a QC checkpoint — record a pass/fail result before marking it done.` } }
    }
    if (payload.qtyInspected != null && payload.qtyRejected != null && payload.qtyRejected > payload.qtyInspected) {
      return { success: false, error: { code: 'WO-008', message: 'Rejected quantity cannot exceed inspected quantity.' } }
    }

    await db.workOrder.update({
      where: { id: payload.id },
      data: {
        status: payload.status,
        completedAt: payload.status === 'DONE' ? new Date() : null,
        ...(existing.isQcStep && payload.qcResult ? {
          qcResult: payload.qcResult, qcNotes: payload.qcNotes?.trim() || null,
          qtyInspected: payload.qtyInspected ?? null, qtyRejected: payload.qtyRejected ?? null
        } : {})
      }
    })
    await logAction(userId, 'WORK_ORDER_STATUS_UPDATED', 'WorkOrder', payload.id, undefined, { status: payload.status, qcResult: payload.qcResult, qtyInspected: payload.qtyInspected, qtyRejected: payload.qtyRejected })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'WO-005', message: err instanceof Error ? err.message : 'Failed to update work order.' } }
  }
}

// Phase 67 §9.1 — Manufacturing item 1: machine/labour downtime capture.
export interface DowntimeEntryRecord {
  id: string
  workOrderId: string
  reason: string
  minutes: number
  notes: string | null
  createdAt: string
}

export async function logDowntime(
  payload: { workOrderId: string; reason: string; minutes: number; notes?: string },
  userId?: string
): Promise<{ success: boolean; data?: DowntimeEntryRecord; error?: { code: string; message: string } }> {
  try {
    if (!payload.reason?.trim()) return { success: false, error: { code: 'WO-009', message: 'Downtime reason is required.' } }
    if (!payload.minutes || payload.minutes <= 0) return { success: false, error: { code: 'WO-010', message: 'Downtime minutes must be greater than zero.' } }

    const db = getPrisma()
    const workOrder = await db.workOrder.findUnique({ where: { id: payload.workOrderId } })
    if (!workOrder) return { success: false, error: { code: 'WO-011', message: 'Work order step not found.' } }

    const row = await db.workOrderDowntimeEntry.create({
      data: {
        workOrderId: payload.workOrderId, reason: payload.reason.trim(),
        minutes: payload.minutes, notes: payload.notes?.trim() || null, createdById: userId || null
      }
    })
    await logAction({ userId, action: 'DOWNTIME_LOGGED', entityType: 'WorkOrderDowntimeEntry', entityId: row.id, newValue: { workOrderId: payload.workOrderId, reason: row.reason, minutes: row.minutes } })
    return { success: true, data: toDowntimeRecord(row) }
  } catch (err) {
    return { success: false, error: { code: 'WO-012', message: err instanceof Error ? err.message : 'Failed to log downtime.' } }
  }
}

export async function listDowntimeEntries(workOrderId: string): Promise<{ success: boolean; data?: DowntimeEntryRecord[]; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const rows = await db.workOrderDowntimeEntry.findMany({ where: { workOrderId }, orderBy: { createdAt: 'desc' } })
    return { success: true, data: rows.map(toDowntimeRecord) }
  } catch (err) {
    return { success: false, error: { code: 'WO-013', message: err instanceof Error ? err.message : 'Failed to list downtime entries.' } }
  }
}

export interface DowntimeSummary {
  totalMinutes: number
  byReason: Array<{ reason: string; minutes: number }>
}

export async function getDowntimeSummary(params?: { dateFrom?: string; dateTo?: string }): Promise<{ success: boolean; data?: DowntimeSummary; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const where: { createdAt?: { gte?: Date; lte?: Date } } = {}
    if (params?.dateFrom || params?.dateTo) {
      where.createdAt = {}
      if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom)
      if (params.dateTo) where.createdAt.lte = new Date(new Date(params.dateTo).setHours(23, 59, 59, 999))
    }
    const rows = await db.workOrderDowntimeEntry.findMany({ where, select: { reason: true, minutes: true } })

    const totalMinutes = rows.reduce((s, r) => s + r.minutes, 0)
    const byReasonMap = new Map<string, number>()
    for (const r of rows) byReasonMap.set(r.reason, (byReasonMap.get(r.reason) ?? 0) + r.minutes)
    const byReason = Array.from(byReasonMap.entries())
      .map(([reason, minutes]) => ({ reason, minutes }))
      .sort((a, b) => b.minutes - a.minutes)

    return { success: true, data: { totalMinutes, byReason } }
  } catch (err) {
    return { success: false, error: { code: 'WO-014', message: err instanceof Error ? err.message : 'Failed to compute downtime summary.' } }
  }
}

function toDowntimeRecord(r: { id: string; workOrderId: string; reason: string; minutes: number; notes: string | null; createdAt: Date }): DowntimeEntryRecord {
  return { id: r.id, workOrderId: r.workOrderId, reason: r.reason, minutes: r.minutes, notes: r.notes, createdAt: r.createdAt.toISOString() }
}

// Phase 67 §9.1 — Manufacturing item 5: work-order lead-time bottleneck flag.
// Needs no new capture at all — a stage's own duration is the gap between
// its own completedAt and the PREVIOUS step's completedAt (or the
// production order's own startDate for step 1), since steps already run in
// strict stepNumber sequence and every completed step already has a real
// completedAt timestamp. Surfaces whichever stage (by taskName, averaged
// across every completed order in scope) is actually eating the most real
// elapsed time — the point of a bottleneck flag, not a report the shop
// owner has to interpret themselves.
export interface BottleneckStageRow { taskName: string; avgDurationHours: number; sampleCount: number }
export interface BottleneckFlag {
  bottleneckStage: string | null
  avgDurationHours: number
  shareOfTotalLeadTimePercent: number
  stages: BottleneckStageRow[]
}

export async function getWorkOrderBottleneckFlag(
  params?: { productId?: string; dateFrom?: string; dateTo?: string }
): Promise<{ success: boolean; data?: BottleneckFlag; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const where: { status: string; productId?: string; completedDate?: { gte?: Date; lte?: Date } } = { status: 'COMPLETED' }
    if (params?.productId) where.productId = params.productId
    if (params?.dateFrom || params?.dateTo) {
      where.completedDate = {}
      if (params.dateFrom) where.completedDate.gte = new Date(params.dateFrom)
      if (params.dateTo) where.completedDate.lte = new Date(new Date(params.dateTo).setHours(23, 59, 59, 999))
    }

    const orders = await db.productionOrder.findMany({
      where,
      select: {
        startDate: true,
        workOrders: { where: { status: 'DONE', completedAt: { not: null } }, orderBy: { stepNumber: 'asc' }, select: { taskName: true, completedAt: true } }
      }
    })

    const byStage = new Map<string, { totalHours: number; count: number }>()
    for (const order of orders) {
      let prevTime = order.startDate?.getTime() ?? null
      for (const wo of order.workOrders) {
        const completedTime = wo.completedAt!.getTime()
        if (prevTime != null && completedTime > prevTime) {
          const hours = (completedTime - prevTime) / 3600000
          const existing = byStage.get(wo.taskName) ?? { totalHours: 0, count: 0 }
          existing.totalHours += hours
          existing.count += 1
          byStage.set(wo.taskName, existing)
        }
        prevTime = completedTime
      }
    }

    const stages: BottleneckStageRow[] = Array.from(byStage.entries())
      .map(([taskName, v]) => ({ taskName, avgDurationHours: Math.round((v.totalHours / v.count) * 10) / 10, sampleCount: v.count }))
      .sort((a, b) => b.avgDurationHours - a.avgDurationHours)

    if (stages.length === 0) {
      return { success: true, data: { bottleneckStage: null, avgDurationHours: 0, shareOfTotalLeadTimePercent: 0, stages: [] } }
    }

    const totalAvgHours = stages.reduce((s, r) => s + r.avgDurationHours, 0)
    const top = stages[0]
    return {
      success: true,
      data: {
        bottleneckStage: top.taskName,
        avgDurationHours: top.avgDurationHours,
        shareOfTotalLeadTimePercent: totalAvgHours > 0 ? Math.round((top.avgDurationHours / totalAvgHours) * 1000) / 10 : 0,
        stages
      }
    }
  } catch (err) {
    return { success: false, error: { code: 'WO-015', message: err instanceof Error ? err.message : 'Failed to compute the bottleneck stage.' } }
  }
}

function toRecord(w: { id: string; productionOrderId: string; stepNumber: number; taskName: string; status: string; isQcStep: boolean; qcResult: string | null; qcNotes: string | null; qtyInspected: number | null; qtyRejected: number | null; notes: string | null; completedAt: Date | null; createdAt: Date }): WorkOrderRecord {
  return {
    id: w.id,
    productionOrderId: w.productionOrderId,
    stepNumber: w.stepNumber,
    taskName: w.taskName,
    status: w.status as WorkOrderRecord['status'],
    isQcStep: w.isQcStep,
    qcResult: w.qcResult as WorkOrderRecord['qcResult'],
    qcNotes: w.qcNotes,
    qtyInspected: w.qtyInspected,
    qtyRejected: w.qtyRejected,
    notes: w.notes,
    completedAt: w.completedAt?.toISOString() ?? null,
    createdAt: w.createdAt.toISOString()
  }
}
