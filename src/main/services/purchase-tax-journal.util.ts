import { getPrisma } from '../database/db'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { roundMoney } from '../../shared/utils/money'
import { getActiveCurrencyDecimals } from './currency.service'

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
  /** Inventory (stock asset); goods bought are debited here, services and other costs to expenseId. */
  inventoryId?: string
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
  const [expense, ap, taxPayable, itc, inventory] = await Promise.all([
    chartOfAccountsService.getSystemAccountByCode('6000', tx),
    chartOfAccountsService.getSystemAccountByCode('2000', tx),
    needsTaxPayable ? chartOfAccountsService.getSystemAccountByCode('2100', tx) : Promise.resolve(null),
    needsItc ? chartOfAccountsService.getOrCreateSystemAccountByCode('1300', tx) : Promise.resolve(null),
    chartOfAccountsService.getOrCreateSystemAccountByCode('1200', tx)
  ])
  return { expenseId: expense.id, inventoryId: inventory.id, apId: ap.id, taxPayableId: taxPayable?.id, itcId: itc?.id }
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
  /** Share (0 to 1) of the cost that is goods for stock; the rest is a service or other expense. */
  goodsShare?: number
}): JournalLineDraft[] {
  const { total, tax, isReverseCharge, claimable, accounts, costCentreId = null, goodsShare = 0 } = p
  const line = (accountId: string, debitAmount: number, creditAmount: number): JournalLineDraft => ({ accountId, bankAccountId: null, costCentreId, debitAmount, creditAmount })
  const hasTax = tax > 0
  const toItc = hasTax && claimable && !!accounts.itcId
  const lines: JournalLineDraft[] = []
  // Goods go to the stock asset, everything else to expense, so the two add up to the amount that would have been expensed.
  const cost = (amount: number) => {
    const goods = accounts.inventoryId && goodsShare > 0 ? roundMoney(amount * Math.min(1, goodsShare), getActiveCurrencyDecimals()) : 0
    if (goods > 0) lines.push(line(accounts.inventoryId!, goods, 0))
    if (amount - goods > 0.0000001) lines.push(line(accounts.expenseId, roundMoney(amount - goods, 3), 0))
  }

  if (isReverseCharge && hasTax) {
    cost(toItc ? total : roundMoney(total + tax, 3))
    if (toItc) lines.push(line(accounts.itcId!, tax, 0))
    lines.push(line(accounts.apId, 0, total))
    lines.push(line(accounts.taxPayableId!, 0, tax))
    return lines
  }
  cost(toItc ? roundMoney(total - tax, 3) : total)
  if (toItc) lines.push(line(accounts.itcId!, tax, 0))
  lines.push(line(accounts.apId, 0, total))
  return lines
}

/** A debit note reverses a purchase: Dr Accounts Payable (total), Cr Purchases (net) and Cr Input Tax Credit (tax, when claimable). */
export function debitNoteJournalLines(p: { amount: number; tax: number; claimable: boolean; accounts: PurchaseAccounts; goodsShare?: number }): JournalLineDraft[] {
  const { amount, tax, claimable, accounts, goodsShare = 0 } = p
  const toItc = tax > 0 && claimable && !!accounts.itcId
  const lines: JournalLineDraft[] = [{ accountId: accounts.apId, bankAccountId: null, debitAmount: amount, creditAmount: 0 }]
  const net = toItc ? roundMoney(amount - tax, 3) : amount
  const goods = accounts.inventoryId && goodsShare > 0 ? roundMoney(net * Math.min(1, goodsShare), getActiveCurrencyDecimals()) : 0
  if (goods > 0) lines.push({ accountId: accounts.inventoryId!, bankAccountId: null, debitAmount: 0, creditAmount: goods })
  if (net - goods > 0.0000001) lines.push({ accountId: accounts.expenseId, bankAccountId: null, debitAmount: 0, creditAmount: roundMoney(net - goods, 3) })
  if (toItc) lines.push({ accountId: accounts.itcId!, bankAccountId: null, debitAmount: 0, creditAmount: tax })
  return lines
}

/** Share of a purchase's value that is goods for stock (lines with a product) as opposed to services. */
export function goodsShareOf(items: Array<{ productId?: string | null; total: number }>): number {
  const all = items.reduce((s, i) => s + Math.abs(i.total), 0)
  if (all <= 0) return 0
  return items.filter((i) => !!i.productId).reduce((s, i) => s + Math.abs(i.total), 0) / all
}

export async function billGoodsShareTx(tx: TxClient, billId: string): Promise<number> {
  return goodsShareOf(await tx.billItem.findMany({ where: { billId }, select: { productId: true, total: true } }))
}

export async function orderGoodsShareTx(tx: TxClient, purchaseOrderId: string): Promise<number> {
  return goodsShareOf(await tx.purchaseOrderItem.findMany({ where: { purchaseOrderId }, select: { productId: true, total: true } }))
}

/** A debit note against a purchase order returns goods in the order's proportion; a free-standing note stays an expense credit. */
export async function noteGoodsShareTx(tx: TxClient, debitNoteId: string): Promise<number> {
  const linked = await tx.debitNote.findUnique({ where: { id: debitNoteId }, select: { purchaseOrderId: true } })
  return linked?.purchaseOrderId ? orderGoodsShareTx(tx, linked.purchaseOrderId) : 0
}
