import { getPrisma } from '../database/db'
import { roundMoney, sumMoney } from '../../shared/utils/money'

// Stock promised to customers on open sales orders (confirmed or part-invoiced): ordered minus already invoiced.
// Worked out from the orders themselves, so it can never drift from them.

const OPEN_STATUSES = ['CONFIRMED', 'PARTIALLY_INVOICED']

export async function reservedBySalesOrders(productIds?: string[]): Promise<Map<string, number>> {
  const items = await getPrisma().salesOrderItem.findMany({
    where: { productId: productIds ? { in: productIds } : { not: null }, salesOrder: { status: { in: OPEN_STATUSES } } },
    select: { productId: true, quantity: true, invoicedQty: true }
  })
  const parts = new Map<string, number[]>()
  for (const i of items) {
    if (!i.productId) continue
    const open = roundMoney(i.quantity - i.invoicedQty, 3)
    if (open > 0) parts.set(i.productId, [...(parts.get(i.productId) ?? []), open])
  }
  return new Map(Array.from(parts.entries()).map(([id, list]) => [id, sumMoney(list, 3)]))
}

/** Lines of one order that ask for more than is free after other orders' reservations. */
export async function stockShortagesForOrder(salesOrderId: string): Promise<Array<{ productId: string; productName: string; needed: number; available: number }>> {
  const db = getPrisma()
  const lines = await db.salesOrderItem.findMany({
    where: { salesOrderId, productId: { not: null }, product: { productType: 'STANDARD' } },
    select: { productId: true, quantity: true, invoicedQty: true, product: { select: { productName: true } } }
  })
  const ids = lines.map((l) => l.productId as string)
  if (ids.length === 0) return []
  const [stock, reserved] = await Promise.all([
    db.inventory.findMany({ where: { productId: { in: ids } }, select: { productId: true, quantity: true } }),
    reservedBySalesOrders(ids)
  ])
  const onHand = new Map(stock.map((s) => [s.productId, s.quantity]))
  const out: Array<{ productId: string; productName: string; needed: number; available: number }> = []
  for (const l of lines) {
    const id = l.productId as string
    const needed = roundMoney(l.quantity - l.invoicedQty, 3)
    const others = roundMoney((reserved.get(id) ?? 0) - needed, 3)
    const available = roundMoney((onHand.get(id) ?? 0) - Math.max(others, 0), 3)
    if (needed > available) out.push({ productId: id, productName: l.product?.productName ?? '', needed, available })
  }
  return out
}
