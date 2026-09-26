import type { getPrisma } from '../database/db'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { journalEntryService } from './journal-entry.service'
import { roundMoney } from '../../shared/utils/money'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

// A sales return reverses a sale: Dr Sales Revenue (taxable) and Dr Tax Payable (tax), Cr Accounts Receivable
// (the customer's credit) or, for a walk-in with no customer account, Cr Cash (the money handed back).
export async function postReturnJournalTx(
  tx: TxClient,
  ret: { id: string; invoiceNumber: string; totalAmount: number; taxAmount: number; customerId: string | null }
): Promise<void> {
  const total = Math.abs(ret.totalAmount)
  if (!(total > 0)) return
  const tax = Math.abs(ret.taxAmount)
  const taxable = roundMoney(total - tax, 3)
  const [creditAccount, salesAccount] = await Promise.all([
    chartOfAccountsService.getSystemAccountByCode(ret.customerId ? '1100' : '1000', tx),
    chartOfAccountsService.getSystemAccountByCode('4000', tx)
  ])
  const lines = [{ accountId: creditAccount.id, bankAccountId: null, debitAmount: 0, creditAmount: total }]
  if (taxable > 0) lines.push({ accountId: salesAccount.id, bankAccountId: null, debitAmount: taxable, creditAmount: 0 })
  if (tax > 0) {
    const taxAccount = await chartOfAccountsService.getSystemAccountByCode('2100', tx)
    lines.push({ accountId: taxAccount.id, bankAccountId: null, debitAmount: tax, creditAmount: 0 })
  }
  await journalEntryService.postSystemEntry(tx, { sourceType: 'SALES_RETURN', sourceId: ret.id, narration: `Sales return ${ret.invoiceNumber}`, lines })
}
