import { getPrisma } from '../database/db'
import { billingService } from './billing.service'

// Engagement.feeAmount is a Prisma Decimal field — Electron's IPC (structured
// clone) cannot serialize a Decimal instance and throws "An object could not
// be cloned" on every response that includes one. Applied to every function
// below that returns an engagement.
function serializeEngagement<T extends { feeAmount: unknown }>(e: T): T {
  return { ...e, feeAmount: e.feeAmount == null ? null : Number(e.feeAmount) }
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
        startDate:      payload.startDate ? new Date(payload.startDate) : null,
        endDate:        payload.endDate ? new Date(payload.endDate) : null,
        notes:          payload.notes ?? null,
      },
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
        staff:  { select: { id: true, fullName: true } },
      },
    })
    await db.auditLog.create({ data: { action: 'CREATE', entityType: 'Engagement', entityId: engagement.id, newValue: JSON.stringify({ title: engagement.title }) } }).catch(() => {})
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
    const engagement = await db.engagement.update({
      where: { id },
      data: {
        ...rest,
        ...(billingDay !== undefined ? { billingDay: billingDay != null ? Math.min(28, Math.max(1, Math.round(billingDay))) : null } : {}),
        ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
        ...(endDate !== undefined   ? { endDate: endDate ? new Date(endDate) : null }       : {}),
      },
      include: {
        client: { select: { id: true, customerName: true, phone: true } },
        staff:  { select: { id: true, fullName: true } },
      },
    })
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
    const targetPeriod = period ?? new Date().toISOString().slice(0, 7)
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
