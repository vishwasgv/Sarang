import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { holdSale, listHeldSales, resumeSale, deleteHeldSale } from '../held-sale.service'

function makeMockDb() {
  const db: Record<string, any> = {
    heldSale: {
      create: vi.fn(), findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(), delete: vi.fn(),
    },
  }
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('held-sale.service — holdSale', () => {
  it('rejects an empty cart', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await holdSale({ cartJson: '[]', itemCount: 0, totalAmount: 0 })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('HLD-001')
    expect(db.heldSale.create).not.toHaveBeenCalled()
  })

  it('rejects a missing cartJson', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await holdSale({ cartJson: '', itemCount: 2, totalAmount: 500 })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('HLD-001')
  })

  it('creates a held sale row with the label trimmed and optional fields null when omitted', async () => {
    const db = makeMockDb()
    db.heldSale.create.mockResolvedValue({ id: 'held-1' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await holdSale({ cartJson: '[{"productId":"p1"}]', itemCount: 1, totalAmount: 250, label: '  Rahul - blue shirt  ' })
    expect(res.success).toBe(true)
    expect(db.heldSale.create).toHaveBeenCalledWith({
      data: {
        label: 'Rahul - blue shirt', customerId: null,
        cartJson: '[{"productId":"p1"}]', itemCount: 1, totalAmount: 250,
        createdById: null,
      },
    })
  })

  it('links a customerId and createdById when given', async () => {
    const db = makeMockDb()
    db.heldSale.create.mockResolvedValue({ id: 'held-2' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await holdSale({ cartJson: '[]'.replace('[]', '[{"productId":"p1"}]'), itemCount: 1, totalAmount: 100, customerId: 'cust-1', createdById: 'user-1' })
    expect(db.heldSale.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ customerId: 'cust-1', createdById: 'user-1' }),
    }))
  })
})

describe('held-sale.service — listHeldSales', () => {
  it('returns held sales newest-first with the linked customer name resolved', async () => {
    const db = makeMockDb()
    db.heldSale.findMany.mockResolvedValue([
      { id: 'held-1', label: null, customerId: 'cust-1', itemCount: 2, totalAmount: 400, createdAt: new Date('2026-07-17T10:00:00Z'), customer: { customerName: 'Jane Doe' } },
      { id: 'held-2', label: 'Walk-in', customerId: null, itemCount: 1, totalAmount: 100, createdAt: new Date('2026-07-17T09:00:00Z'), customer: null },
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listHeldSales()
    expect(res.success).toBe(true)
    expect(db.heldSale.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { createdAt: 'desc' } }))
    const sales = (res as { data: { sales: Array<{ id: string; customerName: string | null }> } }).data.sales
    expect(sales[0].customerName).toBe('Jane Doe')
    expect(sales[1].customerName).toBeNull()
  })
})

describe('held-sale.service — resumeSale', () => {
  it('returns the cartJson and deletes the row so it cannot be resumed twice', async () => {
    const db = makeMockDb()
    db.heldSale.findUnique.mockResolvedValue({ id: 'held-1', cartJson: '[{"productId":"p1"}]' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await resumeSale('held-1', 'user-1')
    expect(res.success).toBe(true)
    expect((res as { data: { cartJson: string } }).data.cartJson).toBe('[{"productId":"p1"}]')
    expect(db.heldSale.delete).toHaveBeenCalledWith({ where: { id: 'held-1' } })
  })

  it('rejects resuming a held sale that no longer exists', async () => {
    const db = makeMockDb()
    db.heldSale.findUnique.mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await resumeSale('missing-id')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('HLD-004')
    expect(db.heldSale.delete).not.toHaveBeenCalled()
  })
})

describe('held-sale.service — deleteHeldSale', () => {
  it('deletes the row', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await deleteHeldSale('held-1', 'user-1')
    expect(res.success).toBe(true)
    expect(db.heldSale.delete).toHaveBeenCalledWith({ where: { id: 'held-1' } })
  })
})
