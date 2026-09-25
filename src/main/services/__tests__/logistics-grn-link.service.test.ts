import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../inventory.service', () => ({ inventoryService: { addStockTx: vi.fn().mockResolvedValue(undefined) } }))

import { getPrisma } from '../../database/db'
import { inventoryService } from '../inventory.service'
import { linkPostedGrnLine } from '../logistics-grn-link.service'

const item = (over: Record<string, unknown> = {}) => ({ id: 'i1', productId: null, rawMaterialId: null, receivedQty: 10, rejectedQty: 2, unitCost: 5, grn: { id: 'g1', grnNumber: 'GRN-1', status: 'POSTED' }, ...over })

function makeDb(itemRow: unknown = item(), product: unknown = { id: 'p1', productType: 'STANDARD', isActive: true }, claimed = 1) {
  const db: Record<string, any> = {
    gRNItem: { findUnique: vi.fn().mockResolvedValue(itemRow), updateMany: vi.fn().mockResolvedValue({ count: claimed }) },
    product: { findUnique: vi.fn().mockResolvedValue(product) }
  }
  db.$transaction = vi.fn(async (cb: (t: unknown) => unknown) => cb(db))
  return db
}

describe('link a line on a posted GRN', () => {
  beforeEach(() => vi.clearAllMocks())

  it('links the line and brings in the accepted quantity at the line cost', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await linkPostedGrnLine({ itemId: 'i1', productId: 'p1' }, 'u1')
    expect(r).toMatchObject({ success: true, data: { quantityAdded: 8 } })
    expect(db.gRNItem.updateMany).toHaveBeenCalledWith({ where: { id: 'i1', productId: null, rawMaterialId: null }, data: { productId: 'p1' } })
    const call = vi.mocked(inventoryService.addStockTx).mock.calls[0]
    expect(call.slice(1, 4)).toEqual(['p1', 8, 5])
  })

  it('refuses a GRN that is not posted, a line already linked, and an item that holds no stock', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb(item({ grn: { id: 'g1', grnNumber: 'GRN-1', status: 'DRAFT' } })) as never)
    expect(await linkPostedGrnLine({ itemId: 'i1', productId: 'p1' })).toMatchObject({ error: { code: 'GRN-011' } })
    vi.mocked(getPrisma).mockReturnValue(makeDb(item({ productId: 'x' })) as never)
    expect(await linkPostedGrnLine({ itemId: 'i1', productId: 'p1' })).toMatchObject({ error: { code: 'GRN-012' } })
    vi.mocked(getPrisma).mockReturnValue(makeDb(item(), { id: 'p1', productType: 'SERVICE', isActive: true }) as never)
    expect(await linkPostedGrnLine({ itemId: 'i1', productId: 'p1' })).toMatchObject({ error: { code: 'GRN-014' } })
    expect(inventoryService.addStockTx).not.toHaveBeenCalled()
  })

  it('does not add stock twice when two clicks race', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb(item(), undefined, 0) as never)
    expect(await linkPostedGrnLine({ itemId: 'i1', productId: 'p1' })).toMatchObject({ error: { code: 'GRN-012' } })
    expect(inventoryService.addStockTx).not.toHaveBeenCalled()
  })
})
