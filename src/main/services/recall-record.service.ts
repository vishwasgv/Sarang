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

    const record = await db.recallRecord.upsert({
      where: { patientId: payload.patientId },
      create: {
        patientId: payload.patientId,
        recallType: payload.recallType,
        lastVisitDate: new Date(payload.lastVisitDate),
        nextRecallDate: nextRecall,
        notes: payload.notes ?? null,
      },
      update: {
        recallType: payload.recallType,
        lastVisitDate: new Date(payload.lastVisitDate),
        nextRecallDate: nextRecall,
        notes: payload.notes ?? null,
        reminderSent: false,
        reminderSentDate: null,
      },
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
