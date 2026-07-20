import { getPrisma } from '../database/db'
import { serializeTimeEntry } from './time-entry.service'
import { buildWhatsAppLink } from './notification-queue.service'

// LegalCase.feeAgreed/feeCollected are Prisma Decimal fields — Electron's
// IPC (structured clone) cannot serialize a Decimal instance and throws
// "An object could not be cloned" on every response that includes one.
// Applied to every function below that returns a case.
function serializeCase<T extends { feeAgreed: unknown; feeCollected: unknown }>(c: T): T {
  return { ...c, feeAgreed: c.feeAgreed == null ? null : Number(c.feeAgreed), feeCollected: Number(c.feeCollected) }
}

export async function listLegalCases(filters?: {
  status?: string
  clientId?: string
  advocateId?: string
  search?: string
}) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.status) where.status = filters.status
    if (filters?.clientId) where.clientId = filters.clientId
    if (filters?.advocateId) where.advocateId = filters.advocateId
    if (filters?.search) {
      where.OR = [
        { caseNumber: { contains: filters.search } },
        { caseTitle: { contains: filters.search } },
        { courtName: { contains: filters.search } },
      ]
    }

    const cases = await db.legalCase.findMany({
      where,
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
        advocate: { select: { id: true, fullName: true } },
        _count: { select: { hearings: true, timeEntries: true } },
      },
      orderBy: [{ status: 'asc' }, { nextHearingDate: 'asc' }, { createdAt: 'desc' }],
    })
    return { success: true, data: cases.map(serializeCase) }
  } catch (err) {
    return { success: false, error: { code: 'LC28-001', message: err instanceof Error ? err.message : 'Could not list cases.' } }
  }
}

export async function getLegalCase(id: string) {
  try {
    const db = getPrisma()
    const legalCase = await db.legalCase.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, customerName: true, phone: true, email: true } },
        advocate: { select: { id: true, fullName: true } },
        hearings: { orderBy: { hearingDate: 'desc' } },
        timeEntries: {
          include: { employee: { select: { id: true, fullName: true } } },
          orderBy: { date: 'desc' },
        },
      },
    })
    if (!legalCase) return { success: false, error: { code: 'LC28-NOT-FOUND', message: 'Case not found.' } }
    return {
      success: true,
      data: serializeCase({ ...legalCase, timeEntries: legalCase.timeEntries.map(serializeTimeEntry) }),
    }
  } catch (err) {
    return { success: false, error: { code: 'LC28-002', message: err instanceof Error ? err.message : 'Could not get case.' } }
  }
}

export async function createLegalCase(payload: {
  caseNumber: string
  caseTitle: string
  caseType?: string
  courtName: string
  courtDistrict?: string
  courtState?: string
  eCourtId?: string
  clientId: string
  advocateId?: string
  filingDate?: string
  opposingPartyName?: string
  limitationDate?: string
  feeAgreed?: number
  notes?: string
}) {
  try {
    const db = getPrisma()
    const legalCase = await db.legalCase.create({
      data: {
        caseNumber: payload.caseNumber.trim(),
        caseTitle: payload.caseTitle.trim(),
        caseType: payload.caseType ?? 'CIVIL',
        courtName: payload.courtName.trim(),
        courtDistrict: payload.courtDistrict ?? null,
        courtState: payload.courtState ?? null,
        eCourtId: payload.eCourtId ?? null,
        clientId: payload.clientId,
        advocateId: payload.advocateId ?? null,
        filingDate: payload.filingDate ? new Date(payload.filingDate) : null,
        opposingPartyName: payload.opposingPartyName?.trim() || null,
        limitationDate: payload.limitationDate ? new Date(payload.limitationDate) : null,
        feeAgreed: payload.feeAgreed ?? null,
        feeCollected: 0,
        status: 'ACTIVE',
        notes: payload.notes ?? null,
      },
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
        advocate: { select: { id: true, fullName: true } },
      },
    })

    if (payload.limitationDate) {
      await scheduleLimitationReminder(legalCase.id, new Date(payload.limitationDate))
    }

    await db.auditLog.create({
      data: { action: 'CREATE', entityType: 'LegalCase', entityId: legalCase.id, newValue: JSON.stringify({ caseNumber: payload.caseNumber, caseTitle: payload.caseTitle }) },
    }).catch(() => {})
    return { success: true, data: serializeCase(legalCase) }
  } catch (err) {
    return { success: false, error: { code: 'LC28-003', message: err instanceof Error ? err.message : 'Could not create case.' } }
  }
}

export async function updateLegalCase(payload: {
  id: string
  caseNumber?: string
  caseTitle?: string
  caseType?: string
  courtName?: string
  courtDistrict?: string | null
  courtState?: string | null
  eCourtId?: string | null
  advocateId?: string | null
  status?: string
  filingDate?: string | null
  nextHearingDate?: string | null
  opposingPartyName?: string | null
  limitationDate?: string | null
  feeAgreed?: number | null
  feeCollected?: number
  notes?: string | null
}) {
  try {
    const db = getPrisma()
    const { id, filingDate, nextHearingDate, limitationDate, ...rest } = payload

    // Fetch the pre-update limitationDate so a change can cancel the
    // reminder tied to the old date and schedule a fresh one for the new
    // date — same reschedule-on-change discipline as hearing.service.ts's
    // rescheduleHearingReminder.
    const before = limitationDate !== undefined
      ? await db.legalCase.findUnique({ where: { id }, select: { limitationDate: true } })
      : null

    const legalCase = await db.legalCase.update({
      where: { id },
      data: {
        ...rest,
        ...(filingDate !== undefined ? { filingDate: filingDate ? new Date(filingDate) : null } : {}),
        ...(nextHearingDate !== undefined ? { nextHearingDate: nextHearingDate ? new Date(nextHearingDate) : null } : {}),
        ...(limitationDate !== undefined ? { limitationDate: limitationDate ? new Date(limitationDate) : null } : {}),
      },
    })

    if (limitationDate !== undefined) {
      const oldDate = before?.limitationDate ?? null
      const newDate = legalCase.limitationDate
      const changed = (oldDate?.getTime() ?? null) !== (newDate?.getTime() ?? null)
      if (changed) {
        if (oldDate) await cancelLimitationReminder(legalCase.id, oldDate)
        if (newDate) await scheduleLimitationReminder(legalCase.id, newDate)
      }
    }

    const auditAction = payload.status === 'CLOSED' ? 'CLOSED' : 'UPDATE'
    await db.auditLog.create({
      data: { action: auditAction, entityType: 'LegalCase', entityId: id },
    }).catch(() => {})
    return { success: true, data: serializeCase(legalCase) }
  } catch (err) {
    return { success: false, error: { code: 'LC28-004', message: err instanceof Error ? err.message : 'Could not update case.' } }
  }
}

// Basic conflict-of-interest check (advisory, not blocking — a real conflict
// call requires professional judgment the software shouldn't force, unlike
// an objective safety fact such as Blood Bank's compatibility check). Checks
// both directions: (1) the proposed opposing party is already a client
// elsewhere, and (2) the proposed client was previously recorded as an
// opposing party elsewhere — the two classic basic-COI signals for a small
// firm without a full conflicts database.
export async function checkConflictOfInterest(payload: {
  clientId?: string
  opposingPartyName?: string
  excludeCaseId?: string
}) {
  try {
    const db = getPrisma()
    const conflicts: Array<{ caseId: string; caseNumber: string; caseTitle: string; reason: string }> = []

    const opposingName = payload.opposingPartyName?.trim()
    if (opposingName) {
      const matches = await db.legalCase.findMany({
        where: {
          id: payload.excludeCaseId ? { not: payload.excludeCaseId } : undefined,
          client: { customerName: { contains: opposingName } },
        },
        select: { id: true, caseNumber: true, caseTitle: true, client: { select: { customerName: true } } },
      })
      for (const m of matches) {
        conflicts.push({
          caseId: m.id, caseNumber: m.caseNumber, caseTitle: m.caseTitle,
          reason: `"${opposingName}" matches an existing client (${m.client.customerName}) on case ${m.caseNumber} — this firm may already represent the proposed opposing party.`,
        })
      }
    }

    if (payload.clientId) {
      const client = await db.customer.findUnique({ where: { id: payload.clientId }, select: { customerName: true } })
      if (client) {
        const matches = await db.legalCase.findMany({
          where: {
            id: payload.excludeCaseId ? { not: payload.excludeCaseId } : undefined,
            opposingPartyName: { contains: client.customerName },
          },
          select: { id: true, caseNumber: true, caseTitle: true, opposingPartyName: true },
        })
        for (const m of matches) {
          conflicts.push({
            caseId: m.id, caseNumber: m.caseNumber, caseTitle: m.caseTitle,
            reason: `${client.customerName} was recorded as the OPPOSING PARTY on case ${m.caseNumber} — representing them now may be a conflict.`,
          })
        }
      }
    }

    return { success: true, data: { conflicts } }
  } catch (err) {
    return { success: false, error: { code: 'LC28-006', message: err instanceof Error ? err.message : 'Could not check conflicts.' } }
  }
}

// ── Limitation-date (statute-of-limitations / filing-deadline) reminders ──
// Reuses the exact same notificationQueue/buildWhatsAppLink mechanism
// hearing.service.ts's scheduleHearingReminder already uses — no new
// reminder mechanism invented. Longer lead times than a hearing reminder
// (30d/7d vs 7d/2d) since a limitation deadline typically needs time to
// gather documents/instructions, not just show up in court.

async function cancelLimitationReminder(caseId: string, oldLimitationDate: Date) {
  try {
    const db = getPrisma()
    const legalCase = await db.legalCase.findUnique({ where: { id: caseId }, select: { clientId: true } })
    if (!legalCase) return
    const old30 = new Date(oldLimitationDate); old30.setDate(old30.getDate() - 30)
    const old7 = new Date(oldLimitationDate); old7.setDate(old7.getDate() - 7)
    await db.notificationQueue.deleteMany({
      where: {
        customerId: legalCase.clientId,
        notificationType: { in: ['LIMITATION_DUE_30D', 'LIMITATION_DUE_7D'] },
        status: 'PENDING',
        scheduledFor: { in: [old30, old7] },
      },
    })
  } catch {
    // Non-critical — worst case a stale reminder from the old date remains
  }
}

async function scheduleLimitationReminder(caseId: string, limitationDate: Date) {
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

    const thirtyDaysBefore = new Date(limitationDate)
    thirtyDaysBefore.setDate(thirtyDaysBefore.getDate() - 30)
    const sevenDaysBefore = new Date(limitationDate)
    sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7)
    const now = new Date()
    if (thirtyDaysBefore <= now && sevenDaysBefore <= now) return

    const firmName = profile?.businessName ?? 'Your Advocate'
    const dateStr = limitationDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const phone = legalCase.client.phone ?? ''

    if (thirtyDaysBefore > now) {
      const body30 = `Dear ${legalCase.client.customerName}, an important deadline for case ${legalCase.caseNumber} (${legalCase.caseTitle}) falls on ${dateStr}. Please ensure all instructions/documents reach us in time. – ${firmName} | Powered by Sarang | www.aszurex.com`
      const link30 = phone ? await buildWhatsAppLink(phone, body30) : null
      await db.notificationQueue.create({
        data: {
          customerId: legalCase.client.id,
          customerName: legalCase.client.customerName,
          customerPhone: phone,
          notificationType: 'LIMITATION_DUE_30D',
          templateBody: body30,
          whatsappLink: link30,
          scheduledFor: thirtyDaysBefore,
        },
      })
    }
    if (sevenDaysBefore > now) {
      const body7 = `Dear ${legalCase.client.customerName}, URGENT: the deadline for case ${legalCase.caseNumber} (${legalCase.caseTitle}) is ${dateStr} — only a few days away. – ${firmName} | Powered by Sarang | www.aszurex.com`
      const link7 = phone ? await buildWhatsAppLink(phone, body7) : null
      await db.notificationQueue.create({
        data: {
          customerId: legalCase.client.id,
          customerName: legalCase.client.customerName,
          customerPhone: phone,
          notificationType: 'LIMITATION_DUE_7D',
          templateBody: body7,
          whatsappLink: link7,
          scheduledFor: sevenDaysBefore,
        },
      })
    }
  } catch {
    // Non-critical — silently ignore reminder scheduling failures
  }
}

export async function deleteLegalCase(id: string) {
  try {
    const db = getPrisma()
    await db.legalCase.delete({ where: { id } })
    await db.auditLog.create({
      data: { action: 'DELETE', entityType: 'LegalCase', entityId: id },
    }).catch(() => {})
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'LC28-005', message: err instanceof Error ? err.message : 'Could not delete case.' } }
  }
}
