import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { customerLedgerService } from './customer-ledger.service'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { journalEntryService } from './journal-entry.service'
import { roundCurrency, sumCurrency } from './currency.service'

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
    const db = getPrisma()
    try {
      const preview = await this.calculateInterest(customerId)
      if (!preview.success) return preview
      const { totalInterest, lines } = preview.data as { totalInterest: number; lines: Array<{ invoiceNumber: string }> }
      if (totalInterest <= 0) return { success: false, error: { code: 'CI-002', message: 'No interest is currently due for this customer.' } }

      const customer = await db.customer.findUnique({ where: { id: customerId } })
      if (!customer) return { success: false, error: { code: 'CUS-001', message: 'Customer not found.' } }

      await db.$transaction(async (tx: TxClient) => {
        await customerLedgerService.addEntry({
          customerId,
          referenceType: 'INTEREST_CHARGE',
          debitAmount: totalInterest,
          creditAmount: 0,
          remarks: `Overdue interest on ${lines.length} invoice${lines.length === 1 ? '' : 's'}`
        }, tx)

        const [arAccount, interestAccount] = await Promise.all([
          chartOfAccountsService.getSystemAccountByCode('1100', tx),
          chartOfAccountsService.getSystemAccountByCode('4100', tx)
        ])
        await journalEntryService.postSystemEntry(tx, {
          sourceType: 'INTEREST_CHARGE', sourceId: customerId, narration: `Overdue interest — ${customer.customerName}`,
          lines: [
            { accountId: arAccount.id, bankAccountId: null, debitAmount: totalInterest, creditAmount: 0 },
            { accountId: interestAccount.id, bankAccountId: null, debitAmount: 0, creditAmount: totalInterest }
          ]
        })
      })

      await logAction({ userId, action: 'CREDIT_INTEREST_CHARGED', entityType: 'Customer', entityId: customerId, newValue: { totalInterest, invoiceCount: lines.length } })
      return { success: true, data: { totalInterest, invoiceCount: lines.length } }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to post interest charge.' } }
    }
  }
}
