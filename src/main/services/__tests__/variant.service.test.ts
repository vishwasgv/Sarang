import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { decrementVariantStockTx, adjustVariantStock, getSizeCurveReorderSuggestion, upsertVariants, getVariantSummary } from '../variant.service'

function makeTx(variant: { id: string; stockQty: number } | null, allowNegative: boolean) {
  const updateCalls: unknown[] = []
  return {
    productVariant: {
      findUnique: vi.fn().mockResolvedValue(variant),
      update: vi.fn().mockImplementation((args) => { updateCalls.push(args); return Promise.resolve({}) })
    },
    setting: {
      findUnique: vi.fn().mockResolvedValue(
        allowNegative ? { settingKey: 'allow_negative_inventory', settingValue: 'true' } : null
      )
    },
    __updateCalls: updateCalls
  }
}

beforeEach(() => vi.clearAllMocks())

// Real bug found live (2026-07-28 core-commerce audit): decrementVariantStockTx
// used to silently clamp at Math.max(0, ...) instead of rejecting insufficient
// stock — unlike reduceStockTx's identical check for the parent
// Inventory.quantity total. These tests guard the fix.
describe('decrementVariantStockTx', () => {
  it('decrements normally when there is enough stock', async () => {
    const tx = makeTx({ id: 'var-1', stockQty: 10 }, false)
    vi.mocked(getPrisma).mockReturnValue(tx as never)

    await decrementVariantStockTx(tx as never, 'var-1', 4)

    expect(tx.__updateCalls).toEqual([{ where: { id: 'var-1' }, data: { stockQty: 6 } }])
  })

  it('rejects a decrement that would oversell the variant when negative stock is not allowed', async () => {
    const tx = makeTx({ id: 'var-1', stockQty: 3 }, false)
    vi.mocked(getPrisma).mockReturnValue(tx as never)

    await expect(decrementVariantStockTx(tx as never, 'var-1', 5)).rejects.toMatchObject({ code: 'VAR-009' })
    expect(tx.__updateCalls).toHaveLength(0)
  })

  it('allows going negative when allow_negative_inventory is enabled', async () => {
    const tx = makeTx({ id: 'var-1', stockQty: 3 }, true)
    vi.mocked(getPrisma).mockReturnValue(tx as never)

    await decrementVariantStockTx(tx as never, 'var-1', 5)

    expect(tx.__updateCalls).toEqual([{ where: { id: 'var-1' }, data: { stockQty: -2 } }])
  })

  it('is a no-op when the variant does not exist', async () => {
    const tx = makeTx(null, false)
    vi.mocked(getPrisma).mockReturnValue(tx as never)

    await expect(decrementVariantStockTx(tx as never, 'missing', 1)).resolves.toBeUndefined()
    expect(tx.__updateCalls).toHaveLength(0)
  })
})

// Real bug found live (core-commerce audit): adjustVariantStock used to read
// the variant and validate "newQty >= 0" BEFORE the transaction opened, then
// write an absolute stockQty inside it. Two concurrent adjustments on the
// same variant would each read the same stale stockQty, each independently
// pass the insufficient-stock check even when the combination of both
// would go negative, and Inventory.quantity (updated via a relative
// increment) would end up applying both deltas. These tests simulate that
// race with a mock whose findUnique returns a DIFFERENT stockQty on the
// in-transaction read than an initial (now-removed) pre-transaction read
// would have seen, proving the validation/write actually uses the fresh value.
describe('adjustVariantStock', () => {
  function makeMockDb(opts: { freshStockQty: number; productId?: string }) {
    const db: Record<string, any> = {
      productVariant: {
        findUnique: vi.fn(async () => ({ id: 'var-1', productId: opts.productId ?? 'prod-1', stockQty: opts.freshStockQty })),
        update: vi.fn().mockResolvedValue({}),
      },
      inventory: { upsert: vi.fn().mockResolvedValue({}) },
    }
    db.$transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db))
    return db
  }

  it('applies a normal adjustment and increments Inventory.quantity by the same delta', async () => {
    const db = makeMockDb({ freshStockQty: 10 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await adjustVariantStock({ variantId: 'var-1', quantityDelta: -4 })

    expect(res.success).toBe(true)
    expect(db.productVariant.update).toHaveBeenCalledWith({ where: { id: 'var-1' }, data: { stockQty: 6 } })
    expect(db.inventory.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { productId: 'prod-1' },
      update: { quantity: { increment: -4 } },
    }))
  })

  // Real bug: with the stock at a fresh 3 (read inside the transaction), a
  // decrement of 5 must be rejected — even if an earlier, now-stale read
  // (before this transaction opened) might have seen enough stock.
  it('rejects a decrement that would oversell, based on the freshly-read stock — not a stale pre-transaction snapshot', async () => {
    const db = makeMockDb({ freshStockQty: 3 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await adjustVariantStock({ variantId: 'var-1', quantityDelta: -5 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('VAR-007')
    expect(db.productVariant.update).not.toHaveBeenCalled()
    expect(db.inventory.upsert).not.toHaveBeenCalled()
  })

  it('returns an error when the variant does not exist', async () => {
    const db: Record<string, any> = {
      productVariant: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() },
      inventory: { upsert: vi.fn() },
    }
    db.$transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await adjustVariantStock({ variantId: 'missing', quantityDelta: -1 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('VAR-005')
  })
})

// Phase 67 §9.1 — Clothing: size-curve reorder suggestion.
describe('getSizeCurveReorderSuggestion', () => {
  function makeVariant(overrides: Record<string, unknown> = {}) {
    return { id: 'var-1', size: 'M', color: 'Blue', ...overrides }
  }

  function makeDb(opts: { variants?: unknown[]; reorderQuantity?: number | null; items?: unknown[] }) {
    return {
      productVariant: { findMany: vi.fn().mockResolvedValue(opts.variants ?? [makeVariant()]) },
      inventory: { findUnique: vi.fn().mockResolvedValue(opts.reorderQuantity !== undefined ? { reorderQuantity: opts.reorderQuantity } : null) },
      invoiceItem: { findMany: vi.fn().mockResolvedValue(opts.items ?? []) }
    }
  }

  it('rejects a product with no active variants', async () => {
    const db = makeDb({ variants: [] })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSizeCurveReorderSuggestion('prod-1', 100)

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('VAR-011')
  })

  it('rejects when no quantity is provided and the product has no configured reorderQuantity', async () => {
    const db = makeDb({ reorderQuantity: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSizeCurveReorderSuggestion('prod-1')

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('VAR-012')
  })

  it('falls back to the product own reorderQuantity when none is explicitly provided', async () => {
    const db = makeDb({ reorderQuantity: 50 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSizeCurveReorderSuggestion('prod-1')

    expect(res.success).toBe(true)
    expect(res.data?.totalReorderQty).toBe(50)
  })

  it('weights the suggested quantity toward the variant that sold more, proportionally', async () => {
    const db = makeDb({
      variants: [makeVariant({ id: 'var-m', size: 'M' }), makeVariant({ id: 'var-l', size: 'L' })],
      items: [
        { variantId: 'var-m', quantity: 30, invoice: { invoiceType: 'SALE' } },
        { variantId: 'var-l', quantity: 10, invoice: { invoiceType: 'SALE' } },
      ]
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSizeCurveReorderSuggestion('prod-1', 40)

    expect(res.success).toBe(true)
    const m = res.data?.rows.find(r => r.variantId === 'var-m')
    const l = res.data?.rows.find(r => r.variantId === 'var-l')
    expect(m?.suggestedQuantity).toBe(30) // 30/40 of sales -> 30/40 of qty
    expect(l?.suggestedQuantity).toBe(10)
  })

  it('sums the suggested quantities exactly to the requested total, even with rounding', async () => {
    const db = makeDb({
      variants: [makeVariant({ id: 'var-a' }), makeVariant({ id: 'var-b' }), makeVariant({ id: 'var-c' })],
      items: [
        { variantId: 'var-a', quantity: 1, invoice: { invoiceType: 'SALE' } },
        { variantId: 'var-b', quantity: 1, invoice: { invoiceType: 'SALE' } },
        { variantId: 'var-c', quantity: 1, invoice: { invoiceType: 'SALE' } },
      ]
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSizeCurveReorderSuggestion('prod-1', 10) // 10/3 each, doesn't divide evenly

    const total = res.data?.rows.reduce((s, r) => s + r.suggestedQuantity, 0)
    expect(total).toBe(10)
  })

  it('falls back to an even split when no variant has any recent sales signal', async () => {
    const db = makeDb({
      variants: [makeVariant({ id: 'var-a' }), makeVariant({ id: 'var-b' })],
      items: []
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSizeCurveReorderSuggestion('prod-1', 20)

    const a = res.data?.rows.find(r => r.variantId === 'var-a')
    const b = res.data?.rows.find(r => r.variantId === 'var-b')
    expect(a?.suggestedQuantity).toBe(10)
    expect(b?.suggestedQuantity).toBe(10)
  })

  it('applies the same RETURN sign correction as every other report/aggregation, clamped at zero per variant', async () => {
    const db = makeDb({
      variants: [makeVariant({ id: 'var-a' }), makeVariant({ id: 'var-b' })],
      items: [
        { variantId: 'var-a', quantity: 10, invoice: { invoiceType: 'SALE' } },
        { variantId: 'var-a', quantity: 10, invoice: { invoiceType: 'RETURN' } },
        { variantId: 'var-b', quantity: 5, invoice: { invoiceType: 'SALE' } },
      ]
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSizeCurveReorderSuggestion('prod-1', 10)

    const a = res.data?.rows.find(r => r.variantId === 'var-a')
    expect(a?.unitsSoldRecently).toBe(0) // 10 - 10, clamped
  })

  it('queries only ACTIVE invoices within the lookback window for this product', async () => {
    const findMany = vi.fn().mockResolvedValue([])
    const db = makeDb({ reorderQuantity: 10 })
    db.invoiceItem.findMany = findMany
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await getSizeCurveReorderSuggestion('prod-1')

    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ productId: 'prod-1', variantId: { not: null }, invoice: expect.objectContaining({ status: 'ACTIVE' }) })
    }))
  })

  // Phase 67 §9.1 — Footwear item 1: half-size/width matrix. Two variants
  // sharing a size and color but differing only by width must be kept
  // distinct in this row's own identity, not conflated.
  it('carries width through to each row, distinguishing two same-size-and-color variants that differ only by width', async () => {
    const db = makeDb({
      variants: [
        makeVariant({ id: 'var-narrow', size: '8', color: 'Black', width: 'Narrow' }),
        makeVariant({ id: 'var-wide', size: '8', color: 'Black', width: 'Wide' }),
      ],
      items: [
        { variantId: 'var-narrow', quantity: 5, invoice: { invoiceType: 'SALE' } },
      ]
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSizeCurveReorderSuggestion('prod-1', 20)

    const narrow = res.data?.rows.find(r => r.variantId === 'var-narrow')
    const wide = res.data?.rows.find(r => r.variantId === 'var-wide')
    expect(narrow?.width).toBe('Narrow')
    expect(wide?.width).toBe('Wide')
    expect(narrow?.suggestedQuantity).toBe(20) // only variant with any sales signal
    expect(wide?.suggestedQuantity).toBe(0)
  })
})

// Phase 67 §9.1 — Footwear item 1: half-size/width matrix.
describe('upsertVariants — width field', () => {
  function makeTxForUpsert() {
    const created: unknown[] = []
    const updated: unknown[] = []
    return {
      productVariant: {
        create: vi.fn().mockImplementation(({ data }) => {
          created.push(data)
          return Promise.resolve({ ...data, id: 'new-var-1', product: { productName: 'Trail Runner' }, createdAt: new Date() })
        }),
        update: vi.fn().mockImplementation(({ data }) => {
          updated.push(data)
          return Promise.resolve({ id: 'var-1', productId: 'prod-1', ...data, product: { productName: 'Trail Runner' }, createdAt: new Date() })
        }),
        findMany: vi.fn().mockResolvedValue([{ stockQty: 10 }])
      },
      inventory: { upsert: vi.fn().mockResolvedValue({}) },
      __created: created,
      __updated: updated
    }
  }

  it('persists width on a newly created variant', async () => {
    const tx = makeTxForUpsert()
    const db = {
      product: { findUnique: vi.fn().mockResolvedValue({ productName: 'Trail Runner' }) },
      $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(tx))
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertVariants({ productId: 'prod-1', variants: [{ size: '9', width: 'Wide', color: 'Black', stockQty: 10 }] })

    expect(res.success).toBe(true)
    expect(tx.__created[0]).toMatchObject({ width: 'Wide' })
    expect(res.data?.[0].width).toBe('Wide')
  })

  it('persists width on an updated existing variant, and clears it to null when omitted', async () => {
    const tx = makeTxForUpsert()
    const db = {
      product: { findUnique: vi.fn().mockResolvedValue({ productName: 'Trail Runner' }) },
      $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(tx))
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await upsertVariants({ productId: 'prod-1', variants: [{ id: 'var-1', size: '9', width: 'Narrow', color: 'Black', stockQty: 10 }] })
    expect(tx.__updated[0]).toMatchObject({ width: 'Narrow' })

    await upsertVariants({ productId: 'prod-1', variants: [{ id: 'var-1', size: '9', color: 'Black', stockQty: 10 }] })
    expect(tx.__updated[1]).toMatchObject({ width: null })
  })
})

describe('getVariantSummary — widths', () => {
  it('returns the distinct set of widths actually used, empty for products with none set', async () => {
    const db = {
      productVariant: {
        findMany: vi.fn().mockResolvedValue([
          { size: '8', color: 'Black', width: 'Wide', stockQty: 5 },
          { size: '9', color: 'Black', width: 'Wide', stockQty: 3 },
          { size: '9', color: 'Red', width: 'Narrow', stockQty: 2 },
          { size: '10', color: 'Red', width: null, stockQty: 1 },
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getVariantSummary('prod-1')

    expect(res.data?.widths.sort()).toEqual(['Narrow', 'Wide'])
  })

  it('is an empty array for a non-Footwear product where no variant ever sets a width', async () => {
    const db = {
      productVariant: {
        findMany: vi.fn().mockResolvedValue([
          { size: 'M', color: 'Blue', width: null, stockQty: 5 },
        ])
      }
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getVariantSummary('prod-1')

    expect(res.data?.widths).toEqual([])
  })
})
