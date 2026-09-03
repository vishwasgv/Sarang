import { getPrisma } from '../database/db'
import { buildReminderWhatsAppLink } from './notification-queue.service'

// 2026-09 §12 — Grocery/Kirana item 3: Khata (credit) auto-reminder. Reuses
// the exact buildWhatsAppLink primitive already proven by
// recall-record.service.ts's upsertRecall and serial.service.ts's
// scheduleEquipmentServiceReminder — this app has no cron/background-
// scheduler infrastructure, so (matching share.service.ts's own shape) this
// is a synchronous "build me the link, the owner opens/sends it" action, not
// a fire-and-forget scheduled job.

const KHATA_REMINDER_COOLDOWN_DAYS = 7

export interface KhataReminderCandidate {
  customerId: string
  customerName: string
  phone: string | null
  outstanding: number
  daysOverdue: number
  eligibleForReminder: boolean
  ineligibleReason?: string
}

async function listKhataReminderCandidates(): Promise<{ success: boolean; data?: KhataReminderCandidate[]; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const now = new Date()
    const [customers, ledger] = await Promise.all([
      db.customer.findMany({
        where: { isActive: true },
        select: { id: true, customerName: true, phone: true, lastKhataReminderSentAt: true }
      }),
      db.customerLedger.findMany({ select: { customerId: true, debitAmount: true, creditAmount: true, createdAt: true } })
    ])

    const ledgerByCustomer = new Map<string, { debitAmount: number; creditAmount: number; createdAt: Date }[]>()
    for (const e of ledger) {
      const arr = ledgerByCustomer.get(e.customerId) ?? []
      arr.push(e)
      ledgerByCustomer.set(e.customerId, arr)
    }

    const candidates: KhataReminderCandidate[] = []
    for (const c of customers) {
      const entries = ledgerByCustomer.get(c.id) ?? []
      const outstanding = entries.reduce((s, e) => s + e.debitAmount - e.creditAmount, 0)
      if (outstanding <= 0.01) continue

      const oldestDebit = entries.filter(e => e.debitAmount > 0).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]
      const daysOverdue = oldestDebit ? Math.floor((now.getTime() - oldestDebit.createdAt.getTime()) / 86400000) : 0

      let eligibleForReminder = true
      let ineligibleReason: string | undefined
      if (!c.phone) {
        eligibleForReminder = false
        ineligibleReason = 'No phone number on file.'
      } else if (c.lastKhataReminderSentAt && (now.getTime() - c.lastKhataReminderSentAt.getTime()) < KHATA_REMINDER_COOLDOWN_DAYS * 86400000) {
        eligibleForReminder = false
        ineligibleReason = `Reminder already sent within the last ${KHATA_REMINDER_COOLDOWN_DAYS} days.`
      }

      candidates.push({
        customerId: c.id, customerName: c.customerName, phone: c.phone,
        outstanding: Math.round(outstanding * 100) / 100, daysOverdue, eligibleForReminder, ineligibleReason
      })
    }

    return { success: true, data: candidates.sort((a, b) => b.outstanding - a.outstanding) }
  } catch (err) {
    return { success: false, error: { code: 'KHATA-001', message: err instanceof Error ? err.message : 'Could not list khata reminder candidates.' } }
  }
}

// Builds the wa.me link and stamps lastKhataReminderSentAt at build time —
// the app structurally cannot know whether the owner actually pressed send
// once WhatsApp opens (same reasoning ShareMenu.tsx's own doc comment gives
// for never showing a "Sent!" toast), so "we did everything we can, handed
// off to WhatsApp" is the only honest point to mark as done.
async function buildKhataReminderLink(customerId: string): Promise<{ success: boolean; data?: string; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const customer = await db.customer.findUnique({ where: { id: customerId }, select: { customerName: true, phone: true } })
    if (!customer) return { success: false, error: { code: 'CUST-001', message: 'Customer not found.' } }
    if (!customer.phone) return { success: false, error: { code: 'KHATA-002', message: 'No phone number on file for this customer.' } }

    const [ledger, profile] = await Promise.all([
      db.customerLedger.findMany({ where: { customerId }, select: { debitAmount: true, creditAmount: true } }),
      db.businessProfile.findFirst({ select: { currencySymbol: true } })
    ])
    const outstanding = ledger.reduce((s, e) => s + e.debitAmount - e.creditAmount, 0)
    if (outstanding <= 0.01) return { success: false, error: { code: 'KHATA-003', message: 'This customer has no outstanding balance.' } }

    const sym = profile?.currencySymbol ?? '₹'
    const message = `Dear ${customer.customerName}, a gentle reminder that your outstanding khata balance is ${sym}${outstanding.toFixed(2)}. Please settle at your convenience. Thank you!`
    const link = await buildReminderWhatsAppLink(customer.phone, message)
    await db.customer.update({ where: { id: customerId }, data: { lastKhataReminderSentAt: new Date() } })
    return { success: true, data: link }
  } catch (err) {
    return { success: false, error: { code: 'KHATA-004', message: err instanceof Error ? err.message : 'Could not build reminder link.' } }
  }
}

export const khataReminderService = { listKhataReminderCandidates, buildKhataReminderLink }
