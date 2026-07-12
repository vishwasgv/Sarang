import { describe, it, expect, vi } from 'vitest'
import { deductBatchStockFIFO, hasEnoughNonExpiredBatchStock } from '../batch.service'

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
