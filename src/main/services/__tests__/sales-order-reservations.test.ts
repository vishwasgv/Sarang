import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { reservedBySalesOrders, stockShortagesForOrder } from '../sales-order-reservations'

describe('sales order reservations', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reserves what is ordered and not yet invoiced, added across orders', async () => {
    vi.mocked(getPrisma).mockReturnValue({
      salesOrderItem: { findMany: vi.fn().mockResolvedValue([
        { productId: 'p1', quantity: 10, invoicedQty: 4 },
        { productId: 'p1', quantity: 3, invoicedQty: 0 },
        { productId: 'p2', quantity: 5, invoicedQty: 5 },
        { productId: null, quantity: 9, invoicedQty: 0 }
      ]) }
    } as never)
    const m = await reservedBySalesOrders()
    expect(m.get('p1')).toBe(9)
    expect(m.has('p2')).toBe(false)
  })

  it('flags a line only when stock minus the other orders is not enough', async () => {
    const findMany = vi.fn()
    findMany.mockResolvedValueOnce([{ productId: 'p1', quantity: 6, invoicedQty: 0, product: { productName: 'Flour' } }])
      .mockResolvedValueOnce([{ productId: 'p1', quantity: 6, invoicedQty: 0 }, { productId: 'p1', quantity: 4, invoicedQty: 0 }])
    vi.mocked(getPrisma).mockReturnValue({
      salesOrderItem: { findMany },
      inventory: { findMany: vi.fn().mockResolvedValue([{ productId: 'p1', quantity: 8 }]) }
    } as never)
    const r = await stockShortagesForOrder('so1')
    expect(r).toEqual([{ productId: 'p1', productName: 'Flour', needed: 6, available: 4 }])
  })
})
