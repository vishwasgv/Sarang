import { getPrisma } from '../database/db'
import { billingService } from './billing.service'

// RetainerAgreement.monthlyAmount/hoursPerMonth are Prisma Decimal fields —
// Electron's IPC (structured clone) cannot serialize a Decimal instance and
// throws "An object could not be cloned" on every response that includes
// one. Applied to every function below that returns a retainer.
function serializeRetainer<T extends { monthlyAmount: unknown; hoursPerMonth: unknown }>(r: T): T {
  return {
    ...r,
    monthlyAmount: Number(r.monthlyAmount),
    hoursPerMonth: r.hoursPerMonth == null ? null : Number(r.hoursPerMonth),
  }
}

function getNextBillingDate(billingDay: number): Date {
  const now = new Date()
  const candidate = new Date(now.getFullYear(), now.getMonth(), billingDay)
  if (candidate <= now) candidate.setMonth(candidate.getMonth() + 1)
  return candidate
}

async function scheduleRetainerReminder(retainerId: string, clientName: string, title: string, billingDay: number, monthlyAmount: number) {
  try {
    const db = getPrisma()
    // NotificationQueue has no column linking back to a RetainerAgreement
    // (these are firm-internal reminders, customerId is always null here).
    // Embedding the full cuid — not just a 6-char slice — makes an
    // accidental substring collision with another retainer's id or title
    // effectively impossible.
    await db.notificationQueue.deleteMany({
      where: { notificationType: 'RETAINER_INVOICE_DUE_3D', templateBody: { contains: `[${retainerId}]` } },
    })
    const nextBilling = getNextBillingDate(billingDay)
    const reminderDate = new Date(nextBilling.getTime() - 3 * 86400000)
    const now = new Date()
    if (reminderDate > now) {
      const body = `Retainer invoice for ${clientName} (${title}) [${retainerId}] of ₹${Number(monthlyAmount).toLocaleString('en-IN')}/month is due in 3 days (${nextBilling.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}). Please generate the invoice. Powered by Sarang | www.aszurex.com`
      await db.notificationQueue.create({
        data: { customerId: null, customerName: clientName, customerPhone: null, notificationType: 'RETAINER_INVOICE_DUE_3D', templateBody: body, whatsappLink: null, scheduledFor: reminderDate, status: 'PENDING' },
      })
    }
  } catch { /* non-critical */ }
}

export async function listRetainers(filters?: {
  clientId?: string
  assignedToId?: string
  status?: string
}) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.clientId) where.clientId = filters.clientId
    if (filters?.assignedToId) where.assignedToId = filters.assignedToId
    if (filters?.status) where.status = filters.status
    const retainers = await db.retainerAgreement.findMany({
      where,
      include: {
        client:     { select: { id: true, customerName: true, phone: true } },
        assignedTo: { select: { id: true, fullName: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    })
    return { success: true, data: retainers.map(serializeRetainer) }
  } catch (err) {
    return { success: false, error: { code: 'RT30-001', message: err instanceof Error ? err.message : 'Could not list retainers.' } }
  }
}

export async function createRetainer(payload: {
  clientId: string
  assignedToId?: string
  title: string
  retainerType?: string
  status?: string
  monthlyAmount: number
  billingDay?: number
  hoursPerMonth?: number
  deliverables?: string
  startDate: string
  endDate?: string
  notes?: string
}) {
  try {
    const db = getPrisma()
    const billingDay = payload.billingDay != null
      ? Math.min(28, Math.max(1, Math.round(payload.billingDay)))
      : 1
    const retainer = await db.retainerAgreement.create({
      data: {
        clientId:      payload.clientId,
        assignedToId:  payload.assignedToId ?? null,
        title:         payload.title.trim(),
        retainerType:  payload.retainerType ?? 'FIXED_FEE',
        status:        payload.status ?? 'ACTIVE',
        monthlyAmount: payload.monthlyAmount,
        billingDay,
        hoursPerMonth: payload.hoursPerMonth ?? null,
        deliverables:  payload.deliverables ?? null,
        startDate:     new Date(payload.startDate),
        endDate:       payload.endDate ? new Date(payload.endDate) : null,
        notes:         payload.notes ?? null,
      },
      include: {
        client:     { select: { id: true, customerName: true, phone: true } },
        assignedTo: { select: { id: true, fullName: true } },
      },
    })
    await db.auditLog.create({ data: { action: 'CREATE', entityType: 'RetainerAgreement', entityId: retainer.id, newValue: JSON.stringify({ title: retainer.title }) } }).catch(() => {})
    if (retainer.status === 'ACTIVE') scheduleRetainerReminder(retainer.id, retainer.client.customerName, retainer.title, retainer.billingDay, Number(retainer.monthlyAmount)).catch(() => {})
    return { success: true, data: serializeRetainer(retainer) }
  } catch (err) {
    return { success: false, error: { code: 'RT30-002', message: err instanceof Error ? err.message : 'Could not create retainer.' } }
  }
}

export async function updateRetainer(payload: {
  id: string
  assignedToId?: string | null
  title?: string
  retainerType?: string
  monthlyAmount?: number
  billingDay?: number | null
  hoursPerMonth?: number | null
  deliverables?: string | null
  status?: string
  startDate?: string
  endDate?: string | null
  notes?: string | null
}) {
  try {
    const db = getPrisma()
    const { id, title, billingDay, startDate, endDate, ...rest } = payload
    const retainer = await db.retainerAgreement.update({
      where: { id },
      data: {
        ...rest,
        ...(title !== undefined     ? { title: title.trim() } : {}),
        ...(billingDay !== undefined ? { billingDay: billingDay != null ? Math.min(28, Math.max(1, Math.round(billingDay))) : 1 } : {}),
        ...(startDate !== undefined  ? { startDate: new Date(startDate) } : {}),
        ...(endDate !== undefined    ? { endDate: endDate ? new Date(endDate) : null } : {}),
      },
      include: {
        client:     { select: { id: true, customerName: true, phone: true } },
        assignedTo: { select: { id: true, fullName: true } },
      },
    })
    await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'RetainerAgreement', entityId: retainer.id } }).catch(() => {})
    if (retainer.status === 'ACTIVE') scheduleRetainerReminder(retainer.id, retainer.client.customerName, retainer.title, retainer.billingDay, Number(retainer.monthlyAmount)).catch(() => {})
    return { success: true, data: serializeRetainer(retainer) }
  } catch (err) {
    return { success: false, error: { code: 'RT30-003', message: err instanceof Error ? err.message : 'Could not update retainer.' } }
  }
}

// Before this function, RetainerAgreement had no invoice-generation path at
// all — scheduleRetainerReminder just tells staff "please generate the
// invoice" and nothing ever did. Unlike ServiceProjectMilestone/LabTestOrder
// (a single one-off invoiceId), a retainer recurs every month, so the claim
// key is a period string (YYYY-MM) rather than a nullable id — the same
// "read prior value, claim by asserting it hasn't changed" optimistic
// pattern, just keyed by period instead of by null/non-null.
export async function generateInvoiceForRetainer(retainerId: string, period?: string) {
  const db = getPrisma()
  try {
    const targetPeriod = period ?? new Date().toISOString().slice(0, 7)
    const retainer = await db.retainerAgreement.findUnique({
      where: { id: retainerId },
      include: { client: { select: { id: true, customerName: true } } },
    })
    if (!retainer) return { success: false, error: { code: 'RT30-005', message: 'Retainer not found.' } }
    if (retainer.lastInvoicedPeriod === targetPeriod) {
      return { success: false, error: { code: 'RT30-006', message: `Already invoiced for ${targetPeriod}.` } }
    }
    const priorPeriod = retainer.lastInvoicedPeriod

    const claim = await db.retainerAgreement.updateMany({
      where: { id: retainerId, lastInvoicedPeriod: priorPeriod },
      data: { lastInvoicedPeriod: targetPeriod },
    })
    if (claim.count === 0) {
      return { success: false, error: { code: 'RT30-006', message: 'Already invoiced for this period.' } }
    }

    try {
      let product = await db.product.findFirst({ where: { hsnCode: '998311', isActive: true } })
      if (!product) {
        product = await db.product.create({
          data: { productName: 'Professional Consulting Services', productType: 'SERVICE', hsnCode: '998311', sellingPrice: 0, taxRate: 18, unit: 'NOS', isActive: true },
        })
      }

      const result = await billingService.createInvoice({
        customerId: retainer.clientId,
        paymentMethod: 'CREDIT',
        gstType: 'CGST_SGST',
        items: [{
          productId: product.id,
          quantity: 1,
          unitPrice: Number(retainer.monthlyAmount),
          taxRate: 18,
        }],
        notes: `Retainer: ${retainer.title} — ${targetPeriod}`,
        referenceNumber: retainerId.slice(0, 12),
      })
      if (!result.success) {
        await db.retainerAgreement.update({ where: { id: retainerId }, data: { lastInvoicedPeriod: priorPeriod } })
        return result
      }

      const invoice = result.data as { id: string }
      await db.auditLog.create({ data: { action: 'INVOICED', entityType: 'RetainerAgreement', entityId: retainerId, newValue: JSON.stringify({ invoiceId: invoice.id, period: targetPeriod }) } }).catch(() => {})
      return { success: true, data: { invoiceId: invoice.id, period: targetPeriod } }
    } catch (err) {
      await db.retainerAgreement.update({ where: { id: retainerId }, data: { lastInvoicedPeriod: priorPeriod } }).catch(() => {})
      throw err
    }
  } catch (err) {
    return { success: false, error: { code: 'RT30-007', message: err instanceof Error ? err.message : 'Could not generate retainer invoice.' } }
  }
}

// Phase 58 §1 (2026-07-17) — "hoursPerMonth is actually decremented against
// logged time" for an HOURLY_BUCKET retainer. Deliberately a derived sum
// over TimeEntry rows for the target period, not a mutable running counter
// on RetainerAgreement itself — a stored counter needs a monthly-reset job
// that can silently fail to run (exactly the kind of drift bug this
// codebase's other "expiring"/"usage" reports already avoid by computing
// on-demand instead of maintaining state). period defaults to the current
// calendar month, matching generateInvoiceForRetainer's own default.
export async function getRetainerHoursUsage(retainerId: string, period?: string) {
  try {
    const db = getPrisma()
    const retainer = await db.retainerAgreement.findUnique({ where: { id: retainerId }, select: { hoursPerMonth: true } })
    if (!retainer) return { success: false, error: { code: 'RT30-008', message: 'Retainer not found.' } }

    const targetPeriod = period ?? new Date().toISOString().slice(0, 7)
    const [year, month] = targetPeriod.split('-').map(Number)
    const periodStart = new Date(year, month - 1, 1)
    const periodEnd = new Date(year, month, 0, 23, 59, 59, 999)

    const entries = await db.timeEntry.findMany({
      where: { retainerId, date: { gte: periodStart, lte: periodEnd } },
      select: { hours: true },
    })
    const hoursUsed = entries.reduce((s, e) => s + Number(e.hours), 0)
    const hoursPerMonth = retainer.hoursPerMonth == null ? null : Number(retainer.hoursPerMonth)

    return {
      success: true,
      data: {
        period: targetPeriod,
        hoursPerMonth,
        hoursUsed,
        hoursRemaining: hoursPerMonth == null ? null : Math.max(0, hoursPerMonth - hoursUsed),
      },
    }
  } catch (err) {
    return { success: false, error: { code: 'RT30-009', message: err instanceof Error ? err.message : 'Could not get retainer hours usage.' } }
  }
}

export async function deleteRetainer(id: string) {
  try {
    const db = getPrisma()
    await db.retainerAgreement.delete({ where: { id } })
    await db.auditLog.create({ data: { action: 'DELETE', entityType: 'RetainerAgreement', entityId: id } }).catch(() => {})
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'RT30-004', message: err instanceof Error ? err.message : 'Could not delete retainer.' } }
  }
}
