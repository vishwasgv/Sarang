import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { updateDispatchStatus } from '../dispatch.service'

function makeDb(opts: { outerStatus: string; freshStatus: string; quantity?: number; availableQty?: number }) {
  const txClient: Record<string, any> = {
    dispatchRecord: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        status: opts.freshStatus, productId: 'prod-1', quantity: opts.quantity ?? 10,
        dispatchNumber: 'DSP-001', destination: 'Warehouse B'
      }),
      update: vi.fn().mockResolvedValue({})
    },
    inventory: {
      findUnique: vi.fn().mockResolvedValue({ quantity: opts.availableQty ?? 100 }),
      update: vi.fn().mockResolvedValue({})
    },
    inventoryMovement: { create: vi.fn().mockResolvedValue({}) }
  }
  const db: Record<string, any> = {
    dispatchRecord: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'dsp-1', status: opts.outerStatus, productId: 'prod-1', quantity: opts.quantity ?? 10,
        dispatchNumber: 'DSP-001', destination: 'Warehouse B'
      })
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(txClient))
  }
  db.__txClient = txClient
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('dispatch.service.updateDispatchStatus', () => {
  it('marks a READY dispatch as DISPATCHED and deducts inventory once', async () => {
    const db = makeDb({ outerStatus: 'READY', freshStatus: 'READY', quantity: 10, availableQty: 50 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateDispatchStatus({ id: 'dsp-1', status: 'DISPATCHED' }, 'user-1')

    expect(res.success).toBe(true)
    expect(db.__txClient.inventory.update).toHaveBeenCalledWith({
      where: { productId: 'prod-1' },
      data: { quantity: { decrement: 10 } }
    })
    expect(db.__txClient.inventoryMovement.create).toHaveBeenCalledTimes(1)
  })

  it('is idempotent when the outer pre-check already sees the target status', async () => {
    const db = makeDb({ outerStatus: 'DISPATCHED', freshStatus: 'DISPATCHED' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateDispatchStatus({ id: 'dsp-1', status: 'DISPATCHED' })

    expect(res.success).toBe(true)
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  // Regression for a real TOCTOU stock race found 2026-07-22: the old code
  // checked `record.status === 'READY'` against the PRE-TRANSACTION
  // snapshot. Two concurrent calls could both see READY and both decrement
  // inventory once each — double-deducting stock for one physical dispatch.
  // Simulates exactly that: the outer pre-check sees READY (as it would for
  // the second of two near-simultaneous calls, since neither has committed
  // yet), but by the time this call's transaction actually acquires the
  // lock, the record has already been flipped to DISPATCHED by the other
  // concurrent call — the fresh in-transaction read must see that and skip
  // the second decrement entirely.
  it('does not double-decrement inventory when a concurrent call already transitioned the record before this one reached the transaction', async () => {
    const db = makeDb({ outerStatus: 'READY', freshStatus: 'DISPATCHED', quantity: 10, availableQty: 50 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateDispatchStatus({ id: 'dsp-1', status: 'DISPATCHED' }, 'user-1')

    expect(res.success).toBe(true)
    expect(db.__txClient.inventory.update).not.toHaveBeenCalled()
    expect(db.__txClient.inventoryMovement.create).not.toHaveBeenCalled()
  })

  it('rejects the dispatch when fresh in-transaction stock is insufficient, even if the outer pre-check never looked at stock at all', async () => {
    const db = makeDb({ outerStatus: 'READY', freshStatus: 'READY', quantity: 20, availableQty: 5 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateDispatchStatus({ id: 'dsp-1', status: 'DISPATCHED' }, 'user-1')

    expect(res.success).toBe(false)
    expect(db.__txClient.inventory.update).not.toHaveBeenCalled()
  })

  it('returns DSP-004 for a non-existent dispatch record', async () => {
    const db = makeDb({ outerStatus: 'READY', freshStatus: 'READY' })
    db.dispatchRecord.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateDispatchStatus({ id: 'ghost', status: 'DISPATCHED' })

    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('DSP-004')
  })
})
