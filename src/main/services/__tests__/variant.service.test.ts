import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { decrementVariantStockTx, adjustVariantStock } from '../variant.service'

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
