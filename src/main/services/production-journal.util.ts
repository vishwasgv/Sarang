import type { getPrisma } from '../database/db'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { journalEntryService } from './journal-entry.service'
import { roundMoney } from '../../shared/utils/money'
import { getActiveCurrencyDecimals } from './currency.service'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

// Finished goods come into stock at what they cost to make. The parts taken from stock already left Inventory's value with
// them, so only the rest (raw materials, labour, overhead) is new value in stock. That cost was expensed when it was spent,
// so it is moved out of expense into Inventory: Dr Inventory / Cr Operating Expenses.
export async function postProductionCostTx(tx: TxClient, p: { orderNumber: string; totalCost: number; componentCost: number }): Promise<void> {
  const amount = roundMoney(p.totalCost - p.componentCost, getActiveCurrencyDecimals())
  if (!(amount > 0)) return
  const [inventory, expense] = await Promise.all([
    chartOfAccountsService.getOrCreateSystemAccountByCode('1200', tx),
    chartOfAccountsService.getSystemAccountByCode('6000', tx)
  ])
  await journalEntryService.postSystemEntry(tx, {
    sourceType: 'PRODUCTION_COST', narration: `Production ${p.orderNumber}: cost moved into stock`,
    lines: [
      { accountId: inventory.id, bankAccountId: null, debitAmount: amount, creditAmount: 0 },
      { accountId: expense.id, bankAccountId: null, debitAmount: 0, creditAmount: amount }
    ]
  })
}
