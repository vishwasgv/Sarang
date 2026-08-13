import type { Prisma } from '@prisma/client'
import { getPrisma } from '../database/db'

type Tx = Prisma.TransactionClient

// Phase 64 — the single resolver every cost-reading call site now goes
// through, replacing ad-hoc reads of the static Product.costPrice. Per
// PHASE_61_ROADMAP_MASTER_PROMPT.md Section 6's own grounding check,
// Inventory.averageCost already IS the app's de facto weighted-average cost
// (kept live by inventory.service.ts's addStockTx/adjustStock) — this
// module's real job is formalizing WEIGHTED_AVERAGE as an explicit,
// selectable setting and adding FIFO/STANDARD_COST as real alternatives,
// not inventing weighted-average math from scratch.
//
// FIFO note: ProductCostHistory only records INFLOWS (purchases/bills), not
// which specific layer a later sale drew from — this codebase has no
// per-unit consumption ledger for ordinary products (ProductBatch exists,
// but only for batch/expiry-tracked products, a narrower feature). FIFO
// valuation here is therefore a standard, disclosed approximation: value
// the current on-hand quantity as if it were made up of the MOST RECENT
// purchase layers (the units a true FIFO system would not yet have sold
// through), not an exact per-unit trace. Documented here so a future reader
// doesn't mistake this for imprecision — it's the correct assumption for a
// system that decrements one aggregate Inventory.quantity at sale time.

interface ProductCostInputs {
  id: string
  costPrice: number
  valuationMethod: string
  standardCost: number | null
}

async function computeFifoCostsBatch(
  db: Tx | ReturnType<typeof getPrisma>,
  productIds: string[],
  quantityByProduct: Map<string, number>
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (productIds.length === 0) return result

  const layers = await db.productCostHistory.findMany({
    where: { productId: { in: productIds } },
    orderBy: { recordedAt: 'asc' },
    select: { productId: true, unitCost: true, quantity: true }
  })

  const layersByProduct = new Map<string, { unitCost: number; quantity: number }[]>()
  for (const layer of layers) {
    const arr = layersByProduct.get(layer.productId) ?? []
    arr.push({ unitCost: layer.unitCost, quantity: layer.quantity })
    layersByProduct.set(layer.productId, arr)
  }

  for (const productId of productIds) {
    const onHand = quantityByProduct.get(productId) ?? 0
    const productLayers = layersByProduct.get(productId)
    if (onHand <= 0 || !productLayers || productLayers.length === 0) continue

    // Newest-first: the units still on hand under FIFO are the most
    // recently purchased ones, since older layers are assumed sold through.
    let remaining = onHand
    let totalValue = 0
    for (let i = productLayers.length - 1; i >= 0 && remaining > 0; i--) {
      const layer = productLayers[i]
      const qtyFromLayer = Math.min(remaining, layer.quantity)
      totalValue += qtyFromLayer * layer.unitCost
      remaining -= qtyFromLayer
    }
    const coveredQty = onHand - remaining
    if (coveredQty > 0) result.set(productId, totalValue / coveredQty)
  }

  return result
}

// Batched — every real call site (P&L, Food Cost, Profit Estimate) resolves
// cost for many products across many invoice/order lines at once; a
// per-line getProductCost() call would be a real N+1 query regression.
export async function getProductCostsBatch(productIds: string[], tx?: Tx): Promise<Map<string, number>> {
  const db = tx ?? getPrisma()
  const uniqueIds = [...new Set(productIds)]
  const result = new Map<string, number>()
  if (uniqueIds.length === 0) return result

  const [products, inventories] = await Promise.all([
    db.product.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, costPrice: true, valuationMethod: true, standardCost: true }
    }) as Promise<ProductCostInputs[]>,
    db.inventory.findMany({
      where: { productId: { in: uniqueIds } },
      select: { productId: true, averageCost: true, quantity: true }
    })
  ])

  const invByProduct = new Map(inventories.map(i => [i.productId, i]))

  const fifoProductIds = products.filter(p => p.valuationMethod === 'FIFO').map(p => p.id)
  const fifoQuantities = new Map(fifoProductIds.map(id => [id, invByProduct.get(id)?.quantity ?? 0]))
  const fifoCosts = await computeFifoCostsBatch(db, fifoProductIds, fifoQuantities)

  for (const product of products) {
    const inv = invByProduct.get(product.id)
    if (product.valuationMethod === 'STANDARD_COST') {
      result.set(product.id, product.standardCost ?? product.costPrice)
    } else if (product.valuationMethod === 'FIFO') {
      // No purchase history yet to build a FIFO layer from — fall back to
      // the live weighted-average cost, same fallback WEIGHTED_AVERAGE uses.
      result.set(product.id, fifoCosts.get(product.id) ?? inv?.averageCost ?? product.costPrice)
    } else {
      result.set(product.id, inv?.averageCost ?? product.costPrice)
    }
  }

  return result
}

export async function getProductCost(productId: string, tx?: Tx): Promise<number> {
  const costs = await getProductCostsBatch([productId], tx)
  return costs.get(productId) ?? 0
}
