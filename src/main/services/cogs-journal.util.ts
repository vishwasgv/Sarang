import type { getPrisma } from '../database/db'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { journalEntryService } from './journal-entry.service'
import { getProductCostsBatch } from './valuation.service'
import { explodeKitComponentsTx } from './kit.service'
import { roundMoney } from '../../shared/utils/money'
import { getActiveCurrencyDecimals } from './currency.service'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

export const INVOICE_COGS = 'INVOICE_COGS'
export const RETURN_COGS = 'SALES_RETURN_COGS'

// Perpetual stock accounting: when goods are sold their cost leaves the stock asset and becomes the cost of goods sold
// (Dr Cost of Goods Sold / Cr Inventory). The unit cost is kept on each line so a later return puts back exactly that cost.
export async function postCogsJournalTx(tx: TxClient, invoice: { id: string; invoiceNumber: string; costCentreId?: string | null }): Promise<void> {
  const items = await tx.invoiceItem.findMany({
    where: { invoiceId: invoice.id },
    select: { id: true, productId: true, quantity: true, product: { select: { productType: true, isKit: true } } }
  })
  const stocked = items.filter((i) => i.product.productType === 'STANDARD')
  if (stocked.length === 0) return
  // A kit is never stocked itself: selling it takes its parts out, so its cost is the cost of those parts.
  const kitParts = new Map<string, Array<{ componentProductId: string; quantity: number }>>()
  for (const i of stocked) if (i.product.isKit && !kitParts.has(i.productId)) kitParts.set(i.productId, await explodeKitComponentsTx(tx, i.productId, 1))
  const costs = await getProductCostsBatch([...stocked.filter((i) => !i.product.isKit).map((i) => i.productId), ...[...kitParts.values()].flat().map((c) => c.componentProductId)], tx)
  let total = 0
  for (const i of stocked) {
    const unit = i.product.isKit
      ? (kitParts.get(i.productId) ?? []).reduce((sum, c) => sum + c.quantity * (costs.get(c.componentProductId) ?? 0), 0)
      : (costs.get(i.productId) ?? 0)
    if (unit <= 0) continue
    total += i.quantity * unit
    await tx.invoiceItem.update({ where: { id: i.id }, data: { costAtSale: unit } })
  }
  total = roundMoney(total, getActiveCurrencyDecimals())
  if (total <= 0) return
  await postCostEntry(tx, INVOICE_COGS, invoice.id, `Cost of goods sold, invoice ${invoice.invoiceNumber}`, total, false, invoice.costCentreId ?? null)
}

// A return brings the goods back at the cost they left at: Dr Inventory / Cr Cost of Goods Sold.
export async function postReturnCogsJournalTx(tx: TxClient, returnInvoice: { id: string; invoiceNumber: string }, originalInvoiceId: string): Promise<void> {
  const [returned, original] = await Promise.all([
    tx.invoiceItem.findMany({ where: { invoiceId: returnInvoice.id }, select: { id: true, productId: true, variantId: true, quantity: true } }),
    tx.invoiceItem.findMany({ where: { invoiceId: originalInvoiceId }, select: { productId: true, variantId: true, costAtSale: true } })
  ])
  let total = 0
  for (const r of returned) {
    const src = original.find((o) => o.productId === r.productId && (o.variantId ?? null) === (r.variantId ?? null))
    const unit = src?.costAtSale ?? 0
    if (unit <= 0) continue
    total += Math.abs(r.quantity) * unit
    await tx.invoiceItem.update({ where: { id: r.id }, data: { costAtSale: unit } })
  }
  total = roundMoney(total, getActiveCurrencyDecimals())
  if (total <= 0) return
  await postCostEntry(tx, RETURN_COGS, returnInvoice.id, `Cost of goods returned, ${returnInvoice.invoiceNumber}`, total, true, null)
}

async function postCostEntry(tx: TxClient, sourceType: string, sourceId: string, narration: string, amount: number, intoStock: boolean, costCentreId: string | null): Promise<void> {
  const [cogs, inventory] = await Promise.all([
    chartOfAccountsService.getSystemAccountByCode('5000', tx),
    chartOfAccountsService.getOrCreateSystemAccountByCode('1200', tx)
  ])
  await journalEntryService.postSystemEntry(tx, {
    sourceType, sourceId, narration,
    lines: [
      { accountId: intoStock ? inventory.id : cogs.id, bankAccountId: null, costCentreId, debitAmount: amount, creditAmount: 0 },
      { accountId: intoStock ? cogs.id : inventory.id, bankAccountId: null, costCentreId, debitAmount: 0, creditAmount: amount }
    ]
  })
}
