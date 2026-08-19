import { getPrisma } from '../database/db'
import { buildWhatsAppLink } from './notification-queue.service'
import { parseLocalDateStart, parseLocalDateEnd } from '../utils/date.util'

export async function getPatientRecall(patientId: string) {
  try {
    const db = getPrisma()
    const record = await db.recallRecord.findUnique({
      where: { patientId },
      include: { patient: { select: { id: true, customerName: true, phone: true } } },
    })
    return { success: true, data: record }
  } catch (err) {
    return { success: false, error: { code: 'RC-001', message: err instanceof Error ? err.message : 'Could not fetch recall record.' } }
  }
}

export async function upsertRecall(payload: {
  patientId: string
  recallType: string
  lastVisitDate: string
  nextRecallDate: string
  notes?: string | null
}) {
  try {
    const db = getPrisma()
    const lastVisit = new Date(payload.lastVisitDate)
    const nextRecall = new Date(payload.nextRecallDate)
    const now = new Date()

    // Clear old pending recall notifications for this patient so we don't double-fire
    await db.notificationQueue.deleteMany({
      where: {
        customerId: payload.patientId,
        notificationType: { in: ['RECALL_DUE_30D', 'RECALL_DUE_7D'] },
        status: 'PENDING',
      },
    })

    // Phase 67 §9.1 item 21.4 — Recall Compliance report. If a record already
    // exists for this patient, this upsert is closing out that recall period
    // — snapshot whether it was met on time (new lastVisitDate vs. the
    // nextRecallDate about to be overwritten) BEFORE overwriting it, same
    // pattern as upsertChronicCondition's own ChronicRecallComplianceLog
    // capture. A patient's first-ever recall has no prior due date to
    // compare against, so no log is written for the create path. Wrapped in
    // a transaction so the read-then-log-then-overwrite can't race a
    // concurrent upsert for the same patient.
    const record = await db.$transaction(async (tx) => {
      const existing = await tx.recallRecord.findUnique({ where: { patientId: payload.patientId } })
      if (existing) {
        await tx.recallComplianceLog.create({
          data: {
            recordId: existing.id,
            scheduledDate: existing.nextRecallDate,
            actualDate: lastVisit,
            onTime: lastVisit.getTime() <= existing.nextRecallDate.getTime(),
          },
        })
      }

      return tx.recallRecord.upsert({
        where: { patientId: payload.patientId },
        create: {
          patientId: payload.patientId,
          recallType: payload.recallType,
          lastVisitDate: lastVisit,
          nextRecallDate: nextRecall,
          notes: payload.notes ?? null,
        },
        update: {
          recallType: payload.recallType,
          lastVisitDate: lastVisit,
          nextRecallDate: nextRecall,
          notes: payload.notes ?? null,
          reminderSent: false,
          reminderSentDate: null,
        },
      })
    })

    const patient = await db.customer.findUnique({
      where: { id: payload.patientId },
      select: { customerName: true, phone: true },
    })
    const patientName = patient?.customerName ?? 'Patient'
    const patientPhone = patient?.phone ?? null
    const recallDateStr = nextRecall.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

    const reminder30 = new Date(nextRecall)
    reminder30.setDate(reminder30.getDate() - 30)
    if (reminder30 > now) {
      const body30 = `Hi ${patientName}, your dental recall is due on ${recallDateStr}. Please book your appointment soon. Powered by Sarang | www.aszurex.com`
      const link30 = patientPhone ? await buildWhatsAppLink(patientPhone, body30) : null
      await db.notificationQueue.create({
        data: {
          customerId: payload.patientId,
          customerName: patientName,
          customerPhone: patientPhone,
          notificationType: 'RECALL_DUE_30D',
          templateBody: body30,
          whatsappLink: link30,
          scheduledFor: reminder30,
        },
      })
    }

    const reminder7 = new Date(nextRecall)
    reminder7.setDate(reminder7.getDate() - 7)
    if (reminder7 > now) {
      const body7 = `Hi ${patientName}, your dental recall appointment is due in 7 days on ${recallDateStr}. Please call us to schedule. Powered by Sarang | www.aszurex.com`
      const link7 = patientPhone ? await buildWhatsAppLink(patientPhone, body7) : null
      await db.notificationQueue.create({
        data: {
          customerId: payload.patientId,
          customerName: patientName,
          customerPhone: patientPhone,
          notificationType: 'RECALL_DUE_7D',
          templateBody: body7,
          whatsappLink: link7,
          scheduledFor: reminder7,
        },
      })
    }

    await db.auditLog.create({
      data: {
        action: 'UPSERT',
        entityType: 'RecallRecord',
        entityId: record.id,
        newValue: JSON.stringify({ nextRecallDate: payload.nextRecallDate }),
      },
    }).catch(() => {})

    return { success: true, data: record }
  } catch (err) {
    return { success: false, error: { code: 'RC-002', message: err instanceof Error ? err.message : 'Could not save recall record.' } }
  }
}

// Phase 67 §9.1 item 21.4 — Dental Clinic Recall Compliance report. Reads
// RecallComplianceLog, not the live RecallRecord table, since only the log
// has a true history of past recall periods (RecallRecord itself is
// overwritten in place on every upsert). Mirrors
// generateChronicRecallComplianceReport's own shape exactly (GP Clinic,
// chronic-condition-record.service.ts) — broken down by recallType instead
// of conditionName.
export async function generateDentalRecallComplianceReport(params: { dateFrom: string; dateTo: string }) {
  try {
    const db = getPrisma()
    const since = new Date(params.dateFrom)
    const until = new Date(`${params.dateTo}T23:59:59.999`)

    const logs = await db.recallComplianceLog.findMany({
      where: { scheduledDate: { gte: since, lte: until } },
      include: { record: { select: { recallType: true } } },
      orderBy: { scheduledDate: 'asc' },
    })

    const overallOnTime = logs.filter((l) => l.onTime).length
    const overallPercent = logs.length > 0 ? Math.round((overallOnTime / logs.length) * 100) : null

    const byTypeMap = new Map<string, { total: number; onTime: number }>()
    for (const log of logs) {
      const key = log.record.recallType
      const entry = byTypeMap.get(key) ?? { total: 0, onTime: 0 }
      entry.total += 1
      if (log.onTime) entry.onTime += 1
      byTypeMap.set(key, entry)
    }
    const byRecallType = Array.from(byTypeMap.entries()).map(([recallType, v]) => ({
      recallType,
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
        byRecallType,
      },
    }
  } catch (err) {
    return { success: false, error: { code: 'RC-004', message: err instanceof Error ? err.message : 'Could not generate compliance report.' } }
  }
}

export async function listRecalls(filters?: {
  overdueOnly?: boolean
  dateFrom?: string
  dateTo?: string
}) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}

    if (filters?.overdueOnly) {
      where.nextRecallDate = { lte: new Date() }
    } else if (filters?.dateFrom || filters?.dateTo) {
      // BUG FOUND 2026-07-22: both bounds used to be new Date(dateString),
      // parsed as UTC midnight instead of local midnight; dateTo also
      // lacked an end-of-day adjustment.
      // Real bug found 2026-07-23: the dateTo fix above still parsed the
      // string as UTC midnight FIRST before setHours() locked in
      // end-of-day — setHours() only rewrites H/M/S/ms, never the
      // Year/Month/Date a UTC parse already got wrong in any negative-UTC-
      // offset timezone. parseLocalDateEnd constructs local end-of-day
      // directly from the string's Y/M/D instead.
      where.nextRecallDate = {
        ...(filters.dateFrom ? { gte: parseLocalDateStart(filters.dateFrom) } : {}),
        ...(filters.dateTo ? { lte: parseLocalDateEnd(filters.dateTo) } : {}),
      }
    }

    const records = await db.recallRecord.findMany({
      where,
      include: { patient: { select: { id: true, customerName: true, phone: true } } },
      orderBy: { nextRecallDate: 'asc' },
    })
    return { success: true, data: records }
  } catch (err) {
    return { success: false, error: { code: 'RC-003', message: err instanceof Error ? err.message : 'Could not list recalls.' } }
  }
}
