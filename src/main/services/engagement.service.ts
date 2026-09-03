import { getPrisma } from '../database/db'
import { billingService } from './billing.service'
import { buildReminderWhatsAppLink } from './notification-queue.service'
import { parseLocalDateStart, toLocalDateOnlyIso } from '../utils/date.util'

// Engagement.feeAmount is a Prisma Decimal field — Electron's IPC (structured
// clone) cannot serialize a Decimal instance and throws "An object could not
// be cloned" on every response that includes one. Applied to every function
// below that returns an engagement.
//
// Real bug found live (2026-07-28 service-vertical audit): startDate/endDate
// are DateTime fields, which structured clone DOES preserve across IPC
// without throwing (unlike Decimal) — so this half was never caught by a
// clone error; it shipped as a live renderer crash instead.
// EngagementsScreen.tsx's edit-form populator (openEditForm) calls
// `e.startDate.slice(0, 10)` directly, assuming an ISO string. Same bug
// class as compliance-task.service.ts's serializeTask — see
// date.util.ts's toLocalDateOnlyIso for the shared fix.
function serializeEngagement<T extends { feeAmount: unknown; startDate: Date | null; endDate: Date | null }>(e: T): T {
  return {
    ...e,
    feeAmount: e.feeAmount == null ? null : Number(e.feeAmount),
    startDate: (e.startDate ? toLocalDateOnlyIso(e.startDate) : null) as unknown as Date,
    endDate: (e.endDate ? toLocalDateOnlyIso(e.endDate) : null) as unknown as Date,
  }
}

// Phase 68 §9.1 — CA Firm item 5: engagement renewal reminder. Only a
// FIXED-TERM engagement (a real endDate set) has a renewal to remind about
// — an open-ended RETAINER with no endDate simply keeps auto-invoicing
// monthly via generateEngagementInvoice, nothing to renew. Mirrors
// legal-case.service.ts's limitation-date reminder shape exactly
// (cancel-old-then-schedule-new on any endDate change).
async function cancelEngagementRenewalReminder(engagementId: string, oldEndDate: Date) {
  try {
    const db = getPrisma()
    const engagement = await db.engagement.findUnique({ where: { id: engagementId }, select: { clientId: true } })
    if (!engagement) return
    const old30 = new Date(oldEndDate.getTime() - 30 * 86400000)
    const old7 = new Date(oldEndDate.getTime() - 7 * 86400000)
    await db.notificationQueue.deleteMany({
      where: {
        customerId: engagement.clientId,
        notificationType: { in: ['ENGAGEMENT_RENEWAL_30D', 'ENGAGEMENT_RENEWAL_7D'] },
        status: 'PENDING',
        scheduledFor: { in: [old30, old7] },
      },
    })
  } catch { /* non-critical — worst case a stale reminder from the old date remains */ }
}

async function scheduleEngagementRenewalReminder(engagementId: string, endDate: Date) {
  try {
    const db = getPrisma()
    const engagement = await db.engagement.findUnique({
      where: { id: engagementId },
      include: { client: { select: { id: true, customerName: true, phone: true } } },
    })
    if (!engagement) return

    const thirtyDaysBefore = new Date(endDate.getTime() - 30 * 86400000)
    const sevenDaysBefore = new Date(endDate.getTime() - 7 * 86400000)
    const now = new Date()
    if (thirtyDaysBefore <= now && sevenDaysBefore <= now) return

    const dateStr = endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    const phone = engagement.client.phone ?? ''

    if (thirtyDaysBefore > now) {
      const body30 = `Dear ${engagement.client.customerName}, your engagement "${engagement.title}" is due for renewal on ${dateStr}. Please let us know if you'd like to continue. Powered by Sarang | www.aszurex.com`
      const link30 = phone ? await buildReminderWhatsAppLink(phone, body30) : null
      await db.notificationQueue.create({
        data: { customerId: engagement.client.id, customerName: engagement.client.customerName, customerPhone: phone, notificationType: 'ENGAGEMENT_RENEWAL_30D', templateBody: body30, whatsappLink: link30, scheduledFor: thirtyDaysBefore },
      })
    }
    if (sevenDaysBefore > now) {
      const body7 = `Dear ${engagement.client.customerName}, your engagement "${engagement.title}" ends on ${dateStr} — only a few days away. Please confirm renewal. Powered by Sarang | www.aszurex.com`
      const link7 = phone ? await buildReminderWhatsAppLink(phone, body7) : null
      await db.notificationQueue.create({
        data: { customerId: engagement.client.id, customerName: engagement.client.customerName, customerPhone: phone, notificationType: 'ENGAGEMENT_RENEWAL_7D', templateBody: body7, whatsappLink: link7, scheduledFor: sevenDaysBefore },
      })
    }
  } catch { /* non-critical — silently ignore reminder scheduling failures */ }
}

export async function listEngagements(filters?: {
  clientId?: string
  staffId?: string
  status?: string
  engagementType?: string
}) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.clientId) where.clientId = filters.clientId
    if (filters?.staffId) where.staffId = filters.staffId
    if (filters?.status) where.status = filters.status
    if (filters?.engagementType) where.engagementType = filters.engagementType
    const engagements = await db.engagement.findMany({
      where,
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
        staff:  { select: { id: true, fullName: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    })
    return { success: true, data: engagements.map(serializeEngagement) }
  } catch (err) {
    return { success: false, error: { code: 'EN29-001', message: err instanceof Error ? err.message : 'Could not list engagements.' } }
  }
}

export async function createEngagement(payload: {
  clientId: string
  staffId?: string
  title: string
  engagementType?: string
  feeType?: string
  feeAmount?: number
  billingDay?: number
  startDate?: string
  endDate?: string
  notes?: string
}) {
  try {
    const db = getPrisma()
    const billingDay = payload.billingDay != null ? Math.min(28, Math.max(1, Math.round(payload.billingDay))) : null
    const engagement = await db.engagement.create({
      data: {
        clientId:       payload.clientId,
        staffId:        payload.staffId ?? null,
        title:          payload.title.trim(),
        engagementType: payload.engagementType ?? 'RETAINER',
        status:         'ACTIVE',
        feeType:        payload.feeType ?? 'FIXED',
        feeAmount:      payload.feeAmount ?? null,
        billingDay,
        // Real bug found live (2026-07-28 service-vertical audit): a bare
        // `new Date('YYYY-MM-DD')` parses as UTC midnight — inconsistent
        // with the parseLocalDateStart fix already applied to every other
        // date-only write in this service family.
        startDate:      payload.startDate ? parseLocalDateStart(payload.startDate) : null,
        endDate:        payload.endDate ? parseLocalDateStart(payload.endDate) : null,
        notes:          payload.notes ?? null,
      },
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
        staff:  { select: { id: true, fullName: true } },
      },
    })
    await db.auditLog.create({ data: { action: 'CREATE', entityType: 'Engagement', entityId: engagement.id, newValue: JSON.stringify({ title: engagement.title }) } }).catch(() => {})
    if (engagement.endDate) await scheduleEngagementRenewalReminder(engagement.id, engagement.endDate)
    return { success: true, data: serializeEngagement(engagement) }
  } catch (err) {
    return { success: false, error: { code: 'EN29-002', message: err instanceof Error ? err.message : 'Could not create engagement.' } }
  }
}

export async function updateEngagement(payload: {
  id: string
  staffId?: string | null
  title?: string
  engagementType?: string
  status?: string
  feeType?: string
  feeAmount?: number | null
  billingDay?: number | null
  startDate?: string | null
  endDate?: string | null
  notes?: string | null
}) {
  try {
    if (payload.feeAmount != null && payload.feeAmount < 0) {
      return { success: false, error: { code: 'EN29-005', message: 'Fee amount cannot be negative.' } }
    }
    const db = getPrisma()
    const { id, startDate, endDate, billingDay, ...rest } = payload

    // Fetch the pre-update endDate so a change can cancel the reminder tied
    // to the old date and schedule a fresh one for the new date — same
    // reschedule-on-change discipline as legal-case.service.ts's
    // limitation-date reminder.
    const before = endDate !== undefined
      ? await db.engagement.findUnique({ where: { id }, select: { endDate: true } })
      : null

    const engagement = await db.engagement.update({
      where: { id },
      data: {
        ...rest,
        ...(billingDay !== undefined ? { billingDay: billingDay != null ? Math.min(28, Math.max(1, Math.round(billingDay))) : null } : {}),
        ...(startDate !== undefined ? { startDate: startDate ? parseLocalDateStart(startDate) : null } : {}),
        ...(endDate !== undefined   ? { endDate: endDate ? parseLocalDateStart(endDate) : null }       : {}),
      },
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
        staff:  { select: { id: true, fullName: true } },
      },
    })

    if (endDate !== undefined) {
      const oldDate = before?.endDate ?? null
      const newDate = engagement.endDate
      const changed = (oldDate?.getTime() ?? null) !== (newDate?.getTime() ?? null)
      if (changed) {
        if (oldDate) await cancelEngagementRenewalReminder(engagement.id, oldDate)
        if (newDate) await scheduleEngagementRenewalReminder(engagement.id, newDate)
      }
    }

    await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'Engagement', entityId: engagement.id } }).catch(() => {})
    return { success: true, data: serializeEngagement(engagement) }
  } catch (err) {
    return { success: false, error: { code: 'EN29-003', message: err instanceof Error ? err.message : 'Could not update engagement.' } }
  }
}

export async function deleteEngagement(id: string) {
  try {
    const db = getPrisma()
    const engagement = await db.engagement.findUnique({ where: { id }, select: { lastInvoicedPeriod: true } })
    if (engagement?.lastInvoicedPeriod) {
      return { success: false, error: { code: 'EN29-006', message: 'Cannot delete an engagement that has already been invoiced.' } }
    }
    await db.engagement.delete({ where: { id } })
    await db.auditLog.create({ data: { action: 'DELETE', entityType: 'Engagement', entityId: id } }).catch(() => {})
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'EN29-004', message: err instanceof Error ? err.message : 'Could not delete engagement.' } }
  }
}

// Fresh-audit fix (2026-07-12): the original one-shot nullable `invoiceId`
// claim-sentinel design (Phase 40 evaluation fix) permanently blocked
// re-invoicing after the FIRST month — `invoiceId` never goes back to null,
// so `claim.count` was always 0 from month 2 onward and the UI's own invoice
// button stayed hidden forever, breaking the most common way CA/CS firms
// actually get paid (monthly retainers). Replaced with the exact
// period-keyed ("YYYY-MM") claim pattern retainer.service.ts's
// generateInvoiceForRetainer already established for the identical
// recurring-fee problem — `lastInvoicedPeriod` is the real gating/claim key,
// `invoiceId` is kept only as an informational pointer to the MOST RECENT
// invoice (never used for gating).
export async function generateEngagementInvoice(engagementId: string, period?: string) {
  const db = getPrisma()
  try {
    // Real bug found live (2026-08-27 Phase 68 audit): `new Date().toISOString()
    // .slice(0, 7)` extracts the UTC year-month, which lags the real local
    // one for the first ~5.5 hours of a new month in IST (same bug class as
    // report.service.ts's own documented UTC-slice bug). Same pattern also
    // exists in retainer/pest-contract/service-contract.service.ts — flagged
    // but out of scope for this vertical's own fix, not touched here.
    const now = new Date()
    const targetPeriod = period ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const engagement = await db.engagement.findUnique({
      where: { id: engagementId },
      include: { client: { select: { id: true, customerName: true } } },
    })
    if (!engagement) return { success: false, error: { code: 'EN29-007', message: 'Engagement not found.' } }
    if (engagement.lastInvoicedPeriod === targetPeriod) {
      return { success: false, error: { code: 'EN29-008', message: `Already invoiced for ${targetPeriod}.` } }
    }
    if (engagement.feeAmount == null || Number(engagement.feeAmount) <= 0) {
      return { success: false, error: { code: 'EN29-009', message: 'Set a fee amount greater than zero before generating an invoice.' } }
    }
    const priorPeriod = engagement.lastInvoicedPeriod

    const claim = await db.engagement.updateMany({
      where: { id: engagementId, lastInvoicedPeriod: priorPeriod },
      data: { lastInvoicedPeriod: targetPeriod },
    })
    if (claim.count === 0) {
      return { success: false, error: { code: 'EN29-008', message: 'Already invoiced for this period.' } }
    }

    try {
      let product = await db.product.findFirst({ where: { hsnCode: '998311', isActive: true } })
      if (!product) {
        product = await db.product.create({
          data: { productName: 'Professional Consulting Services', productType: 'SERVICE', hsnCode: '998311', sellingPrice: 0, taxRate: 18, unit: 'NOS', isActive: true },
        })
      }

      const result = await billingService.createInvoice({
        customerId: engagement.clientId,
        paymentMethod: 'CREDIT',
        gstType: 'CGST_SGST',
        items: [{
          productId: product.id,
          quantity: 1,
          unitPrice: Number(engagement.feeAmount),
        }],
        notes: `Engagement fee: ${engagement.title} — ${targetPeriod}`,
        referenceNumber: engagementId.slice(0, 12),
      })
      if (!result.success) {
        await db.engagement.update({ where: { id: engagementId }, data: { lastInvoicedPeriod: priorPeriod } })
        return result
      }

      const invoice = result.data as { id: string }
      await db.engagement.update({ where: { id: engagementId }, data: { invoiceId: invoice.id } })
      await db.auditLog.create({ data: { action: 'INVOICED', entityType: 'Engagement', entityId: engagementId, newValue: JSON.stringify({ invoiceId: invoice.id, period: targetPeriod }) } }).catch(() => {})

      return { success: true, data: { invoiceId: invoice.id, period: targetPeriod } }
    } catch (err) {
      await db.engagement.update({ where: { id: engagementId }, data: { lastInvoicedPeriod: priorPeriod } }).catch(() => {})
      throw err
    }
  } catch (err) {
    return { success: false, error: { code: 'EN29-010', message: err instanceof Error ? err.message : 'Could not generate engagement invoice.' } }
  }
}
