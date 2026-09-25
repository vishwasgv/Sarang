import { getPrisma } from '../database/db'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { roundMoney } from '../../shared/utils/money'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

export interface JournalLineDraft {
  accountId: string
  bankAccountId: null
  costCentreId?: string | null
  debitAmount: number
  creditAmount: number
}

export interface PurchaseAccounts {
  expenseId: string
  apId: string
  taxPayableId?: string
  itcId?: string
}

/** Input tax is claimable unless the business is on the composition scheme. */
export async function isInputTaxClaimable(tx: TxClient): Promise<boolean> {
  const profile = await tx.businessProfile.findFirst({ select: { gstScheme: true } })
  return profile?.gstScheme !== 'COMPOSITION'
}

export async function loadPurchaseAccounts(tx: TxClient, needsTaxPayable: boolean, needsItc: boolean): Promise<PurchaseAccounts> {
  const [expense, ap, taxPayable, itc] = await Promise.all([
    chartOfAccountsService.getSystemAccountByCode('6000', tx),
    chartOfAccountsService.getSystemAccountByCode('2000', tx),
    needsTaxPayable ? chartOfAccountsService.getSystemAccountByCode('2100', tx) : Promise.resolve(null),
    needsItc ? chartOfAccountsService.getOrCreateSystemAccountByCode('1300', tx) : Promise.resolve(null)
  ])
  return { expenseId: expense.id, apId: ap.id, taxPayableId: taxPayable?.id, itcId: itc?.id }
}

/**
 * A purchase (bill or received PO). `total` is what the supplier is owed: tax-inclusive normally,
 * tax-exclusive under reverse charge (the tax is then self-assessed into Tax Payable).
 * Claimable input tax goes to Input Tax Credit; otherwise it stays in the cost.
 */
export function purchaseJournalLines(p: {
  total: number
  tax: number
  isReverseCharge: boolean
  claimable: boolean
  accounts: PurchaseAccounts
  costCentreId?: string | null
}): JournalLineDraft[] {
  const { total, tax, isReverseCharge, claimable, accounts, costCentreId = null } = p
  const line = (accountId: string, debitAmount: number, creditAmount: number): JournalLineDraft => ({ accountId, bankAccountId: null, costCentreId, debitAmount, creditAmount })
  const hasTax = tax > 0
  const toItc = hasTax && claimable && !!accounts.itcId
  const lines: JournalLineDraft[] = []

  if (isReverseCharge && hasTax) {
    lines.push(line(accounts.expenseId, toItc ? total : roundMoney(total + tax, 3), 0))
    if (toItc) lines.push(line(accounts.itcId!, tax, 0))
    lines.push(line(accounts.apId, 0, total))
    lines.push(line(accounts.taxPayableId!, 0, tax))
    return lines
  }
  lines.push(line(accounts.expenseId, toItc ? roundMoney(total - tax, 3) : total, 0))
  if (toItc) lines.push(line(accounts.itcId!, tax, 0))
  lines.push(line(accounts.apId, 0, total))
  return lines
}

/** A debit note reverses a purchase: Dr Accounts Payable (total), Cr Purchases (net) and Cr Input Tax Credit (tax, when claimable). */
export function debitNoteJournalLines(p: { amount: number; tax: number; claimable: boolean; accounts: PurchaseAccounts }): JournalLineDraft[] {
  const { amount, tax, claimable, accounts } = p
  const toItc = tax > 0 && claimable && !!accounts.itcId
  const lines: JournalLineDraft[] = [{ accountId: accounts.apId, bankAccountId: null, debitAmount: amount, creditAmount: 0 }]
  lines.push({ accountId: accounts.expenseId, bankAccountId: null, debitAmount: 0, creditAmount: toItc ? roundMoney(amount - tax, 3) : amount })
  if (toItc) lines.push({ accountId: accounts.itcId!, bankAccountId: null, debitAmount: 0, creditAmount: tax })
  return lines
}
