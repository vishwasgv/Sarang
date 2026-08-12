import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { priceListService } from '../price-list.service'

function makeDb(overrides: Record<string, unknown> = {}) {
  const db = {
    priceList: {
      create: vi.fn().mockResolvedValue({ id: 'pl-1', name: 'Wholesale', appliesTo: 'CUSTOMER' }),
      findUnique: vi.fn().mockResolvedValue({ id: 'pl-1', name: 'Wholesale', appliesTo: 'CUSTOMER', isActive: true }),
      update: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([])
    },
    priceListItem: {
      deleteMany: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([])
    },
    product: {
      findUnique: vi.fn().mockResolvedValue({ id: 'prod-1', sellingPrice: 100, costPrice: 60 })
    },
    customer: {
      findUnique: vi.fn().mockResolvedValue({ id: 'cust-1', priceListId: null, customerClass: null })
    },
    supplier: {
      findUnique: vi.fn().mockResolvedValue({ id: 'sup-1', priceListId: null })
    },
    customerClassPrice: {
      findUnique: vi.fn().mockResolvedValue(null)
    },
    ...overrides
  } as Record<string, any>
  db.$transaction = vi.fn((arg: unknown) =>
    Array.isArray(arg) ? Promise.all(arg) : (arg as (tx: unknown) => unknown)(db)
  )
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('priceListService.setPriceListItems', () => {
  it('rejects a non-existent price list', async () => {
    const db = makeDb({ priceList: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await priceListService.setPriceListItems({ priceListId: 'ghost', items: [{ productId: 'prod-1', minQuantity: 1, unitPrice: 90 }] })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PL-001')
  })

  it('rejects a line referencing a non-existent product', async () => {
    const db = makeDb({ product: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await priceListService.setPriceListItems({ priceListId: 'pl-1', items: [{ productId: 'ghost', minQuantity: 1, unitPrice: 90 }] })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PRD-001')
  })

  it('replaces the full tier table atomically (delete then recreate)', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await priceListService.setPriceListItems({
      priceListId: 'pl-1',
      items: [
        { productId: 'prod-1', minQuantity: 1, unitPrice: 95 },
        { productId: 'prod-1', minQuantity: 10, unitPrice: 85 }
      ]
    })

    expect(res.success).toBe(true)
    expect(db.priceListItem.deleteMany).toHaveBeenCalledWith({ where: { priceListId: 'pl-1' } })
    expect(db.priceListItem.createMany).toHaveBeenCalledWith({
      data: [
        { priceListId: 'pl-1', productId: 'prod-1', minQuantity: 1, unitPrice: 95 },
        { priceListId: 'pl-1', productId: 'prod-1', minQuantity: 10, unitPrice: 85 }
      ]
    })
  })
})

describe('priceListService.resolvePrice — three-tier resolution, most-specific wins', () => {
  it('falls back to Product.sellingPrice when the customer has no PriceList and no customerClass', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await priceListService.resolvePrice({ counterpartyId: 'cust-1', for: 'CUSTOMER', productId: 'prod-1', quantity: 1 })

    expect(res.success).toBe(true)
    expect((res as { data: { unitPrice: number; source: string } }).data).toEqual({ unitPrice: 100, source: 'DEFAULT' })
  })

  it('uses CustomerClassPrice when no PriceList is assigned but a customerClass matches', async () => {
    const db = makeDb({
      customer: { findUnique: vi.fn().mockResolvedValue({ id: 'cust-1', priceListId: null, customerClass: 'WHOLESALER' }) },
      customerClassPrice: { findUnique: vi.fn().mockResolvedValue({ price: 88 }) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await priceListService.resolvePrice({ counterpartyId: 'cust-1', for: 'CUSTOMER', productId: 'prod-1', quantity: 1 })

    expect(res.success).toBe(true)
    expect((res as { data: { unitPrice: number; source: string } }).data).toEqual({ unitPrice: 88, source: 'CUSTOMER_CLASS' })
  })

  it('a PriceList assignment wins over CustomerClassPrice, even when both exist', async () => {
    const db = makeDb({
      customer: { findUnique: vi.fn().mockResolvedValue({ id: 'cust-1', priceListId: 'pl-1', customerClass: 'WHOLESALER' }) },
      customerClassPrice: { findUnique: vi.fn().mockResolvedValue({ price: 88 }) },
      priceListItem: { ...makeDb().priceListItem, findMany: vi.fn().mockResolvedValue([{ minQuantity: 1, unitPrice: 82 }]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await priceListService.resolvePrice({ counterpartyId: 'cust-1', for: 'CUSTOMER', productId: 'prod-1', quantity: 1 })

    expect(res.success).toBe(true)
    expect((res as { data: { unitPrice: number; source: string } }).data).toEqual({ unitPrice: 82, source: 'PRICE_LIST' })
  })

  it('picks the highest minQuantity tier that is still ≤ the requested quantity, not just any match', async () => {
    const db = makeDb({
      customer: { findUnique: vi.fn().mockResolvedValue({ id: 'cust-1', priceListId: 'pl-1', customerClass: null }) },
      priceListItem: {
        deleteMany: vi.fn(), createMany: vi.fn(),
        findMany: vi.fn().mockResolvedValue([
          { minQuantity: 1, unitPrice: 100 },
          { minQuantity: 10, unitPrice: 90 },
          { minQuantity: 50, unitPrice: 80 }
        ])
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await priceListService.resolvePrice({ counterpartyId: 'cust-1', for: 'CUSTOMER', productId: 'prod-1', quantity: 12 })

    expect(res.success).toBe(true)
    // 12 qualifies for the minQuantity=10 tier (90), not minQuantity=1 (100) or minQuantity=50 (80)
    expect((res as { data: { unitPrice: number } }).data.unitPrice).toBe(90)
  })

  it('falls back to Product.costPrice for a supplier lookup, not sellingPrice', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await priceListService.resolvePrice({ counterpartyId: 'sup-1', for: 'SUPPLIER', productId: 'prod-1', quantity: 1 })

    expect(res.success).toBe(true)
    expect((res as { data: { unitPrice: number; source: string } }).data).toEqual({ unitPrice: 60, source: 'DEFAULT' })
  })

  it('returns an error for a non-existent product', async () => {
    const db = makeDb({ product: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await priceListService.resolvePrice({ counterpartyId: 'cust-1', for: 'CUSTOMER', productId: 'ghost', quantity: 1 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('PRD-001')
  })
})
