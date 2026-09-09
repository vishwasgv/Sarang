import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { parseLocalDateStart, toLocalDateOnlyIso } from '../utils/date.util'

// diagnosedDate/lastVisitDate/nextRecallDate are pure calendar-date fields but
// were returned as raw Prisma Date instances across IPC (structured clone
// preserves a Date without throwing) -- ChronicRecallListScreen.tsx's openEdit
// calls `r.diagnosedDate.slice(0, 10)` assuming an ISO string, crashing on
// every edit of a record with a diagnosedDate set. Same bug class already
// fixed in engagement/retainer/legal-case/visit-note/driving services.
function serializeRecord<T extends { diagnosedDate: Date | null; lastVisitDate: Date; nextRecallDate: Date }>(r: T): T {
  return {
    ...r,
    diagnosedDate: (r.diagnosedDate ? toLocalDateOnlyIso(r.diagnosedDate) : null) as unknown as Date,
    lastVisitDate: toLocalDateOnlyIso(r.lastVisitDate) as unknown as Date,
    nextRecallDate: toLocalDateOnlyIso(r.nextRecallDate) as unknown as Date,
  }
}

export async function listChronicConditions(filters?: {
  patientId?: string
  activeOnly?: boolean
  overdueOnly?: boolean
}) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.patientId) where.patientId = filters.patientId
    if (filters?.activeOnly !== false) where.isActive = true
    if (filters?.overdueOnly) where.nextRecallDate = { lte: new Date() }

    const records = await db.chronicConditionRecord.findMany({
      where,
      include: { patient: { select: { id: true, customerName: true, phone: true } } },
      orderBy: { nextRecallDate: 'asc' },
    })
    return { success: true, data: records.map(serializeRecord) }
  } catch (err) {
    return { success: false, error: { code: 'CCR-001', message: err instanceof Error ? err.message : 'Could not list chronic condition records.' } }
  }
}

export async function upsertChronicCondition(payload: {
  id?: string
  patientId: string
  conditionName: string
  diagnosedDate?: string | null
  lastVisitDate: string
  nextRecallDate: string
  isActive?: boolean
  notes?: string | null
}) {
  try {
    const db = getPrisma()
    const lastVisit = parseLocalDateStart(payload.lastVisitDate)
    const nextRecall = parseLocalDateStart(payload.nextRecallDate)

    const record = await db.$transaction(async (tx) => {
      // If updating an existing record, snapshot the recall period being closed
      // out BEFORE overwriting nextRecallDate — this is the only point at which
      // "was the last recall met on time" can be captured, since the record
      // itself is overwritten in place (mirrors RecallRecord's own upsert shape).
      if (payload.id) {
        const existing = await tx.chronicConditionRecord.findUnique({ where: { id: payload.id } })
        if (existing) {
          await tx.chronicRecallComplianceLog.create({
            data: {
              recordId: existing.id,
              scheduledDate: existing.nextRecallDate,
              actualDate: lastVisit,
              onTime: lastVisit.getTime() <= existing.nextRecallDate.getTime(),
            },
          })
          return tx.chronicConditionRecord.update({
            where: { id: payload.id },
            data: {
              conditionName: payload.conditionName,
              diagnosedDate: payload.diagnosedDate ? parseLocalDateStart(payload.diagnosedDate) : null,
              lastVisitDate: lastVisit,
              nextRecallDate: nextRecall,
              isActive: payload.isActive ?? true,
              notes: payload.notes ?? null,
            },
          })
        }
      }
      return tx.chronicConditionRecord.create({
        data: {
          patientId: payload.patientId,
          conditionName: payload.conditionName,
          diagnosedDate: payload.diagnosedDate ? parseLocalDateStart(payload.diagnosedDate) : null,
          lastVisitDate: lastVisit,
          nextRecallDate: nextRecall,
          isActive: payload.isActive ?? true,
          notes: payload.notes ?? null,
        },
      })
    })

    await logAction({ action: payload.id ? 'UPDATE' : 'CREATE', entityType: 'ChronicConditionRecord', entityId: record.id, newValue: { conditionName: record.conditionName, nextRecallDate: payload.nextRecallDate } }).catch(() => {})

    return { success: true, data: serializeRecord(record) }
  } catch (err) {
    return { success: false, error: { code: 'CCR-002', message: err instanceof Error ? err.message : 'Could not save chronic condition record.' } }
  }
}

export async function deactivateChronicCondition(id: string) {
  try {
    const db = getPrisma()
    const record = await db.chronicConditionRecord.update({ where: { id }, data: { isActive: false } })
    return { success: true, data: record }
  } catch (err) {
    return { success: false, error: { code: 'CCR-003', message: err instanceof Error ? err.message : 'Could not deactivate chronic condition record.' } }
  }
}

export async function getChronicRecallDashboardCounts() {
  try {
    const db = getPrisma()
    const now = new Date()
    const weekLater = new Date(now); weekLater.setDate(weekLater.getDate() + 7)

    const [overdueCount, dueThisWeek, complianceLogs] = await Promise.all([
      db.chronicConditionRecord.count({ where: { isActive: true, nextRecallDate: { lt: now } } }),
      db.chronicConditionRecord.count({ where: { isActive: true, nextRecallDate: { gte: now, lte: weekLater } } }),
      db.chronicRecallComplianceLog.findMany({
        where: { scheduledDate: { gte: new Date(now.getFullYear(), now.getMonth() - 12, now.getDate()) } },
        select: { onTime: true },
      }),
    ])

    const compliancePercent = complianceLogs.length > 0
      ? Math.round((complianceLogs.filter((l) => l.onTime).length / complianceLogs.length) * 100)
      : null

    return { success: true, data: { overdueCount, dueThisWeek, compliancePercent } }
  } catch (err) {
    return { success: false, error: { code: 'CCR-004', message: err instanceof Error ? err.message : 'Could not compute chronic recall counts.' } }
  }
}

// Trailing 12-month compliance report, optionally broken down by condition —
// GP Clinic Section 9.1 item 2 ("Recall compliance report: gauge, % followed
// up on time"). Reads ChronicRecallComplianceLog, not the live record table,
// since only the log has a true history of past recall periods.
export async function generateChronicRecallComplianceReport(params?: { months?: number; dateFrom?: string; dateTo?: string }) {
  try {
    const db = getPrisma()
    let since: Date
    let until: Date | undefined
    if (params?.dateFrom) {
      // Explicit range — the Reports screen's own date-range picker, matching
      // every other report's `{dateFrom, dateTo}` convention.
      since = parseLocalDateStart(params.dateFrom)
      until = params.dateTo ? new Date(`${params.dateTo}T23:59:59.999`) : undefined
    } else {
      // No explicit range — trailing N months, the GP Clinic list screen's own
      // quick-glance header figure.
      const months = params?.months ?? 12
      since = new Date()
      since.setMonth(since.getMonth() - months)
    }

    const logs = await db.chronicRecallComplianceLog.findMany({
      where: { scheduledDate: { gte: since, ...(until ? { lte: until } : {}) } },
      include: { record: { select: { conditionName: true } } },
      orderBy: { scheduledDate: 'asc' },
    })

    const overallOnTime = logs.filter((l) => l.onTime).length
    const overallPercent = logs.length > 0 ? Math.round((overallOnTime / logs.length) * 100) : null

    const byConditionMap = new Map<string, { total: number; onTime: number }>()
    for (const log of logs) {
      const key = log.record.conditionName
      const entry = byConditionMap.get(key) ?? { total: 0, onTime: 0 }
      entry.total += 1
      if (log.onTime) entry.onTime += 1
      byConditionMap.set(key, entry)
    }
    const byCondition = Array.from(byConditionMap.entries()).map(([conditionName, v]) => ({
      conditionName,
      total: v.total,
      onTime: v.onTime,
      percent: Math.round((v.onTime / v.total) * 100),
    }))

    return {
      success: true,
      data: {
        totalRecallsClosed: logs.length,
        overallOnTime,
        overallPercent,
        byCondition,
      },
    }
  } catch (err) {
    return { success: false, error: { code: 'CCR-005', message: err instanceof Error ? err.message : 'Could not generate compliance report.' } }
  }
}
