import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { decrementVariantStockTx } from '../variant.service'

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
