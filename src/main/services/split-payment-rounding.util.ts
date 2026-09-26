import type { getPrisma } from '../database/db'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { customerLedgerService } from './customer-ledger.service'
import { journalEntryService } from './journal-entry.service'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

export const PAYMENT_ROUNDING = 'PAYMENT_ROUNDING'

// A split payment may fall a few minor units short of the balance and still settle the invoice. The invoice is closed
// for its whole balance, so the shortfall is written off here (Dr Sales Revenue / Cr Accounts Receivable, and a credit on
// the customer's account), which keeps the ledger, the customer's account and the invoice in step.
export async function writeOffSplitShortfallTx(
  tx: TxClient,
  invoice: { id: string; invoiceNumber: string; customerId: string | null },
  shortfall: number
): Promise<void> {
  if (!(shortfall > 0)) return
  const [receivable, sales] = await Promise.all([
    chartOfAccountsService.getSystemAccountByCode('1100', tx),
    chartOfAccountsService.getSystemAccountByCode('4000', tx)
  ])
  await journalEntryService.postSystemEntry(tx, {
    sourceType: PAYMENT_ROUNDING,
    sourceId: invoice.id,
    narration: `Rounding on payment for Invoice ${invoice.invoiceNumber}`,
    lines: [
      { accountId: sales.id, bankAccountId: null, debitAmount: shortfall, creditAmount: 0 },
      { accountId: receivable.id, bankAccountId: null, debitAmount: 0, creditAmount: shortfall }
    ]
  })
  if (invoice.customerId) {
    await customerLedgerService.addEntry({
      customerId: invoice.customerId,
      referenceType: PAYMENT_ROUNDING,
      referenceId: invoice.id,
      debitAmount: 0,
      creditAmount: shortfall,
      remarks: `Rounding on payment for Invoice ${invoice.invoiceNumber}`
    }, tx)
  }
}
