import { describe, it, expect, vi } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { getProductCost, getProductCostsBatch } from '../valuation.service'

function makeDb(overrides: Record<string, unknown> = {}) {
  const db = {
    product: { findMany: vi.fn().mockResolvedValue([]) },
    inventory: { findMany: vi.fn().mockResolvedValue([]) },
    productCostHistory: { findMany: vi.fn().mockResolvedValue([]) },
    ...overrides
  } as Record<string, any>
  vi.mocked(getPrisma).mockReturnValue(db as never)
  return db
}

describe('getProductCost / getProductCostsBatch', () => {
  it('WEIGHTED_AVERAGE resolves from live Inventory.averageCost, not the static costPrice', async () => {
    makeDb({
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'p1', costPrice: 50, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null }]) },
      inventory: { findMany: vi.fn().mockResolvedValue([{ productId: 'p1', averageCost: 72.5, quantity: 10 }]) }
    })
    expect(await getProductCost('p1')).toBe(72.5)
  })

  it('WEIGHTED_AVERAGE falls back to costPrice when no Inventory row exists yet', async () => {
    makeDb({
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'p1', costPrice: 50, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null }]) },
      inventory: { findMany: vi.fn().mockResolvedValue([]) }
    })
    expect(await getProductCost('p1')).toBe(50)
  })

  it('STANDARD_COST resolves from Product.standardCost, ignoring averageCost entirely', async () => {
    makeDb({
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'p1', costPrice: 50, valuationMethod: 'STANDARD_COST', standardCost: 60 }]) },
      inventory: { findMany: vi.fn().mockResolvedValue([{ productId: 'p1', averageCost: 999, quantity: 10 }]) }
    })
    expect(await getProductCost('p1')).toBe(60)
  })

  it('STANDARD_COST falls back to costPrice when standardCost was never set', async () => {
    makeDb({
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'p1', costPrice: 50, valuationMethod: 'STANDARD_COST', standardCost: null }]) },
      inventory: { findMany: vi.fn().mockResolvedValue([]) }
    })
    expect(await getProductCost('p1')).toBe(50)
  })

  it('FIFO values on-hand stock from the most recent purchase layers first (newest-first, not oldest)', async () => {
    // 3 layers: 5 units @ 10 (oldest), 5 units @ 20, 5 units @ 30 (newest).
    // On hand = 8 -> FIFO says the 5 oldest were sold through; the 8 still
    // on hand are the newest 5 @ 30 + 3 of the middle layer @ 20.
    makeDb({
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'p1', costPrice: 50, valuationMethod: 'FIFO', standardCost: null }]) },
      inventory: { findMany: vi.fn().mockResolvedValue([{ productId: 'p1', averageCost: 20, quantity: 8 }]) },
      productCostHistory: {
        findMany: vi.fn().mockResolvedValue([
          { productId: 'p1', unitCost: 10, quantity: 5 },
          { productId: 'p1', unitCost: 20, quantity: 5 },
          { productId: 'p1', unitCost: 30, quantity: 5 }
        ])
      }
    })
    // (5*30 + 3*20) / 8 = (150+60)/8 = 26.25
    expect(await getProductCost('p1')).toBe(26.25)
  })

  it('FIFO falls back to weighted-average when there is no purchase history yet', async () => {
    makeDb({
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'p1', costPrice: 50, valuationMethod: 'FIFO', standardCost: null }]) },
      inventory: { findMany: vi.fn().mockResolvedValue([{ productId: 'p1', averageCost: 45, quantity: 8 }]) },
      productCostHistory: { findMany: vi.fn().mockResolvedValue([]) }
    })
    expect(await getProductCost('p1')).toBe(45)
  })

  it('FIFO with on-hand quantity exceeding total recorded layers still resolves using what history exists', async () => {
    makeDb({
      product: { findMany: vi.fn().mockResolvedValue([{ id: 'p1', costPrice: 50, valuationMethod: 'FIFO', standardCost: null }]) },
      inventory: { findMany: vi.fn().mockResolvedValue([{ productId: 'p1', averageCost: 15, quantity: 100 }]) },
      productCostHistory: {
        findMany: vi.fn().mockResolvedValue([{ productId: 'p1', unitCost: 15, quantity: 20 }])
      }
    })
    // Only 20 units of history exist for 100 on hand -> covered value / covered qty = 15
    expect(await getProductCost('p1')).toBe(15)
  })

  it('batches correctly across mixed valuation methods without N+1 (one product/inventory/history query each)', async () => {
    const productFindMany = vi.fn().mockResolvedValue([
      { id: 'p1', costPrice: 10, valuationMethod: 'WEIGHTED_AVERAGE', standardCost: null },
      { id: 'p2', costPrice: 20, valuationMethod: 'STANDARD_COST', standardCost: 25 },
      { id: 'p3', costPrice: 30, valuationMethod: 'FIFO', standardCost: null }
    ])
    const inventoryFindMany = vi.fn().mockResolvedValue([
      { productId: 'p1', averageCost: 12, quantity: 5 },
      { productId: 'p3', averageCost: 30, quantity: 4 }
    ])
    const historyFindMany = vi.fn().mockResolvedValue([
      { productId: 'p3', unitCost: 40, quantity: 4 }
    ])
    makeDb({
      product: { findMany: productFindMany },
      inventory: { findMany: inventoryFindMany },
      productCostHistory: { findMany: historyFindMany }
    })

    const costs = await getProductCostsBatch(['p1', 'p2', 'p3', 'p1'])
    expect(costs.get('p1')).toBe(12)
    expect(costs.get('p2')).toBe(25)
    expect(costs.get('p3')).toBe(40)
    // Deduped input (p1 passed twice) -> exactly one query round each, with unique ids only
    expect(productFindMany).toHaveBeenCalledTimes(1)
    expect(productFindMany.mock.calls[0][0].where.id.in).toEqual(['p1', 'p2', 'p3'])
    expect(inventoryFindMany).toHaveBeenCalledTimes(1)
    expect(historyFindMany).toHaveBeenCalledTimes(1)
  })

  it('returns an empty map for an empty product id list without querying the database', async () => {
    const db = makeDb()
    const costs = await getProductCostsBatch([])
    expect(costs.size).toBe(0)
    expect(db.product.findMany).not.toHaveBeenCalled()
  })
})
