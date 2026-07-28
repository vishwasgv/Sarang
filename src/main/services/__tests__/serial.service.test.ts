import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { updateSerialStatus } from '../serial.service'

beforeEach(() => vi.clearAllMocks())

// Real bug found live (core-commerce audit): updateSerialStatus used to read
// `existing` BEFORE this transaction opened, then reused that stale
// `existing.status` inside it to decide whether to increment/decrement
// Inventory.quantity. Two concurrent status changes on the same serial (e.g.
// two staff both marking a returned unit back AVAILABLE at once) would each
// act on the same pre-transaction snapshot, so the inventory adjustment
// below could apply twice for what is really only one real state transition.
describe('serial.service.updateSerialStatus', () => {
  function makeMockDb(opts: { freshStatus: string; productId?: string }) {
    const callOrder: string[] = []
    const db: Record<string, any> = {
      productSerial: {
        findUnique: vi.fn(async () => {
          callOrder.push('findUnique')
          return { id: 'ser-1', productId: opts.productId ?? 'prod-1', status: opts.freshStatus, invoiceId: null }
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      inventory: { upsert: vi.fn().mockResolvedValue({}) },
    }
    db.$transaction = vi.fn((cb: (tx: unknown) => unknown) => { callOrder.push('transactionStart'); return cb(db) })
    return { db, callOrder }
  }

  // Proves the read that decides the inventory adjustment happens AFTER the
  // transaction opens (i.e. atomically with the write), not against a
  // snapshot taken before it — this is the actual shape of the race fix.
  // Fails on the pre-fix code, where findUnique ran BEFORE $transaction was
  // ever called.
  it('reads the serial status fresh INSIDE the transaction, not before it opens', async () => {
    const { db, callOrder } = makeMockDb({ freshStatus: 'SOLD' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateSerialStatus({ id: 'ser-1', status: 'AVAILABLE' })

    expect(callOrder.indexOf('findUnique')).toBeGreaterThan(callOrder.indexOf('transactionStart'))
  })

  it('increments inventory when a SOLD unit is marked AVAILABLE', async () => {
    const { db } = makeMockDb({ freshStatus: 'SOLD' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateSerialStatus({ id: 'ser-1', status: 'AVAILABLE' })

    expect(res.success).toBe(true)
    expect(db.inventory.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { productId: 'prod-1' },
      update: { quantity: { increment: 1 } },
    }))
  })

  it('decrements inventory when an AVAILABLE unit is marked SOLD', async () => {
    const { db } = makeMockDb({ freshStatus: 'AVAILABLE' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateSerialStatus({ id: 'ser-1', status: 'SOLD', invoiceId: 'inv-1' })

    expect(res.success).toBe(true)
    expect(db.inventory.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { productId: 'prod-1' },
      update: { quantity: { decrement: 1 } },
    }))
  })

  it('does not touch inventory for a status change that is not a SOLD<->AVAILABLE transition', async () => {
    const { db } = makeMockDb({ freshStatus: 'SOLD' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateSerialStatus({ id: 'ser-1', status: 'DEFECTIVE' })

    expect(res.success).toBe(true)
    expect(db.inventory.upsert).not.toHaveBeenCalled()
  })

  it('returns an error when the serial does not exist', async () => {
    const db: Record<string, any> = {
      productSerial: { findUnique: vi.fn().mockResolvedValue(null), update: vi.fn() },
      inventory: { upsert: vi.fn() },
    }
    db.$transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateSerialStatus({ id: 'missing', status: 'AVAILABLE' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SER-006')
  })
})
