import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { pricingSchemeService } from '../pricing-scheme.service'

function makeScheme(overrides: Record<string, unknown> = {}) {
  return {
    id: 'scheme-1', name: 'Buy 10 Get 1 Free', ruleType: 'BUY_X_GET_Y_FREE',
    productId: 'prod-1', categoryId: null, buyQuantity: 10, freeQuantity: 1,
    slabBreakpoints: '[]', startDate: null, endDate: null, isActive: true,
    ...overrides
  }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  const db = {
    product: { findUnique: vi.fn().mockResolvedValue({ id: 'prod-1', categoryId: 'cat-1' }) },
    productCategory: { findUnique: vi.fn().mockResolvedValue({ id: 'cat-1', name: 'Grocery' }) },
    pricingScheme: {
      create: vi.fn().mockResolvedValue(makeScheme()),
      findUnique: vi.fn().mockResolvedValue(makeScheme()),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([makeScheme()])
    },
    ...overrides
  } as Record<string, any>
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('pricingSchemeService.createPricingScheme', () => {
  it('rejects when neither productId nor categoryId is resolvable', async () => {
    const db = makeDb({ product: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await pricingSchemeService.createPricingScheme({
      name: 'X', ruleType: 'BUY_X_GET_Y_FREE', productId: 'ghost', buyQuantity: 10, freeQuantity: 1
    } as never)

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PRD-001')
  })

  it('serializes slabBreakpoints to JSON on create', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await pricingSchemeService.createPricingScheme({
      name: 'Bulk Discount', ruleType: 'SLAB_DISCOUNT', productId: 'prod-1',
      slabBreakpoints: [{ minQty: 10, discountPercent: 5 }, { minQty: 50, discountPercent: 10 }]
    } as never)

    expect(db.pricingScheme.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ slabBreakpoints: JSON.stringify([{ minQty: 10, discountPercent: 5 }, { minQty: 50, discountPercent: 10 }]) })
    }))
  })
})

describe('pricingSchemeService.evaluateCart — BUY_X_GET_Y_FREE', () => {
  it('earns zero free units below the buy threshold', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await pricingSchemeService.evaluateCart({ items: [{ productId: 'prod-1', quantity: 9 }] })

    expect(res.success).toBe(true)
    expect((res as any).data.focLines).toHaveLength(0)
  })

  it('earns exactly 1 free unit at the buy threshold (10 → 1 free)', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await pricingSchemeService.evaluateCart({ items: [{ productId: 'prod-1', quantity: 10 }] })

    expect((res as any).data.focLines).toEqual([{ productId: 'prod-1', quantity: 1, schemeId: 'scheme-1', schemeName: 'Buy 10 Get 1 Free' }])
  })

  it('earns 2 free units at double the threshold (20 → 2 free), not just 1', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await pricingSchemeService.evaluateCart({ items: [{ productId: 'prod-1', quantity: 20 }] })

    expect((res as any).data.focLines[0].quantity).toBe(2)
  })

  it('ignores a scheme outside its active date range', async () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const db = makeDb({ pricingScheme: { findMany: vi.fn().mockResolvedValue([makeScheme({ startDate: future })]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await pricingSchemeService.evaluateCart({ items: [{ productId: 'prod-1', quantity: 20 }] })

    expect((res as any).data.focLines).toHaveLength(0)
  })
})

describe('pricingSchemeService.evaluateCart — SLAB_DISCOUNT', () => {
  it('picks the highest qualifying slab, not just any match', async () => {
    const scheme = makeScheme({
      ruleType: 'SLAB_DISCOUNT',
      slabBreakpoints: JSON.stringify([{ minQty: 1, discountPercent: 0 }, { minQty: 10, discountPercent: 5 }, { minQty: 50, discountPercent: 10 }])
    })
    const db = makeDb({ pricingScheme: { findMany: vi.fn().mockResolvedValue([scheme]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await pricingSchemeService.evaluateCart({ items: [{ productId: 'prod-1', quantity: 25 }] })

    expect((res as any).data.discounts).toEqual([{ productId: 'prod-1', discountPercent: 5, schemeId: 'scheme-1', schemeName: 'Buy 10 Get 1 Free' }])
  })

  it('returns no discount when quantity is below every breakpoint', async () => {
    const scheme = makeScheme({ ruleType: 'SLAB_DISCOUNT', slabBreakpoints: JSON.stringify([{ minQty: 10, discountPercent: 5 }]) })
    const db = makeDb({ pricingScheme: { findMany: vi.fn().mockResolvedValue([scheme]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await pricingSchemeService.evaluateCart({ items: [{ productId: 'prod-1', quantity: 5 }] })

    expect((res as any).data.discounts).toHaveLength(0)
  })
})

describe('pricingSchemeService.evaluateCart — category-scoped schemes', () => {
  it('matches a scheme scoped to the product\'s category, not just its own productId', async () => {
    const categoryScheme = makeScheme({ productId: null, categoryId: 'cat-1' })
    const db = makeDb({ pricingScheme: { findMany: vi.fn().mockResolvedValue([categoryScheme]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await pricingSchemeService.evaluateCart({ items: [{ productId: 'prod-1', quantity: 10 }] })

    expect((res as any).data.focLines).toHaveLength(1)
  })

  it('skips a product that no longer exists', async () => {
    const db = makeDb({ product: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await pricingSchemeService.evaluateCart({ items: [{ productId: 'ghost', quantity: 10 }] })

    expect(res.success).toBe(true)
    expect((res as any).data.focLines).toHaveLength(0)
  })
})
