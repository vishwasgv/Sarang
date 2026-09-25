import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../sequence.service', () => ({ generateSequenceNumber: vi.fn().mockResolvedValue('ST-00001') }))
vi.mock('../inventory.service', () => ({ inventoryService: { adjustStock: vi.fn().mockResolvedValue({ success: true }) } }))
vi.mock('../valuation.service', () => ({ getProductCostsBatch: vi.fn().mockResolvedValue(new Map([['p1', 10], ['p2', 50]])) }))

import { getPrisma } from '../../database/db'
import { inventoryService } from '../inventory.service'
import { stockTakeService } from '../stock-take.service'

const line = (id: string, productId: string, systemQty: number, countedQty: number | null, posted = false) => ({ id, productId, productName: productId.toUpperCase(), sku: null, systemQty, countedQty, posted })
const take = (over: Record<string, unknown> = {}) => ({ id: 't1', takeNumber: 'ST-00001', status: 'IN_PROGRESS', notes: null, createdAt: new Date('2026-09-26T10:00:00Z'), postedAt: null, lines: [line('l1', 'p1', 10, 8), line('l2', 'p2', 5, 7), line('l3', 'p3', 3, null)], ...over })

function makeDb(over: Record<string, unknown> = {}) {
  const db: Record<string, any> = {
    businessProfile: { findFirst: vi.fn().mockResolvedValue({ currencyCode: 'INR' }) },
    stockTake: {
      findUnique: vi.fn().mockResolvedValue(take()),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 't1', takeNumber: 'ST-00001' }),
      update: vi.fn().mockResolvedValue({})
    },
    stockTakeLine: { update: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    inventory: { findMany: vi.fn().mockResolvedValue([{ productId: 'p1', quantity: 10, product: { productName: 'Flour', sku: 'F1' } }]), findUnique: vi.fn().mockResolvedValue({ quantity: 10 }) },
    ...over
  }
  db.$transaction = vi.fn(async (cb: (t: unknown) => unknown) => cb(db))
  return db
}

describe('stock take', () => {
  beforeEach(() => vi.clearAllMocks())

  it('starting a count snapshots the books and refuses a second open count', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const ok = await stockTakeService.start({ notes: 'Month end' }, 'u1')
    expect(ok.success).toBe(true)
    const data = db.stockTake.create.mock.calls[0][0].data
    expect(data.lines.create[0]).toMatchObject({ productId: 'p1', systemQty: 10 })

    db.stockTake.findFirst = vi.fn().mockResolvedValue({ takeNumber: 'ST-00001' })
    expect(await stockTakeService.start({})).toMatchObject({ success: false, error: { code: 'STK-002' } })
  })

  it('shows variance and its value per line and the totals of surplus and shortage', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)
    const r = await stockTakeService.get('t1')
    const d = (r as unknown as { data: { lines: Array<Record<string, unknown>>; summary: Record<string, number> } }).data
    expect(d.lines[0]).toMatchObject({ productId: 'p1', variance: -2, varianceValue: -20 })
    expect(d.lines[1]).toMatchObject({ productId: 'p2', variance: 2, varianceValue: 100 })
    expect(d.lines[2]).toMatchObject({ variance: null, varianceValue: null })
    expect(d.summary).toMatchObject({ lines: 3, counted: 2, withDifference: 2, surplusValue: 100, shortageValue: 20 })
  })

  it('counts cannot be negative and are refused once the count is closed', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)
    expect(await stockTakeService.setCounts('t1', [{ lineId: 'l1', countedQty: -1 }])).toMatchObject({ error: { code: 'STK-005' } })
    vi.mocked(getPrisma).mockReturnValue(makeDb({ stockTake: { findUnique: vi.fn().mockResolvedValue(take({ status: 'POSTED' })) } }) as never)
    expect(await stockTakeService.setCounts('t1', [{ lineId: 'l1', countedQty: 1 }])).toMatchObject({ error: { code: 'STK-004' } })
  })

  it('posting applies each difference to the stock as it is now, so sales made while counting are kept', async () => {
    const db = makeDb()
    // Two units were sold while counting: current stock is 8, the count found 2 fewer than the snapshot (10 -> 8)
    db.inventory.findUnique = vi.fn().mockImplementation(async ({ where }: { where: { productId: string } }) => ({ quantity: where.productId === 'p1' ? 8 : 5 }))
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await stockTakeService.post('t1', 'u1')
    expect(r).toMatchObject({ success: true, data: { adjusted: 2, closed: true } })
    const calls = vi.mocked(inventoryService.adjustStock).mock.calls.map((c) => c[0] as unknown as { productId: string; quantity: number })
    expect(calls).toEqual([expect.objectContaining({ productId: 'p1', quantity: 6 }), expect.objectContaining({ productId: 'p2', quantity: 7 })])
    expect(db.stockTake.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: expect.objectContaining({ status: 'POSTED' }) })
    expect(db.stockTakeLine.update).toHaveBeenCalledTimes(2)
  })

  it('a line with no difference is marked done without an adjustment; a failed adjustment leaves the count open', async () => {
    const db = makeDb({ stockTake: { findUnique: vi.fn().mockResolvedValue(take({ lines: [line('l1', 'p1', 10, 10), line('l2', 'p2', 5, 4)] })), update: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(inventoryService.adjustStock).mockResolvedValueOnce({ success: false, error: { message: 'Cannot set negative stock' } } as never)
    const r = await stockTakeService.post('t1')
    expect(r).toMatchObject({ success: true, data: { adjusted: 0, closed: false, problems: [{ product: 'P2' }] } })
    expect(db.stockTake.update).not.toHaveBeenCalled()
    expect(db.stockTakeLine.update).toHaveBeenCalledTimes(1)
  })

  it('needs at least one count to post, and cannot cancel after part was posted', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb({ stockTake: { findUnique: vi.fn().mockResolvedValue(take({ lines: [line('l1', 'p1', 10, null)] })) } }) as never)
    expect(await stockTakeService.post('t1')).toMatchObject({ error: { code: 'STK-006' } })
    vi.mocked(getPrisma).mockReturnValue(makeDb({ stockTake: { findUnique: vi.fn().mockResolvedValue(take({ lines: [{ posted: true }] })) } }) as never)
    expect(await stockTakeService.cancel('t1')).toMatchObject({ error: { code: 'STK-007' } })
  })
})
