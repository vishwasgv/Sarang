import { getPrisma } from '../database/db'
import { roundMoney } from '../../shared/utils/money'
import { getProductCostsBatch } from './valuation.service'

// The ledger holds no stock asset and no cost of goods (purchases are expensed when billed), so the ratios that need
// them read the stock records: stock value is quantity on hand at each item's cost, cost of sales is quantity sold at cost.
export async function stockValueAndCostOfSales(from: Date, to: Date, decimals: number): Promise<{ stockValue: number; costOfSales: number }> {
  const db = getPrisma()
  const [stock, sales] = await Promise.all([
    db.inventory.findMany({ select: { productId: true, quantity: true } }),
    db.invoice.findMany({
      where: { status: { notIn: ['CANCELLED', 'SPLIT'] }, invoiceDate: { gte: from, lte: to } },
      select: { invoiceType: true, items: { select: { productId: true, quantity: true } } }
    })
  ])
  const costs = await getProductCostsBatch([...stock.map((s) => s.productId), ...sales.flatMap((i) => i.items.map((it) => it.productId))])
  const stockValue = roundMoney(stock.reduce((s, r) => s + Math.max(0, r.quantity) * (costs.get(r.productId) ?? 0), 0), decimals)
  const costOfSales = roundMoney(sales.reduce((s, inv) => s + (inv.invoiceType === 'RETURN' ? -1 : 1) * inv.items.reduce((t, it) => t + it.quantity * (costs.get(it.productId) ?? 0), 0), 0), decimals)
  return { stockValue, costOfSales }
}
