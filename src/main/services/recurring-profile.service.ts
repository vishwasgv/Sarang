import { getPrisma } from '../database/db'
import { parseLocalDateStart } from '../utils/date.util'
import { logAction } from './audit.service'
import { billingService } from './billing.service'
import { billService } from './bill.service'
import { createExpense } from './expense.service'
import type { CreateRecurringProfilePayload, UpdateRecurringProfilePayload } from '../validation/recurring-profile.validation'

// Recurring Invoices/Bills/Expenses — reuses RetainerAgreement's own proven
// lastGeneratedPeriod claim-key pattern (see retainer.service.ts's
// generateInvoiceForRetainer) rather than building real cron, since no
// scheduler infrastructure exists in this codebase. Evaluated on demand from
// the existing hourly setInterval in src/main/index.ts.

function getISOWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
  return { year: d.getUTCFullYear(), week }
}

// Returns the claim-key for the period containing `date`, plus the earliest
// date within that period this profile is actually due — on-demand
// evaluation only ever compares "today ≥ thresholdDate," so a period is
// still correctly caught even if the app wasn't open exactly on the
// configured day.
export function getPeriodInfo(cadence: string, dayOfPeriod: number, date: Date): { periodKey: string; thresholdDate: Date } {
  const y = date.getFullYear()
  if (cadence === 'MONTHLY') {
    const m = date.getMonth()
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const day = Math.min(dayOfPeriod, daysInMonth)
    return { periodKey: `${y}-${String(m + 1).padStart(2, '0')}`, thresholdDate: new Date(y, m, day) }
  }
  if (cadence === 'QUARTERLY') {
    const q = Math.floor(date.getMonth() / 3)
    const qStartMonth = q * 3
    const daysInMonth = new Date(y, qStartMonth + 1, 0).getDate()
    const day = Math.min(dayOfPeriod, daysInMonth)
    return { periodKey: `${y}-Q${q + 1}`, thresholdDate: new Date(y, qStartMonth, day) }
  }
  if (cadence === 'YEARLY') {
    const daysInJan = new Date(y, 1, 0).getDate()
    const day = Math.min(dayOfPeriod, daysInJan)
    return { periodKey: `${y}`, thresholdDate: new Date(y, 0, day) }
  }
  // WEEKLY — dayOfPeriod is ISO day-of-week (1=Monday..7=Sunday).
  const today0 = new Date(y, date.getMonth(), date.getDate())
  const dow = ((today0.getDay() + 6) % 7) + 1
  const thresholdDate = new Date(today0)
  thresholdDate.setDate(today0.getDate() + (dayOfPeriod - dow))
  const isoWeek = getISOWeek(date)
  return { periodKey: `${isoWeek.year}-W${String(isoWeek.week).padStart(2, '0')}`, thresholdDate }
}

function buildPayloadJson(payload: CreateRecurringProfilePayload): string {
  if (payload.documentType === 'INVOICE') {
    return JSON.stringify({ items: payload.items, notes: payload.notes })
  }
  if (payload.documentType === 'BILL') {
    return JSON.stringify({ items: payload.items, isReverseCharge: payload.isReverseCharge, notes: payload.notes })
  }
  return JSON.stringify({ categoryId: payload.categoryId, expenseName: payload.expenseName, amount: payload.amount, paymentMethod: payload.paymentMethod, remarks: payload.remarks })
}

async function generateOneDocument(profile: { documentType: string; payloadJson: string; customerId: string | null; supplierId: string | null }, userId?: string) {
  const payload = JSON.parse(profile.payloadJson)
  if (profile.documentType === 'INVOICE') {
    // Always CREDIT — an auto-generated recurring invoice never collects
    // payment at creation time, same convention retainer.service.ts's own
    // generateInvoiceForRetainer already established for the identical
    // "programmatically generate a real billed Invoice" case.
    return billingService.createInvoice({ customerId: profile.customerId ?? undefined, paymentMethod: 'CREDIT', items: payload.items, notes: payload.notes }, userId)
  }
  if (profile.documentType === 'BILL') {
    return billService.createBill({ supplierId: profile.supplierId!, items: payload.items, isReverseCharge: payload.isReverseCharge ?? false, notes: payload.notes }, userId)
  }
  return createExpense({ categoryId: payload.categoryId, expenseName: payload.expenseName, amount: payload.amount, paymentMethod: payload.paymentMethod, supplierId: profile.supplierId ?? undefined, remarks: payload.remarks }, userId)
}

export const recurringProfileService = {
  async createRecurringProfile(payload: CreateRecurringProfilePayload, userId?: string) {
    try {
      const db = getPrisma()
      if (payload.documentType === 'INVOICE') {
        const customer = await db.customer.findUnique({ where: { id: payload.customerId } })
        if (!customer) return { success: false, error: { code: 'CUST-001', message: 'Customer not found.' } }
      }
      if (payload.documentType === 'BILL') {
        const supplier = await db.supplier.findUnique({ where: { id: payload.supplierId } })
        if (!supplier) return { success: false, error: { code: 'SUP-001', message: 'Supplier not found.' } }
      }
      if (payload.documentType === 'EXPENSE' && payload.supplierId) {
        const supplier = await db.supplier.findUnique({ where: { id: payload.supplierId } })
        if (!supplier) return { success: false, error: { code: 'SUP-001', message: 'Supplier not found.' } }
      }

      const profile = await db.recurringProfile.create({
        data: {
          documentType: payload.documentType,
          payloadJson: buildPayloadJson(payload),
          customerId: payload.documentType === 'INVOICE' ? payload.customerId : null,
          supplierId: payload.documentType === 'BILL' ? payload.supplierId : (payload.documentType === 'EXPENSE' ? payload.supplierId ?? null : null),
          cadence: payload.cadence,
          dayOfPeriod: payload.dayOfPeriod,
          startDate: parseLocalDateStart(payload.startDate),
          endDate: payload.endDate ? parseLocalDateStart(payload.endDate) : null,
          createdById: userId ?? null
        }
      })

      await logAction({ userId, action: 'RECURRING_PROFILE_CREATED', entityType: 'RecurringProfile', entityId: profile.id, newValue: { documentType: profile.documentType, cadence: profile.cadence } })
      return { success: true, data: profile }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to create recurring profile.' } }
    }
  },

  async listRecurringProfiles(filters?: { documentType?: string; active?: boolean }) {
    try {
      const db = getPrisma()
      const where: Record<string, unknown> = {}
      if (filters?.documentType) where.documentType = filters.documentType
      if (filters?.active !== undefined) where.active = filters.active
      const profiles = await db.recurringProfile.findMany({
        where,
        include: {
          customer: { select: { id: true, customerName: true } },
          supplier: { select: { id: true, supplierName: true } }
        },
        orderBy: { createdAt: 'desc' }
      })
      return { success: true, data: profiles }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to list recurring profiles.' } }
    }
  },

  async getRecurringProfile(id: string) {
    try {
      const db = getPrisma()
      const profile = await db.recurringProfile.findUnique({
        where: { id },
        include: {
          customer: { select: { id: true, customerName: true } },
          supplier: { select: { id: true, supplierName: true } }
        }
      })
      if (!profile) return { success: false, error: { code: 'RP-001', message: 'Recurring profile not found.' } }
      return { success: true, data: profile }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to fetch recurring profile.' } }
    }
  },

  async updateRecurringProfile(payload: UpdateRecurringProfilePayload, userId?: string) {
    try {
      const db = getPrisma()
      const existing = await db.recurringProfile.findUnique({ where: { id: payload.id } })
      if (!existing) return { success: false, error: { code: 'RP-001', message: 'Recurring profile not found.' } }

      const updated = await db.recurringProfile.update({
        where: { id: payload.id },
        data: {
          active: payload.active ?? existing.active,
          cadence: payload.cadence ?? existing.cadence,
          dayOfPeriod: payload.dayOfPeriod ?? existing.dayOfPeriod,
          endDate: payload.endDate !== undefined ? (payload.endDate ? parseLocalDateStart(payload.endDate) : null) : existing.endDate
        }
      })
      await logAction({ userId, action: 'RECURRING_PROFILE_UPDATED', entityType: 'RecurringProfile', entityId: payload.id, newValue: payload })
      return { success: true, data: updated }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to update recurring profile.' } }
    }
  },

  async deleteRecurringProfile(id: string, userId?: string) {
    try {
      const db = getPrisma()
      const existing = await db.recurringProfile.findUnique({ where: { id } })
      if (!existing) return { success: false, error: { code: 'RP-001', message: 'Recurring profile not found.' } }
      await db.recurringProfile.delete({ where: { id } })
      await logAction({ userId, action: 'RECURRING_PROFILE_DELETED', entityType: 'RecurringProfile', entityId: id })
      return { success: true }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to delete recurring profile.' } }
    }
  },

  // The on-demand evaluator — called from the existing hourly setInterval in
  // src/main/index.ts, never on a real per-second cron. Claims the period
  // atomically FIRST (same defensive pattern as
  // retainer.service.ts's generateInvoiceForRetainer's own updateMany
  // tip-claim) so a concurrent tick, or a generation that fails halfway,
  // can never double-generate for the same period — and rolls the claim
  // back if generation itself fails.
  async generateDueRecurringDocuments(userId?: string) {
    const db = getPrisma()
    const today = new Date()
    const today0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()

    const profiles = await db.recurringProfile.findMany({ where: { active: true } })
    const generated: Array<{ profileId: string; documentType: string; resultId: string; period: string }> = []
    const failed: Array<{ profileId: string; error: string }> = []

    for (const profile of profiles) {
      if (profile.startDate.getTime() > today0) continue
      if (profile.endDate && profile.endDate.getTime() < today0) continue

      const { periodKey, thresholdDate } = getPeriodInfo(profile.cadence, profile.dayOfPeriod, today)
      if (profile.lastGeneratedPeriod === periodKey) continue
      if (thresholdDate.getTime() > today0) continue

      const priorPeriod = profile.lastGeneratedPeriod
      const claim = await db.recurringProfile.updateMany({
        where: { id: profile.id, lastGeneratedPeriod: priorPeriod },
        data: { lastGeneratedPeriod: periodKey }
      })
      if (claim.count === 0) continue // lost the race to a concurrent evaluator tick

      try {
        const result = await generateOneDocument(profile, userId)
        if (!result.success) {
          await db.recurringProfile.update({ where: { id: profile.id }, data: { lastGeneratedPeriod: priorPeriod } })
          failed.push({ profileId: profile.id, error: result.error?.message ?? 'Unknown error' })
          continue
        }
        const resultId = (result.data as { id: string }).id
        generated.push({ profileId: profile.id, documentType: profile.documentType, resultId, period: periodKey })
        await logAction({ userId, action: 'RECURRING_DOCUMENT_GENERATED', entityType: 'RecurringProfile', entityId: profile.id, newValue: { documentType: profile.documentType, period: periodKey, resultId } })
      } catch (err) {
        await db.recurringProfile.update({ where: { id: profile.id }, data: { lastGeneratedPeriod: priorPeriod } }).catch(() => {})
        failed.push({ profileId: profile.id, error: err instanceof Error ? err.message : 'Unknown error' })
      }
    }

    return { success: true, data: { generated, failed } }
  }
}
