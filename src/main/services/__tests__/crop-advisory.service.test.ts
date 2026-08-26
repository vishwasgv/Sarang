import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { listDistinctCrops, getProductsForCrop } from '../crop-advisory.service'

function makeMockDb(overrides: Record<string, any> = {}) {
  const db: Record<string, any> = {
    product: { findMany: vi.fn().mockResolvedValue([]) },
    ...overrides
  }
  return db
}

describe('crop-advisory.service — listDistinctCrops', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns an empty list when no products are crop-tagged', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await listDistinctCrops()
    expect(res.success).toBe(true)
    expect(res.data).toEqual([])
  })

  it('dedupes and sorts distinct crop names', async () => {
    const db = makeMockDb({
      product: { findMany: vi.fn().mockResolvedValue([{ recommendedCrop: 'Wheat' }, { recommendedCrop: 'Cotton' }, { recommendedCrop: 'wheat' }]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await listDistinctCrops()
    expect(res.success).toBe(true)
    expect(res.data).toHaveLength(3)
    expect(res.data?.[0]).toBe('Cotton')
    expect(new Set(res.data)).toEqual(new Set(['Cotton', 'Wheat', 'wheat']))
  })
})

describe('crop-advisory.service — getProductsForCrop', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects an empty crop name', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await getProductsForCrop('')
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('CADV-002')
  })

  it('matches recommendedCrop case-insensitively', async () => {
    const db = makeMockDb({
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'p1', productName: 'Urea 50kg', sellingPrice: 500, recommendedCrop: 'Wheat', inventory: { quantity: 10 }, variants: [] },
          { id: 'p2', productName: 'Pesticide X', sellingPrice: 300, recommendedCrop: 'Cotton', inventory: { quantity: 5 }, variants: [] },
        ])
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await getProductsForCrop('wheat')
    expect(res.success).toBe(true)
    expect(res.data).toHaveLength(1)
    expect(res.data?.[0].productName).toBe('Urea 50kg')
  })

  it('sums stock across variants when the product is variant-tracked, falling back to Inventory.quantity otherwise', async () => {
    const db = makeMockDb({
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'p1', productName: 'Seed Bag A', sellingPrice: 200, recommendedCrop: 'Wheat', inventory: { quantity: 999 }, variants: [{ stockQty: 3 }, { stockQty: 2 }] },
          { id: 'p2', productName: 'Seed Bag B', sellingPrice: 200, recommendedCrop: 'Wheat', inventory: { quantity: 12 }, variants: [] },
        ])
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await getProductsForCrop('Wheat')
    const a = res.data?.find(p => p.productName === 'Seed Bag A')
    const b = res.data?.find(p => p.productName === 'Seed Bag B')
    expect(a?.stockQty).toBe(5)
    expect(b?.stockQty).toBe(12)
  })

  it('sorts matched products by name', async () => {
    const db = makeMockDb({
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'p1', productName: 'Zinc Spray', sellingPrice: 100, recommendedCrop: 'Wheat', inventory: { quantity: 1 }, variants: [] },
          { id: 'p2', productName: 'Ammonium Nitrate', sellingPrice: 100, recommendedCrop: 'Wheat', inventory: { quantity: 1 }, variants: [] },
        ])
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await getProductsForCrop('Wheat')
    expect(res.data?.map(p => p.productName)).toEqual(['Ammonium Nitrate', 'Zinc Spray'])
  })
})
