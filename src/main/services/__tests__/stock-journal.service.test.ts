import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../sequence.service', () => ({ generateSequenceNumber: vi.fn().mockResolvedValue('SJ-00001') }))
vi.mock('../inventory.service', () => ({ inventoryService: { reduceStockTx: vi.fn().mockResolvedValue(undefined), addStockTx: vi.fn().mockResolvedValue(undefined) } }))
vi.mock('../valuation.service', () => ({ getProductCostsBatch: vi.fn().mockResolvedValue(new Map([['a', 10], ['b', 4], ['c', 0]])) }))

import { getPrisma } from '../../database/db'
import { inventoryService } from '../inventory.service'
import { stockJournalService } from '../stock-journal.service'

const prod = (id: string, over: Record<string, unknown> = {}) => ({ id, productName: id.toUpperCase(), productType: 'STANDARD', isActive: true, ...over })

function makeDb(products = [prod('a'), prod('b'), prod('c')]) {
  const db: Record<string, any> = {
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode: 'INR' }) },
    product: { findMany: vi.fn().mockResolvedValue(products) },
    stockJournal: {
      create: vi.fn().mockResolvedValue({ id: 'j1' }),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue({ id: 'j1', journalNumber: 'SJ-00001', notes: null, createdAt: new Date('2026-09-26T10:00:00Z'), lines: [] })
    }
  }
  db.$transaction = vi.fn(async (cb: (t: unknown) => unknown) => cb(db))
  return db
}

describe('stock journal', () => {
  beforeEach(() => vi.clearAllMocks())

  it('gives what comes in the value of what went out, shared by quantity', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    // 6 x 10 + 5 x 4 = 80 out; 8 + 2 = 10 in => 8 each
    const r = await stockJournalService.create({ lines: [{ kind: 'OUT', productId: 'a', quantity: 6 }, { kind: 'OUT', productId: 'b', quantity: 5 }, { kind: 'IN', productId: 'c', quantity: 10 }] }, 'u1')
    expect(r.success).toBe(true)
    expect(inventoryService.reduceStockTx).toHaveBeenCalledTimes(2)
    const add = vi.mocked(inventoryService.addStockTx).mock.calls[0]
    expect(add[1]).toBe('c')
    expect(add[2]).toBe(10)
    expect(add[3]).toBe(8)
    const lines = db.stockJournal.create.mock.calls[0][0].data.lines.create
    expect(lines.find((l: { kind: string }) => l.kind === 'IN').unitCost).toBe(8)
  })

  it('needs items on both sides, positive quantities, and no item on both sides', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)
    expect(await stockJournalService.create({ lines: [{ kind: 'IN', productId: 'c', quantity: 1 }] })).toMatchObject({ error: { code: 'SJ-002' } })
    expect(await stockJournalService.create({ lines: [{ kind: 'OUT', productId: 'a', quantity: 1 }] })).toMatchObject({ error: { code: 'SJ-003' } })
    expect(await stockJournalService.create({ lines: [{ kind: 'OUT', productId: 'a', quantity: 0 }, { kind: 'IN', productId: 'c', quantity: 1 }] })).toMatchObject({ error: { code: 'SJ-004' } })
    expect(await stockJournalService.create({ lines: [{ kind: 'OUT', productId: 'a', quantity: 1 }, { kind: 'IN', productId: 'a', quantity: 1 }] })).toMatchObject({ error: { code: 'SJ-007' } })
    expect(inventoryService.reduceStockTx).not.toHaveBeenCalled()
  })

  it('refuses items that do not hold stock', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb([prod('a'), prod('c', { productType: 'SERVICE' })]) as never)
    expect(await stockJournalService.create({ lines: [{ kind: 'OUT', productId: 'a', quantity: 1 }, { kind: 'IN', productId: 'c', quantity: 1 }] })).toMatchObject({ error: { code: 'SJ-006' } })
  })

  it('reports a stock shortage from the stock engine and saves nothing more', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)
    const { ServiceError } = await import('../../errors/service-error')
    vi.mocked(inventoryService.reduceStockTx).mockRejectedValueOnce(new ServiceError('INV-002', 'Not enough stock.'))
    expect(await stockJournalService.create({ lines: [{ kind: 'OUT', productId: 'a', quantity: 99 }, { kind: 'IN', productId: 'c', quantity: 1 }] })).toMatchObject({ error: { code: 'INV-002' } })
    expect(inventoryService.addStockTx).not.toHaveBeenCalled()
  })
})
