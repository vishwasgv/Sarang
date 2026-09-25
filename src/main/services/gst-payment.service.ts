import { getPrisma } from '../database/db'
import { ServiceError } from '../errors/service-error'
import { parseLocalDateStart, toLocalISODate } from '../utils/date.util'
import { getBusinessCurrencyDecimals } from './settings.service'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { journalEntryService } from './journal-entry.service'
import { assertNotLockedOrThrow } from './transaction-lock.service'
import { logAction } from './audit.service'
import { roundMoney, sumMoney } from '../../shared/utils/money'
import type { CreateGstPaymentPayload } from '../validation/gst-payment.validation'

// Paying GST to the government: the tax payable balance (2100) is cleared by input tax credit (1300) and
// by cash or bank money (1000). A void reverses the whole entry. Stored as a journal entry of source type
// GST_PAYMENT, so it shows in the ledger, day book and cash flow like any other posting.

export const GST_PAYMENT_SOURCE = 'GST_PAYMENT'

export interface GstPaymentRow {
  id: string
  entryNumber: string
  date: string
  narration: string | null
  taxAmount: number
  creditUsed: number
  cashPaid: number
  isReversed: boolean
}

export function checkGstPaymentSplit(taxAmount: number, creditUsed: number, cashPaid: number, decimals: number): string | null {
  if (roundMoney(sumMoney([creditUsed, cashPaid], decimals) - taxAmount, decimals) !== 0) {
    return 'Credit used plus cash paid must equal the tax amount.'
  }
  return null
}

function narrationOf(p: CreateGstPaymentPayload): string {
  return ['GST payment', p.reference ? `ref ${p.reference}` : '', p.notes ?? ''].filter(Boolean).join(' - ')
}

export const gstPaymentService = {
  async record(payload: CreateGstPaymentPayload, userId?: string) {
    const decimals = await getBusinessCurrencyDecimals()
    const db = getPrisma()
    try {
      const taxAmount = roundMoney(payload.taxAmount, decimals)
      const creditUsed = roundMoney(payload.creditUsed, decimals)
      const cashPaid = roundMoney(payload.cashPaid, decimals)
      const splitError = checkGstPaymentSplit(taxAmount, creditUsed, cashPaid, decimals)
      if (splitError) return { success: false, error: { code: 'GSTPAY-001', message: splitError } }

      if (payload.bankAccountId && cashPaid > 0) {
        const bank = await db.bankAccount.findUnique({ where: { id: payload.bankAccountId } })
        if (!bank) return { success: false, error: { code: 'BANK-001', message: 'Bank account not found.' } }
      }

      const date = parseLocalDateStart(payload.paymentDate)
      const entry = await db.$transaction(async (tx) => {
        await assertNotLockedOrThrow(tx, date)
        if (creditUsed > 0) {
          const itc = await tx.journalEntryLine.aggregate({ where: { account: { accountCode: '1300' } }, _sum: { debitAmount: true, creditAmount: true } })
          const available = roundMoney((itc._sum.debitAmount ?? 0) - (itc._sum.creditAmount ?? 0), decimals)
          if (creditUsed > available) throw new ServiceError('GSTPAY-002', 'The credit used is more than the input tax credit available.')
        }
        const taxPayable = await chartOfAccountsService.getSystemAccountByCode('2100', tx)
        const lines = [{ accountId: taxPayable.id, bankAccountId: null as string | null, debitAmount: taxAmount, creditAmount: 0 }]
        if (creditUsed > 0) {
          const itcAccount = await chartOfAccountsService.getOrCreateSystemAccountByCode('1300', tx)
          lines.push({ accountId: itcAccount.id, bankAccountId: null, debitAmount: 0, creditAmount: creditUsed })
        }
        if (cashPaid > 0) {
          const cash = await chartOfAccountsService.getSystemAccountByCode('1000', tx)
          lines.push({ accountId: cash.id, bankAccountId: payload.bankAccountId ?? null, debitAmount: 0, creditAmount: cashPaid })
        }
        return journalEntryService.postSystemEntry(tx, { sourceType: GST_PAYMENT_SOURCE, narration: narrationOf(payload), entryDate: date, lines })
      })

      await logAction({ userId, action: 'GST_PAYMENT_RECORDED', entityType: 'JournalEntry', entityId: entry.id, newValue: { taxAmount, creditUsed, cashPaid } })
      return { success: true, data: { id: entry.id, entryNumber: entry.entryNumber } }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to record the GST payment.' } }
    }
  },

  async list() {
    try {
      const db = getPrisma()
      const entries = await db.journalEntry.findMany({
        where: { sourceType: GST_PAYMENT_SOURCE },
        include: { lines: { include: { account: { select: { accountCode: true } } } } },
        orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
        take: 500
      })
      const rows: GstPaymentRow[] = entries
        // A reversal entry is not a payment of its own; the original row is shown as reversed.
        .filter((e) => !e.narration?.startsWith('Reversal of '))
        .map((e) => {
          const on = (code: string) => e.lines.filter((l) => l.account.accountCode === code)
          return {
            id: e.id,
            entryNumber: e.entryNumber,
            date: toLocalISODate(e.entryDate),
            narration: e.narration,
            taxAmount: sumMoney(on('2100').map((l) => l.debitAmount), 3),
            creditUsed: sumMoney(on('1300').map((l) => l.creditAmount), 3),
            cashPaid: sumMoney(on('1000').map((l) => l.creditAmount), 3),
            isReversed: e.isReversed
          }
        })
      return { success: true, data: rows }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to load GST payments.' } }
    }
  },

  async void(id: string, reason: string, userId?: string) {
    const db = getPrisma()
    const entry = await db.journalEntry.findUnique({ where: { id }, select: { sourceType: true } })
    if (!entry || entry.sourceType !== GST_PAYMENT_SOURCE) return { success: false, error: { code: 'GSTPAY-003', message: 'GST payment not found.' } }
    return journalEntryService.reverseJournalEntry(id, reason, userId)
  }
}
