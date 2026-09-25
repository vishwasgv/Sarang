import { randomUUID } from 'crypto'
import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { customerLedgerService } from './customer-ledger.service'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { journalEntryService, reverseEntryBySourceTx } from './journal-entry.service'
import { roundCurrency, sumCurrency } from './currency.service'
import { getBusinessCurrencyDecimals } from './settings.service'
import { startOfLocalDay } from '../utils/date.util'
import { ServiceError } from '../errors/service-error'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

// Credit interest on overdue customer balances (Section 4.1 item 6) —
// disabled by default (BusinessProfile.creditInterestEnabled), computed per
// overdue invoice (not a flat rate on the whole outstanding balance), since
// each invoice went overdue on a different date and accrues from its own
// dueDate, not from "today minus some average."
function computeInvoiceInterest(balanceAmount: number, daysOverdue: number, annualRatePercent: number, type: 'SIMPLE' | 'COMPOUND'): number {
  if (daysOverdue <= 0 || annualRatePercent <= 0 || balanceAmount <= 0) return 0
  if (type === 'SIMPLE') {
    return roundCurrency(balanceAmount * (annualRatePercent / 100) * (daysOverdue / 365))
  }
  // COMPOUND — monthly compounding, the common convention for overdue trade
  // credit interest. daysOverdue/30 (floored) months elapsed; a part-month
  // simply hasn't compounded yet, matching how compounding periods work.
  const monthsElapsed = Math.floor(daysOverdue / 30)
  if (monthsElapsed <= 0) return 0
  const monthlyRate = annualRatePercent / 12 / 100
  const grown = balanceAmount * (Math.pow(1 + monthlyRate, monthsElapsed) - 1)
  return roundCurrency(grown)
}

export const creditInterestService = {
  // Read-only preview — what WOULD be charged right now, per overdue
  // invoice, without posting anything. Used by the UI to show "you could
  // charge ₹X in interest" before an admin actually commits to it.
  async calculateInterest(customerId: string) {
    await getBusinessCurrencyDecimals()
    try {
      const db = getPrisma()
      const profile = await db.businessProfile.findFirst({ select: { creditInterestEnabled: true, creditInterestRatePercent: true, creditInterestType: true } })
      if (!profile?.creditInterestEnabled) {
        return { success: false, error: { code: 'CI-001', message: 'Credit interest is not enabled. Turn it on in Settings first.' } }
      }
      const customer = await db.customer.findUnique({ where: { id: customerId } })
      if (!customer) return { success: false, error: { code: 'CUS-001', message: 'Customer not found.' } }

      const now = new Date()
      const overdueInvoices = await db.invoice.findMany({
        where: { customerId, status: { not: 'CANCELLED' }, paymentStatus: { in: ['UNPAID', 'PARTIAL'] }, dueDate: { lt: now } },
        select: { id: true, invoiceNumber: true, balanceAmount: true, dueDate: true }
      })

      const type = profile.creditInterestType as 'SIMPLE' | 'COMPOUND'
      const lines = overdueInvoices.map((inv) => {
        const daysOverdue = Math.floor((now.getTime() - inv.dueDate!.getTime()) / 86400000)
        const interest = computeInvoiceInterest(inv.balanceAmount, daysOverdue, profile.creditInterestRatePercent, type)
        return { invoiceId: inv.id, invoiceNumber: inv.invoiceNumber, balanceAmount: inv.balanceAmount, daysOverdue, interest }
      }).filter((l) => l.interest > 0)

      const totalInterest = sumCurrency(lines.map((l) => l.interest))
      return { success: true, data: { customerId, ratePercent: profile.creditInterestRatePercent, type, lines, totalInterest } }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to calculate interest.' } }
    }
  },

  // Posts the previewed interest as a real charge: one CustomerLedger debit
  // (they now owe more) and one balanced JournalEntry (Debit Accounts
  // Receivable, Credit Interest Income) — a real accrual, not just a number
  // shown on screen.
  async postInterestCharge(customerId: string, userId?: string) {
    await getBusinessCurrencyDecimals()
    const db = getPrisma()
    try {
      const preview = await this.calculateInterest(customerId)
      if (!preview.success) return preview
      const { totalInterest, lines } = preview.data as { totalInterest: number; lines: Array<{ invoiceNumber: string }> }
      if (totalInterest <= 0) return { success: false, error: { code: 'CI-002', message: 'No interest is currently due for this customer.' } }

      const customer = await db.customer.findUnique({ where: { id: customerId } })
      if (!customer) return { success: false, error: { code: 'CUS-001', message: 'Customer not found.' } }

      // Double-click / double-submit guard: the interest amount above is computed
      // from each overdue invoice's live balanceAmount, which posting interest does
      // NOT reduce — so two concurrent calls would independently compute the same
      // totalInterest and, without this check, both post a full separate charge.
      // Re-checked *inside* the transaction (not before it) so that when SQLite
      // serializes two concurrent transactions, the second one's check sees the
      // first one's already-committed row and aborts instead of double-charging.
      // A unique per-charge id, generated up front so it can be used as
      // BOTH the CustomerLedger entry's own referenceId AND the
      // JournalEntry's sourceId — see reverseInterestCharge below for why:
      // sourceId used to be the bare customerId, which every interest
      // charge for that customer shares, so a generic reverseEntryBySourceTx
      // lookup (findFirst by sourceType+sourceId) could never unambiguously
      // target ONE specific charge once a customer had more than one
      // posted over time. This makes every charge individually addressable.
      const chargeId = randomUUID()

      let duplicate = false
      await db.$transaction(async (tx: TxClient) => {
        const alreadyPostedToday = await tx.customerLedger.findFirst({
          where: { customerId, referenceType: 'INTEREST_CHARGE', createdAt: { gte: startOfLocalDay(new Date()) } },
          select: { id: true }
        })
        if (alreadyPostedToday) { duplicate = true; return }

        await customerLedgerService.addEntry({
          customerId,
          referenceType: 'INTEREST_CHARGE',
          referenceId: chargeId,
          debitAmount: totalInterest,
          creditAmount: 0,
          remarks: `Overdue interest on ${lines.length} invoice${lines.length === 1 ? '' : 's'}`
        }, tx)

        const [arAccount, interestAccount] = await Promise.all([
          chartOfAccountsService.getSystemAccountByCode('1100', tx),
          chartOfAccountsService.getSystemAccountByCode('4100', tx)
        ])
        await journalEntryService.postSystemEntry(tx, {
          sourceType: 'INTEREST_CHARGE', sourceId: chargeId, narration: `Overdue interest — ${customer.customerName}`,
          lines: [
            { accountId: arAccount.id, bankAccountId: null, debitAmount: totalInterest, creditAmount: 0 },
            { accountId: interestAccount.id, bankAccountId: null, debitAmount: 0, creditAmount: totalInterest }
          ]
        })
      })

      if (duplicate) return { success: false, error: { code: 'CI-003', message: 'Interest was already posted for this customer today.' } }

      await logAction({ userId, action: 'CREDIT_INTEREST_CHARGED', entityType: 'Customer', entityId: customerId, newValue: { totalInterest, invoiceCount: lines.length, chargeId } })
      return { success: true, data: { totalInterest, invoiceCount: lines.length, chargeId } }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to post interest charge.' } }
    }
  },

  // Real bug found+fixed 2026-09-16: postInterestCharge had no matching
  // reversal path at all — every other charge type in this codebase (Bill,
  // Payment, Credit/Debit Note, PO receipt) has a matching void/reverse
  // function; this one didn't. A generic manual "Reverse Journal Entry"
  // (if a user found it via the Journal Entries screen) would only fix the
  // GL side — it never touches CustomerLedger, so the informal ledger
  // would permanently show the customer owing interest the real books no
  // longer reflect. chargeId is CustomerLedger.referenceId from the
  // original postInterestCharge call (also the matching JournalEntry's
  // sourceId) — see that function's own comment for why a bare customerId
  // could never unambiguously identify ONE charge once more than one exists.
  async reverseInterestCharge(chargeId: string, reason: string, userId?: string) {
    const db = getPrisma()
    try {
      const alreadyReversed = await db.customerLedger.findFirst({
        where: { referenceType: 'INTEREST_REVERSAL', referenceId: chargeId },
        select: { id: true }
      })
      if (alreadyReversed) return { success: false, error: { code: 'CI-004', message: 'This interest charge has already been reversed.' } }

      const original = await db.customerLedger.findFirst({ where: { referenceType: 'INTEREST_CHARGE', referenceId: chargeId } })
      if (!original) return { success: false, error: { code: 'CI-005', message: 'Interest charge not found.' } }

      await db.$transaction(async (tx: TxClient) => {
        // Re-check inside the transaction — same double-post-guard shape as
        // postInterestCharge's own, so two concurrent reversal clicks can't
        // both pass the pre-transaction check and both post a credit-back.
        const raceCheck = await tx.customerLedger.findFirst({
          where: { referenceType: 'INTEREST_REVERSAL', referenceId: chargeId },
          select: { id: true }
        })
        if (raceCheck) throw new ServiceError('CI-004', 'This interest charge has already been reversed.')

        await customerLedgerService.addEntry({
          customerId: original.customerId,
          referenceType: 'INTEREST_REVERSAL',
          referenceId: chargeId,
          debitAmount: 0,
          creditAmount: original.debitAmount,
          remarks: `Reversal: ${reason}`
        }, tx)

        await reverseEntryBySourceTx(tx, 'INTEREST_CHARGE', chargeId, reason, userId)
      })

      await logAction({ userId, action: 'CREDIT_INTEREST_REVERSED', entityType: 'Customer', entityId: original.customerId, newValue: { chargeId, amount: original.debitAmount, reason } })
      return { success: true, data: { chargeId, amount: original.debitAmount } }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to reverse interest charge.' } }
    }
  }
}
