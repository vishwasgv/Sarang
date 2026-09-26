import type { getPrisma } from '../database/db'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { journalEntryService } from './journal-entry.service'
import { roundMoney } from '../../shared/utils/money'
import { getActiveCurrencyDecimals } from './currency.service'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

// Stock put in by hand (opening stock, found stock): Dr Inventory / Cr Owner's Capital, so the stock asset matches the shelf.
export async function postManualStockInTx(tx: TxClient, p: { productId: string; productName: string; quantity: number; unitCost: number }): Promise<void> {
  const amount = roundMoney(p.quantity * p.unitCost, getActiveCurrencyDecimals())
  if (!(amount > 0)) return
  const [inventory, capital] = await Promise.all([
    chartOfAccountsService.getOrCreateSystemAccountByCode('1200', tx),
    chartOfAccountsService.getSystemAccountByCode('3000', tx)
  ])
  await journalEntryService.postSystemEntry(tx, {
    sourceType: 'STOCK_IN', sourceId: p.productId, narration: `Stock added by hand: ${p.productName}`,
    lines: [
      { accountId: inventory.id, bankAccountId: null, debitAmount: amount, creditAmount: 0 },
      { accountId: capital.id, bankAccountId: null, debitAmount: 0, creditAmount: amount }
    ]
  })
}

// A recount, damage or expiry changes the stock asset against Cost of Goods Sold: a shortage is a cost, a surplus reduces it.
export async function postStockAdjustmentTx(tx: TxClient, p: { productId: string; productName: string; difference: number; unitCost: number }): Promise<void> {
  const amount = roundMoney(Math.abs(p.difference) * p.unitCost, getActiveCurrencyDecimals())
  if (!(amount > 0)) return
  const [inventory, cogs] = await Promise.all([
    chartOfAccountsService.getOrCreateSystemAccountByCode('1200', tx),
    chartOfAccountsService.getSystemAccountByCode('5000', tx)
  ])
  const gain = p.difference > 0
  await journalEntryService.postSystemEntry(tx, {
    sourceType: 'STOCK_ADJUSTMENT', sourceId: p.productId, narration: `Stock ${gain ? 'surplus' : 'shortage'}: ${p.productName}`,
    lines: [
      { accountId: gain ? inventory.id : cogs.id, bankAccountId: null, debitAmount: amount, creditAmount: 0 },
      { accountId: gain ? cogs.id : inventory.id, bankAccountId: null, debitAmount: 0, creditAmount: amount }
    ]
  })
}
