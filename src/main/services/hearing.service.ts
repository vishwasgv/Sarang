import { getPrisma } from '../database/db'
import { buildWhatsAppLink } from './notification-queue.service'
import { parseLocalDateStart, parseLocalDateEnd } from '../utils/date.util'

export async function listHearings(filters?: {
  caseId?: string
  status?: string
  fromDate?: string
  toDate?: string
}) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.caseId) where.caseId = filters.caseId
    if (filters?.status) where.status = filters.status
    if (filters?.fromDate || filters?.toDate) {
      // BUG FOUND 2026-07-22: both bounds used to be new Date(dateString),
      // parsed as UTC midnight instead of local midnight; toDate also
      // lacked an end-of-day adjustment.
      // Real bug found 2026-07-23: the toDate fix above still parsed the
      // string as UTC midnight FIRST before setHours() locked in
      // end-of-day — setHours() only rewrites H/M/S/ms, never the
      // Year/Month/Date a UTC parse already got wrong in any negative-UTC-
      // offset timezone. parseLocalDateEnd constructs local end-of-day
      // directly from the string's Y/M/D instead.
      where.hearingDate = {
        ...(filters?.fromDate ? { gte: parseLocalDateStart(filters.fromDate) } : {}),
        ...(filters?.toDate ? { lte: parseLocalDateEnd(filters.toDate) } : {}),
      }
    }

    const hearings = await db.hearing.findMany({
      where,
      include: {
        case: {
          select: {
            id: true,
            caseNumber: true,
            caseTitle: true,
            caseType: true,
            courtName: true,
            client: { select: { id: true, customerName: true } },
          },
        },
      },
      orderBy: [{ hearingDate: 'asc' }, { createdAt: 'asc' }],
    })
    return { success: true, data: hearings }
  } catch (err) {
    return { success: false, error: { code: 'H28-001', message: err instanceof Error ? err.message : 'Could not list hearings.' } }
  }
}

export async function createHearing(payload: {
  caseId: string
  hearingDate: string
  hearingTime?: string
  courtRoom?: string
  purpose?: string
  notes?: string
}) {
  try {
    const db = getPrisma()
    const hearingDate = new Date(payload.hearingDate)

    const hearing = await db.hearing.create({
      data: {
        caseId: payload.caseId,
        hearingDate,
        hearingTime: payload.hearingTime ?? null,
        courtRoom: payload.courtRoom ?? null,
        purpose: payload.purpose ?? null,
        status: 'SCHEDULED',
        notes: payload.notes ?? null,
      },
    })

    // Update case.nextHearingDate if this hearing is the earliest upcoming
    await syncNextHearingDate(payload.caseId)

    // Schedule a reminder 2 days before
    await scheduleHearingReminder(payload.caseId, hearingDate)

    await db.auditLog.create({
      data: { action: 'CREATE', entityType: 'Hearing', entityId: hearing.id, newValue: JSON.stringify({ caseId: payload.caseId, hearingDate: payload.hearingDate }) },
    }).catch(() => {})

    return { success: true, data: hearing }
  } catch (err) {
    return { success: false, error: { code: 'H28-002', message: err instanceof Error ? err.message : 'Could not create hearing.' } }
  }
}

export async function updateHearing(payload: {
  id: string
  hearingDate?: string
  hearingTime?: string | null
  courtRoom?: string | null
  purpose?: string | null
  status?: string
  outcome?: string | null
  nextDate?: string | null
  notes?: string | null
}) {
  try {
    const db = getPrisma()
    const { id, hearingDate, nextDate, ...rest } = payload

    // Fetch the pre-update date so a reschedule (hearingDate changing) can
    // cancel the reminder tied to the old date and schedule a fresh one for
    // the new date instead of silently leaving the old reminder in place.
    const before = hearingDate !== undefined
      ? await db.hearing.findUnique({ where: { id }, select: { hearingDate: true } })
      : null

    const hearing = await db.hearing.update({
      where: { id },
      data: {
        ...rest,
        ...(hearingDate !== undefined ? { hearingDate: new Date(hearingDate) } : {}),
        ...(nextDate !== undefined ? { nextDate: nextDate ? new Date(nextDate) : null } : {}),
      },
    })

    if (before && hearingDate !== undefined && before.hearingDate.getTime() !== hearing.hearingDate.getTime()) {
      await rescheduleHearingReminder(hearing.caseId, before.hearingDate, hearing.hearingDate)
    }

    // Always re-sync from SCHEDULED hearings first (handles the case where another
    // earlier SCHEDULED hearing exists — the fast-path override was wrong there)
    await syncNextHearingDate(hearing.caseId)

    // If adjournment recorded a next date but no SCHEDULED hearing was found by sync,
    // use the adjournment's nextDate so the case doesn't show blank next-hearing
    if (payload.status === 'ADJOURNED' && payload.nextDate) {
      const refreshed = await db.legalCase.findUnique({
        where: { id: hearing.caseId },
        select: { nextHearingDate: true },
      })
      if (!refreshed?.nextHearingDate) {
        await db.legalCase.update({
          where: { id: hearing.caseId },
          data: { nextHearingDate: new Date(payload.nextDate) },
        })
      }
    }

    await db.auditLog.create({
      data: { action: 'UPDATE', entityType: 'Hearing', entityId: id },
    }).catch(() => {})

    return { success: true, data: hearing }
  } catch (err) {
    return { success: false, error: { code: 'H28-003', message: err instanceof Error ? err.message : 'Could not update hearing.' } }
  }
}

export async function deleteHearing(id: string) {
  try {
    const db = getPrisma()
    const hearing = await db.hearing.findUnique({ where: { id }, select: { caseId: true } })
    if (!hearing) return { success: false, error: { code: 'H28-NOT-FOUND', message: 'Hearing not found.' } }
    await db.hearing.delete({ where: { id } })
    await syncNextHearingDate(hearing.caseId)
    await db.auditLog.create({
      data: { action: 'DELETE', entityType: 'Hearing', entityId: id },
    }).catch(() => {})
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'H28-004', message: err instanceof Error ? err.message : 'Could not delete hearing.' } }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function syncNextHearingDate(caseId: string) {
  const db = getPrisma()
  // Use start-of-day UTC because hearing dates are stored as midnight UTC
  // (new Date("YYYY-MM-DD") resolves to midnight UTC, not local midnight)
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const next = await db.hearing.findFirst({
    where: { caseId, status: 'SCHEDULED', hearingDate: { gte: todayStart } },
    orderBy: { hearingDate: 'asc' },
    select: { hearingDate: true },
  })
  await db.legalCase.update({
    where: { id: caseId },
    data: { nextHearingDate: next?.hearingDate ?? null },
  })
}

// Rescheduling a hearing (its hearingDate changing) previously left the
// reminder created at hearing-creation time tied to the old date — it would
// fire at the wrong moment, or never fire at all if the new date now has
// enough lead time but wasn't scheduled originally. Cancels the pending
// reminder computed from the old date, then schedules a fresh one for the
// new date, reusing the same customerId+notificationType+status dedup
// pattern established in recall-record.service.ts.
async function rescheduleHearingReminder(caseId: string, oldHearingDate: Date, newHearingDate: Date) {
  try {
    const db = getPrisma()
    const legalCase = await db.legalCase.findUnique({ where: { id: caseId }, select: { clientId: true } })
    if (legalCase) {
      const oldTwoDaysBefore = new Date(oldHearingDate)
      oldTwoDaysBefore.setDate(oldTwoDaysBefore.getDate() - 2)
      const oldSevenDaysBefore = new Date(oldHearingDate)
      oldSevenDaysBefore.setDate(oldSevenDaysBefore.getDate() - 7)
      await db.notificationQueue.deleteMany({
        where: {
          customerId: legalCase.clientId,
          notificationType: { in: ['HEARING_DUE_2D', 'HEARING_DUE_7D'] },
          status: 'PENDING',
          scheduledFor: { in: [oldTwoDaysBefore, oldSevenDaysBefore] },
        },
      })
    }
  } catch {
    // Non-critical — worst case the stale reminder from the old date remains
  }
  await scheduleHearingReminder(caseId, newHearingDate)
}

async function scheduleHearingReminder(caseId: string, hearingDate: Date) {
  try {
    const db = getPrisma()
    const [legalCase, profile] = await Promise.all([
      db.legalCase.findUnique({
        where: { id: caseId },
        include: { client: { select: { id: true, customerName: true, phone: true } } },
      }),
      db.businessProfile.findFirst({ select: { businessName: true } }),
    ])
    if (!legalCase) return

    const twoDaysBefore = new Date(hearingDate)
    twoDaysBefore.setDate(twoDaysBefore.getDate() - 2)
    const sevenDaysBefore = new Date(hearingDate)
    sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7)
    const now = new Date()
    if (twoDaysBefore <= now) return

    const firmName = profile?.businessName ?? 'Your Advocate'
    const dateStr = hearingDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const phone = legalCase.client.phone ?? ''
    const body2d = `Dear ${legalCase.client.customerName}, your case ${legalCase.caseNumber} (${legalCase.caseTitle}) has a hearing on ${dateStr} at ${legalCase.courtName}. Please be present. – ${firmName} | Powered by Sarang | www.aszurex.com`
    const link2d = phone ? await buildWhatsAppLink(phone, body2d) : null
    await db.notificationQueue.create({
      data: {
        customerId: legalCase.client.id,
        customerName: legalCase.client.customerName,
        customerPhone: phone,
        notificationType: 'HEARING_DUE_2D',
        templateBody: body2d,
        whatsappLink: link2d,
        scheduledFor: twoDaysBefore,
      },
    })
    if (sevenDaysBefore > now) {
      const body7d = `Dear ${legalCase.client.customerName}, your case ${legalCase.caseNumber} (${legalCase.caseTitle}) has an upcoming hearing on ${dateStr} at ${legalCase.courtName}. – ${firmName} | Powered by Sarang | www.aszurex.com`
      const link7d = phone ? await buildWhatsAppLink(phone, body7d) : null
      await db.notificationQueue.create({
        data: {
          customerId: legalCase.client.id,
          customerName: legalCase.client.customerName,
          customerPhone: phone,
          notificationType: 'HEARING_DUE_7D',
          templateBody: body7d,
          whatsappLink: link7d,
          scheduledFor: sevenDaysBefore,
        },
      })
    }
  } catch {
    // Non-critical — silently ignore reminder scheduling failures
  }
}
