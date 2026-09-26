import { ServiceError } from '../errors/service-error'
import type { getPrisma } from '../database/db'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { customerLedgerService } from './customer-ledger.service'
import { journalEntryService, reverseEntryBySourceTx } from './journal-entry.service'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

// Money taken at the till when a sale is made never gets its own PAYMENT entry: the sale itself debits Cash.
// Reversing that payment therefore has nothing to undo, so the reversal is posted here as Dr Receivable / Cr Cash.
// Cancelling the invoice later reverses these entries as well, so cash is not credited twice.
export const CASH_SALE_PAYMENT_REVERSAL = 'CASH_SALE_PAYMENT_REVERSAL'

export async function reversePaymentJournalTx(
  tx: TxClient,
  payment: { id: string; invoiceId: string; amount: number },
  invoiceNumber: string,
  reason: string,
  userId?: string
): Promise<void> {
  const own = await tx.journalEntry.findFirst({ where: { sourceType: 'PAYMENT', sourceId: payment.id, isReversed: false } })
  if (own) {
    await reverseEntryBySourceTx(tx, 'PAYMENT', payment.id, reason, userId)
    return
  }
  const [cash, receivable] = await Promise.all([
    chartOfAccountsService.getSystemAccountByCode('1000', tx),
    chartOfAccountsService.getSystemAccountByCode('1100', tx)
  ])
  const invoiceEntry = await tx.journalEntry.findFirst({ where: { sourceType: 'INVOICE', sourceId: payment.invoiceId, isReversed: false }, include: { lines: true } })
  if (!invoiceEntry) return
  const cashTaken = invoiceEntry.lines.filter((l) => l.accountId === cash.id).reduce((s, l) => s + l.debitAmount, 0)
  if (cashTaken <= 0) return
  const alreadyUndone = await tx.journalEntry.findMany({ where: { sourceType: CASH_SALE_PAYMENT_REVERSAL, sourceId: payment.invoiceId, isReversed: false }, include: { lines: true } })
  const undone = alreadyUndone.reduce((s, e) => s + e.lines.filter((l) => l.accountId === receivable.id).reduce((t, l) => t + l.debitAmount, 0), 0)
  const amount = Math.min(payment.amount, cashTaken - undone)
  if (amount <= 0) return
  await journalEntryService.postSystemEntry(tx, {
    sourceType: CASH_SALE_PAYMENT_REVERSAL,
    sourceId: payment.invoiceId,
    narration: `${reason} (Invoice ${invoiceNumber})`,
    lines: [
      { accountId: receivable.id, bankAccountId: null, debitAmount: amount, creditAmount: 0 },
      { accountId: cash.id, bankAccountId: null, debitAmount: 0, creditAmount: amount }
    ]
  })
}

// On cancelling an invoice: undo the entry of every payment still standing, and any till-payment reversals.
export async function reverseInvoicePaymentEntriesTx(tx: TxClient, invoiceId: string, livePaymentIds: string[], reason: string, userId?: string): Promise<void> {
  for (const id of livePaymentIds) await reverseEntryBySourceTx(tx, 'PAYMENT', id, reason, userId)
  await reverseEntryBySourceTx(tx, 'INVOICE_COGS', invoiceId, reason, userId)
  for (;;) {
    const e = await tx.journalEntry.findFirst({ where: { sourceType: CASH_SALE_PAYMENT_REVERSAL, sourceId: invoiceId, isReversed: false } })
    if (!e) break
    await reverseEntryBySourceTx(tx, CASH_SALE_PAYMENT_REVERSAL, invoiceId, reason, userId)
  }
  for (;;) {
    const e = await tx.journalEntry.findFirst({ where: { sourceType: 'PAYMENT_ROUNDING', sourceId: invoiceId, isReversed: false } })
    if (!e) break
    await reverseEntryBySourceTx(tx, 'PAYMENT_ROUNDING', invoiceId, reason, userId)
  }
}

// After the invoice's own ledger entries and its live payments are undone, whatever is still open against the
// invoice or its payments (e.g. the debit posted when a till payment was reversed earlier) is cleared, so a
// cancelled invoice leaves nothing on the customer's account.
export async function clearInvoiceLedgerRemainderTx(tx: TxClient, invoice: { id: string; invoiceNumber: string; customerId: string | null }, remarks: string): Promise<void> {
  if (!invoice.customerId) return
  const payments = await tx.payment.findMany({ where: { invoiceId: invoice.id }, select: { id: true } })
  const ids = [invoice.id, ...payments.map((p) => p.id)]
  const rows = await tx.customerLedger.findMany({
    where: { customerId: invoice.customerId, referenceId: { in: ids }, referenceType: { in: ['INVOICE', 'INVOICE_CANCEL', 'PAYMENT', 'PAYMENT_REVERSAL', 'PAYMENT_ROUNDING'] } }
  })
  const net = rows.reduce((s, r) => s + r.debitAmount - r.creditAmount, 0)
  if (Math.abs(net) < 0.0005) return
  await customerLedgerService.addEntry({
    customerId: invoice.customerId,
    referenceType: 'INVOICE_CANCEL',
    referenceId: invoice.id,
    debitAmount: net < 0 ? -net : 0,
    creditAmount: net > 0 ? net : 0,
    remarks
  }, tx)
}

// A return already put its goods back and reversed its share of the sale, so cancelling the whole invoice on top of it
// would restore those goods and reverse that revenue a second time.
export async function assertNoReturnsTx(tx: TxClient, invoiceId: string): Promise<void> {
  const returns = await tx.invoice.count({ where: { originalInvoiceId: invoiceId, invoiceType: 'RETURN' } })
  if (returns > 0) throw new ServiceError('INVOC-019', 'This invoice has sales returns against it, so it cannot be cancelled. Return the remaining items instead.')
}
