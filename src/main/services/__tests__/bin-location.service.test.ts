import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { binLocationService } from '../bin-location.service'

function makeDb(over: Record<string, unknown> = {}) {
  return {
    location: { findUnique: vi.fn().mockResolvedValue({ id: 'l1' }) },
    product: { findUnique: vi.fn().mockResolvedValue({ id: 'p1' }), findMany: vi.fn().mockResolvedValue([{ id: 'p1', productName: 'Flour', sku: 'F1' }, { id: 'p2', productName: 'Rice', sku: null }]) },
    locationStock: { findMany: vi.fn().mockResolvedValue([{ productId: 'p1', quantity: 5 }]) },
    productBin: { findMany: vi.fn().mockResolvedValue([{ productId: 'p2', binCode: 'A-1' }]), upsert: vi.fn().mockResolvedValue({}), deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    ...over
  }
}

describe('bin locations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists items with stock or a bin at the location, with their bin', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await binLocationService.listForLocation('l1')
    expect(r).toMatchObject({ success: true, data: [{ productId: 'p1', quantity: 5, binCode: '' }, { productId: 'p2', quantity: 0, binCode: 'A-1' }] })
    expect(db.product.findMany.mock.calls[0][0].where.id.in.sort()).toEqual(['p1', 'p2'])
  })

  it('sets a trimmed bin, and clears it when the text is empty', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await binLocationService.setBin({ productId: 'p1', locationId: 'l1', binCode: '  B-2 ' })
    expect(db.productBin.upsert.mock.calls[0][0]).toMatchObject({ create: { binCode: 'B-2' }, update: { binCode: 'B-2' } })
    await binLocationService.setBin({ productId: 'p1', locationId: 'l1', binCode: '   ' })
    expect(db.productBin.deleteMany).toHaveBeenCalledWith({ where: { productId: 'p1', locationId: 'l1' } })
  })

  it('refuses an unknown location or item', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb({ location: { findUnique: vi.fn().mockResolvedValue(null) } }) as never)
    expect(await binLocationService.setBin({ productId: 'p1', locationId: 'x', binCode: 'A' })).toMatchObject({ error: { code: 'BIN-001' } })
    vi.mocked(getPrisma).mockReturnValue(makeDb({ product: { findUnique: vi.fn().mockResolvedValue(null) } }) as never)
    expect(await binLocationService.setBin({ productId: 'x', locationId: 'l1', binCode: 'A' })).toMatchObject({ error: { code: 'BIN-002' } })
  })
})
