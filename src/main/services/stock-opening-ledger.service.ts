import { getPrisma } from '../database/db'
import { chartOfAccountsService } from './chart-of-accounts.service'
import { journalEntryService } from './journal-entry.service'
import { getProductCostsBatch } from './valuation.service'
import { roundMoney } from '../../shared/utils/money'
import { getActiveCurrencyDecimals } from './currency.service'

const FLAG = 'stock_ledger_opening_posted'

// Installs from before stock was kept in the ledger have goods on the shelf but nothing in the Inventory account.
// Once, on first start after the upgrade, that stock is brought in at cost against Owner's Capital, so later sales
// (which take cost out of Inventory) do not push the account below zero. New installs have no stock and just get the flag.
export async function ensureOpeningStockPosted(): Promise<void> {
  const db = getPrisma()
  if (await db.setting.findUnique({ where: { settingKey: FLAG } })) return
  await chartOfAccountsService.ensureSystemAccountsSeeded()
  await db.$transaction(async (tx) => {
    const inventoryAccount = await chartOfAccountsService.getOrCreateSystemAccountByCode('1200', tx)
    const posted = await tx.journalEntryLine.count({ where: { accountId: inventoryAccount.id } })
    if (posted === 0) {
      const stock = await tx.inventory.findMany({ where: { quantity: { gt: 0 } }, select: { productId: true, quantity: true } })
      const costs = await getProductCostsBatch(stock.map((s) => s.productId), tx)
      const value = roundMoney(stock.reduce((s, r) => s + r.quantity * (costs.get(r.productId) ?? 0), 0), getActiveCurrencyDecimals())
      if (value > 0) {
        const capital = await chartOfAccountsService.getSystemAccountByCode('3000', tx)
        await journalEntryService.postSystemEntry(tx, {
          sourceType: 'STOCK_OPENING', narration: 'Opening stock brought into the books',
          lines: [
            { accountId: inventoryAccount.id, bankAccountId: null, debitAmount: value, creditAmount: 0 },
            { accountId: capital.id, bankAccountId: null, debitAmount: 0, creditAmount: value }
          ]
        })
      }
    }
    await tx.setting.create({ data: { settingKey: FLAG, settingValue: 'true', settingType: 'BOOLEAN' } })
  })
}
