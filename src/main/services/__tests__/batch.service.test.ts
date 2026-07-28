import { describe, it, expect, vi } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { deductBatchStockFIFO, hasEnoughNonExpiredBatchStock, getExpiryAlerts, updateBatch, deleteBatch } from '../batch.service'

const DAY = 24 * 60 * 60 * 1000
const now = new Date()
const expired = new Date(now.getTime() - 5 * DAY)
const notExpiredSoon = new Date(now.getTime() + 3 * DAY)
const notExpiredLater = new Date(now.getTime() + 60 * DAY)

function makeTx(batches: Array<{ id: string; quantityRemaining: number; expiryDate: Date; isActive?: boolean }>) {
  const state = new Map(batches.map(b => [b.id, { ...b, isActive: b.isActive ?? true }]))
  return {
    productBatch: {
      findMany: vi.fn(async ({ where, orderBy }: { where: { expiryDate?: { gte?: Date } }; orderBy: { expiryDate: 'asc' } }) => {
        const minExpiry = where.expiryDate?.gte
        let rows = [...state.values()].filter(b => b.isActive && b.quantityRemaining > 0)
        if (minExpiry) rows = rows.filter(b => b.expiryDate >= minExpiry)
        rows.sort((a, b) => orderBy.expiryDate === 'asc' ? a.expiryDate.getTime() - b.expiryDate.getTime() : 0)
        return rows
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { quantityRemaining: { decrement: number } } }) => {
        const row = state.get(where.id)!
        row.quantityRemaining -= data.quantityRemaining.decrement
        return row
      }),
      aggregate: vi.fn(async ({ where }: { where: { expiryDate?: { gte?: Date } } }) => {
        const minExpiry = where.expiryDate?.gte
        let rows = [...state.values()].filter(b => b.isActive && b.quantityRemaining > 0)
        if (minExpiry) rows = rows.filter(b => b.expiryDate >= minExpiry)
        const sum = rows.reduce((s, b) => s + b.quantityRemaining, 0)
        return { _sum: { quantityRemaining: rows.length ? sum : null } }
      })
    },
    __state: state
  }
}

describe('deductBatchStockFIFO', () => {
  it('skips an expired batch entirely and draws from the next non-expired one instead', async () => {
    const tx = makeTx([
      { id: 'b-expired', quantityRemaining: 10, expiryDate: expired },
      { id: 'b-fresh', quantityRemaining: 10, expiryDate: notExpiredSoon }
    ])

    await deductBatchStockFIFO(tx as never, 'prod-1', 4)

    expect(tx.__state.get('b-expired')!.quantityRemaining).toBe(10) // untouched
    expect(tx.__state.get('b-fresh')!.quantityRemaining).toBe(6) // 10 - 4
  })

  it('still dispenses earliest-expiry-first among non-expired batches (unchanged FIFO order)', async () => {
    const tx = makeTx([
      { id: 'b-later', quantityRemaining: 10, expiryDate: notExpiredLater },
      { id: 'b-soon', quantityRemaining: 5, expiryDate: notExpiredSoon }
    ])

    await deductBatchStockFIFO(tx as never, 'prod-1', 7)

    expect(tx.__state.get('b-soon')!.quantityRemaining).toBe(0) // fully drawn first
    expect(tx.__state.get('b-later')!.quantityRemaining).toBe(8) // remaining 2 drawn from this one
  })

  it('only partially deducts when non-expired batch stock is short of the request (never reaches into expired stock to make up the gap)', async () => {
    const tx = makeTx([
      { id: 'b-expired', quantityRemaining: 100, expiryDate: expired },
      { id: 'b-fresh', quantityRemaining: 3, expiryDate: notExpiredSoon }
    ])

    await deductBatchStockFIFO(tx as never, 'prod-1', 10)

    expect(tx.__state.get('b-fresh')!.quantityRemaining).toBe(0)
    expect(tx.__state.get('b-expired')!.quantityRemaining).toBe(100) // untouched, even though short
  })
})

describe('hasEnoughNonExpiredBatchStock', () => {
  it('returns true for a product with no batch records at all (batch tracking not in use)', async () => {
    const tx = makeTx([])
    expect(await hasEnoughNonExpiredBatchStock(tx as never, 'prod-1', 5)).toBe(true)
  })

  it('returns false when only expired batches could cover the requested quantity', async () => {
    const tx = makeTx([{ id: 'b-expired', quantityRemaining: 20, expiryDate: expired }])
    expect(await hasEnoughNonExpiredBatchStock(tx as never, 'prod-1', 5)).toBe(false)
  })

  it('returns true when non-expired batches alone cover the requested quantity', async () => {
    const tx = makeTx([
      { id: 'b-expired', quantityRemaining: 20, expiryDate: expired },
      { id: 'b-fresh', quantityRemaining: 8, expiryDate: notExpiredSoon }
    ])
    expect(await hasEnoughNonExpiredBatchStock(tx as never, 'prod-1', 5)).toBe(true)
  })

  it('returns false when non-expired batches exist but are short of the requested quantity', async () => {
    const tx = makeTx([
      { id: 'b-expired', quantityRemaining: 20, expiryDate: expired },
      { id: 'b-fresh', quantityRemaining: 3, expiryDate: notExpiredSoon }
    ])
    expect(await hasEnoughNonExpiredBatchStock(tx as never, 'prod-1', 5)).toBe(false)
  })
})

describe('updateBatch — read-inside-transaction race fix', () => {
  // Simulates a concurrent modification landing between updateBatch's cheap
  // pre-transaction date-order check and the transaction itself: the first
  // findUnique call (the pre-check) sees quantityRemaining: 100, but by the
  // time the transaction opens and reads again, a concurrent write has
  // already moved it to 70.
  function makeMockDb(opts: { preCheckQty: number; freshQty: number; productId?: string }) {
    let call = 0
    const db: Record<string, any> = {
      productBatch: {
        findUnique: vi.fn(async () => {
          call++
          const quantityRemaining = call === 1 ? opts.preCheckQty : opts.freshQty
          return { id: 'batch-1', productId: opts.productId ?? 'prod-1', quantityRemaining, expiryDate: notExpiredSoon, mfgDate: null }
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      inventory: { upsert: vi.fn().mockResolvedValue({}) },
    }
    db.$transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db))
    return db
  }

  // Real bug found live (core-commerce audit): the delta used to be computed
  // from `existing.quantityRemaining` captured BEFORE the transaction opened
  // — a value that could already be stale by the time the transaction's own
  // writes land. This test's mock returns a DIFFERENT quantityRemaining on
  // the fresh in-transaction read (70) than on the pre-check read (100); the
  // fix must compute the Inventory.quantity delta against the fresh value
  // (80 - 70 = 10), not the stale pre-check one (80 - 100 = -20).
  it('computes the Inventory.quantity delta from a value read fresh INSIDE the transaction, not the earlier pre-check read', async () => {
    const db = makeMockDb({ preCheckQty: 100, freshQty: 70 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateBatch({ id: 'batch-1', quantityRemaining: 80 })

    expect(db.inventory.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { productId: 'prod-1' },
      update: { quantity: { increment: 10 } }, // 80 - 70 (fresh), NOT 80 - 100 (stale)
    }))
  })

  it('computes the correct delta on the normal (non-racy) path', async () => {
    const db = makeMockDb({ preCheckQty: 100, freshQty: 100 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateBatch({ id: 'batch-1', quantityRemaining: 80 })

    expect(db.inventory.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { productId: 'prod-1' },
      update: { quantity: { increment: -20 } }, // 80 - 100
    }))
  })

  it('rejects when manufacturing date is not before expiry date', async () => {
    const db = makeMockDb({ preCheckQty: 100, freshQty: 100 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateBatch({ id: 'batch-1', mfgDate: notExpiredLater.toISOString(), expiryDate: notExpiredSoon.toISOString() })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('BAT-008')
  })
})

describe('deleteBatch — atomic claim prevents double inventory decrement', () => {
  function makeMockDb(batch: { id: string; productId: string; quantityRemaining: number; isActive: boolean }) {
    const state = { ...batch }
    const db: Record<string, any> = {
      productBatch: {
        findUnique: vi.fn(async () => ({ ...state })),
        updateMany: vi.fn(async ({ where, data }: { where: { isActive: boolean }; data: { isActive: boolean } }) => {
          if (state.isActive !== where.isActive) return { count: 0 }
          state.isActive = data.isActive
          return { count: 1 }
        }),
      },
      inventory: { upsert: vi.fn().mockResolvedValue({}) },
    }
    db.$transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db))
    return db
  }

  it('decrements inventory by the batch quantity on a normal delete', async () => {
    const db = makeMockDb({ id: 'batch-1', productId: 'prod-1', quantityRemaining: 15, isActive: true })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deleteBatch('batch-1')

    expect(res.success).toBe(true)
    expect(db.inventory.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { productId: 'prod-1' },
      update: { quantity: { decrement: 15 } },
    }))
  })

  // Real bug found live (core-commerce audit): `batch` used to be read
  // BEFORE the transaction, then isActive was set to false unconditionally
  // inside it — a duplicate delete call (double-click, or two concurrent
  // requests) for the same batch would both pass the "still active" read and
  // each decrement inventory by the full quantity again. The conditional
  // updateMany claim means only the call that actually flips isActive gets
  // to touch inventory.
  it('does NOT decrement inventory a second time when the batch was already deleted', async () => {
    const db = makeMockDb({ id: 'batch-1', productId: 'prod-1', quantityRemaining: 15, isActive: false })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deleteBatch('batch-1')

    expect(res.success).toBe(true)
    expect(db.inventory.upsert).not.toHaveBeenCalled()
  })
})

describe('getExpiryAlerts — Phase 58 §2 per-product expiry alert lead time', () => {
  function makeBatch(overrides: Partial<{
    id: string; productId: string; expiryDate: Date; quantityRemaining: number
    isActive: boolean; expiryAlertLeadDays: number | null
  }> = {}) {
    return {
      id: overrides.id ?? 'batch-1',
      productId: overrides.productId ?? 'prod-1',
      batchNumber: 'B-1',
      mfgDate: null,
      expiryDate: overrides.expiryDate ?? notExpiredSoon,
      quantityReceived: 100,
      quantityRemaining: overrides.quantityRemaining ?? 100,
      unitCost: 0,
      supplierId: null,
      isActive: overrides.isActive ?? true,
      createdAt: now,
      product: { productName: 'Widget', expiryAlertLeadDays: overrides.expiryAlertLeadDays ?? null },
      supplier: null,
    }
  }

  function makeMockDb(batches: ReturnType<typeof makeBatch>[]) {
    return {
      productBatch: {
        findMany: vi.fn(async ({ where }: { where: { isActive: boolean; quantityRemaining: { gt: number } } }) =>
          batches.filter(b => b.isActive === where.isActive && b.quantityRemaining > where.quantityRemaining.gt)
        ),
      },
    }
  }

  it('uses the generic 30-day default when a product has no override', async () => {
    // 45 days out — outside the 30-day default, so NOT flagged as expiring.
    const farOut = new Date(now.getTime() + 45 * DAY)
    const db = makeMockDb([makeBatch({ id: 'b-1', expiryDate: farOut, expiryAlertLeadDays: null })])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getExpiryAlerts()
    expect(res.data?.expiring).toHaveLength(0)
  })

  it('flags a batch as expiring using its OWN product-specific lead time, even far outside the generic default', async () => {
    // 45 days out — would be invisible under the generic 30-day window, but
    // this product has a 60-day lead time configured (e.g. seeds).
    const farOut = new Date(now.getTime() + 45 * DAY)
    const db = makeMockDb([makeBatch({ id: 'b-seed', expiryDate: farOut, expiryAlertLeadDays: 60 })])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getExpiryAlerts()
    expect(res.data?.expiring).toHaveLength(1)
    expect(res.data?.expiring[0].id).toBe('b-seed')
    expect(res.data?.expiring[0].expiryAlertLeadDays).toBe(60)
  })

  it('two products with different lead times are bucketed independently from the same query', async () => {
    const in45Days = new Date(now.getTime() + 45 * DAY)
    const db = makeMockDb([
      makeBatch({ id: 'b-generic', expiryDate: in45Days, expiryAlertLeadDays: null }), // 30-day default -> NOT expiring
      makeBatch({ id: 'b-seed', expiryDate: in45Days, expiryAlertLeadDays: 60 }),      // 60-day lead -> expiring
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getExpiryAlerts()
    const ids = res.data?.expiring.map(b => b.id)
    expect(ids).toEqual(['b-seed'])
  })

  it('an already-past expiry date is always "expired", regardless of lead time', async () => {
    const db = makeMockDb([makeBatch({ id: 'b-old', expiryDate: expired, expiryAlertLeadDays: 180 })])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getExpiryAlerts()
    expect(res.data?.expired).toHaveLength(1)
    expect(res.data?.expiring).toHaveLength(0)
  })
})
