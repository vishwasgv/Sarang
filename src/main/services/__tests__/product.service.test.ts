import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../auth.service', () => ({ getCurrentSession: vi.fn().mockReturnValue({ userId: 'u1' }) }))

import { getPrisma } from '../../database/db'
import * as productService from '../product.service'

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prod-1', productName: 'Widget', sku: 'W-001', barcode: null, hsnCode: '8471',
    productType: 'STANDARD', sellByWeight: false, isActive: true, taxRate: 18,
    costPrice: 50, sellingPrice: 100, unit: 'PCS', description: null, imagePath: null,
    categoryId: 'cat-1', reorderLevel: 10, reorderQuantity: 50,
    category: { id: 'cat-1', name: 'Electronics' },
    inventory: { quantity: 100, reorderLevel: 10, reorderQuantity: 50 },
    ...overrides
  }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  const tx = {
    product: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(makeProduct()),
      update: vi.fn().mockResolvedValue(makeProduct())
    },
    inventory: { create: vi.fn().mockResolvedValue({ id: 'inv-1', quantity: 0 }) },
    inventoryMovement: { create: vi.fn().mockResolvedValue({ id: 'mov-1' }) }
  }
  return {
    product: {
      findUnique: vi.fn().mockResolvedValue(makeProduct()),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([makeProduct()]),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(makeProduct()),
      update: vi.fn().mockResolvedValue(makeProduct())
    },
    invoiceItem: { count: vi.fn().mockResolvedValue(0) },
    invoice: { count: vi.fn().mockResolvedValue(0) },
    inventory: { create: vi.fn().mockResolvedValue({ quantity: 0 }) },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
    _tx: tx,
    ...overrides
  }
}

beforeEach(() => vi.clearAllMocks())

describe('productService.getProduct', () => {
  it('returns product by id', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const result = await productService.getProduct('prod-1')

    expect(result.success).toBe(true)
    expect((result.data as { productName: string }).productName).toBe('Widget')
  })

  it('returns PRD-001 for non-existent product', async () => {
    const db = makeDb()
    db.product.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await productService.getProduct('ghost')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('PRD-001')
  })
})

describe('productService.createProduct', () => {
  it('creates STANDARD product with inventory record in transaction', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await productService.createProduct({
      productName: 'Widget', productType: 'STANDARD', sellByWeight: false, sellByPack: false,
      costPrice: 50, sellingPrice: 100, unit: 'PCS', taxRate: 18,
      reorderLevel: 10, reorderQuantity: 50, openingQuantity: 0
    })

    expect(result.success).toBe(true)
    expect(db._tx.inventory.create).toHaveBeenCalled()
  })

  it('persists Product.gender (Phase 48 — apparel gender)', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await productService.createProduct({
      productName: 'Shirt', productType: 'STANDARD', sellByWeight: false, sellByPack: false,
      costPrice: 200, sellingPrice: 400, unit: 'PCS', taxRate: 5,
      reorderLevel: 0, reorderQuantity: 0, openingQuantity: 0, gender: 'MENS'
    })

    expect(db._tx.product.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ gender: 'MENS' }) })
    )
  })

  it('defaults Product.gender to null when not supplied', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await productService.createProduct({
      productName: 'Widget', productType: 'STANDARD', sellByWeight: false, sellByPack: false,
      costPrice: 50, sellingPrice: 100, unit: 'PCS', taxRate: 18,
      reorderLevel: 10, reorderQuantity: 50, openingQuantity: 0
    })

    expect(db._tx.product.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ gender: null }) })
    )
  })

  it('persists Product.sellByPack/packUnit/unitsPerPack (Phase 58 §2 — Hardware carton/piece conversion)', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await productService.createProduct({
      productName: 'Screw', productType: 'STANDARD', sellByWeight: false, sellByPack: true,
      packUnit: 'BOX', unitsPerPack: 50,
      costPrice: 1, sellingPrice: 2, unit: 'PCS', taxRate: 18,
      reorderLevel: 0, reorderQuantity: 0, openingQuantity: 0
    })

    expect(db._tx.product.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sellByPack: true, packUnit: 'BOX', unitsPerPack: 50 }) })
    )
  })

  it('nulls out packUnit/unitsPerPack when sellByPack is false, even if stale values are sent', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await productService.createProduct({
      productName: 'Widget', productType: 'STANDARD', sellByWeight: false, sellByPack: false,
      // Simulates a stale payload with leftover pack fields the caller forgot to clear —
      // still valid at the type level (the superRefine only requires them when sellByPack is true).
      packUnit: 'BOX', unitsPerPack: 50,
      costPrice: 50, sellingPrice: 100, unit: 'PCS', taxRate: 18,
      reorderLevel: 0, reorderQuantity: 0, openingQuantity: 0
    })

    expect(db._tx.product.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ sellByPack: false, packUnit: null, unitsPerPack: null }) })
    )
  })

  it('persists Product.hsnCode (Phase 54F.17 — was captured nowhere despite being read by GST reports)', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await productService.createProduct({
      productName: 'Widget', productType: 'STANDARD', sellByWeight: false, sellByPack: false,
      costPrice: 50, sellingPrice: 100, unit: 'PCS', taxRate: 18,
      reorderLevel: 0, reorderQuantity: 0, openingQuantity: 0, hsnCode: '8471'
    })

    expect(db._tx.product.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ hsnCode: '8471' }) })
    )
  })

  it('defaults Product.hsnCode to null when not supplied', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await productService.createProduct({
      productName: 'Widget', productType: 'STANDARD', sellByWeight: false, sellByPack: false,
      costPrice: 50, sellingPrice: 100, unit: 'PCS', taxRate: 18,
      reorderLevel: 0, reorderQuantity: 0, openingQuantity: 0
    })

    expect(db._tx.product.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ hsnCode: null }) })
    )
  })

  it('rejects duplicate SKU with PRD-002', async () => {
    const db = makeDb()
    // tx-level findUnique (the dup check now runs inside the transaction) returns an existing product
    db._tx.product.findUnique = vi.fn().mockResolvedValue(makeProduct())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await productService.createProduct({
      productName: 'Copy', sku: 'W-001', productType: 'STANDARD', sellByWeight: false, sellByPack: false,
      costPrice: 10, sellingPrice: 20, unit: 'PCS', taxRate: 0,
      reorderLevel: 0, reorderQuantity: 0, openingQuantity: 0
    })

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('PRD-002')
  })

  it('checks SKU uniqueness inside the transaction (no race window)', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await productService.createProduct({
      productName: 'Widget', sku: 'NEW-001', productType: 'STANDARD', sellByWeight: false, sellByPack: false,
      costPrice: 50, sellingPrice: 100, unit: 'PCS', taxRate: 18,
      reorderLevel: 10, reorderQuantity: 50, openingQuantity: 0
    })

    const txCallOrder = vi.mocked(db.$transaction).mock.invocationCallOrder[0]
    const findCallOrder = vi.mocked(db._tx.product.findUnique).mock.invocationCallOrder[0]
    expect(txCallOrder).toBeLessThan(findCallOrder)
  })

  it('seeds inventory with a real cost basis when opening stock is given', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await productService.createProduct({
      productName: 'Widget', productType: 'STANDARD', sellByWeight: false, sellByPack: false,
      costPrice: 50, sellingPrice: 100, unit: 'PCS', taxRate: 18,
      reorderLevel: 10, reorderQuantity: 50, openingQuantity: 25
    })

    expect(db._tx.inventory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantity: 25, averageCost: 50 }) })
    )
    expect(db._tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ movementType: 'ADDITION', quantity: 25, referenceType: 'OPENING_STOCK' }) })
    )
  })

  it('does not write a movement when opening stock is zero', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await productService.createProduct({
      productName: 'Widget', productType: 'STANDARD', sellByWeight: false, sellByPack: false,
      costPrice: 50, sellingPrice: 100, unit: 'PCS', taxRate: 18,
      reorderLevel: 10, reorderQuantity: 50, openingQuantity: 0
    })

    expect(db._tx.inventory.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantity: 0, averageCost: 0 }) })
    )
    expect(db._tx.inventoryMovement.create).not.toHaveBeenCalled()
  })

  it('does not create inventory record for SERVICE products', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await productService.createProduct({
      productName: 'Consultation', productType: 'SERVICE', sellByWeight: false, sellByPack: false,
      costPrice: 0, sellingPrice: 500, unit: 'HRS', taxRate: 18,
      reorderLevel: 0, reorderQuantity: 0, openingQuantity: 0
    })

    expect(db._tx.inventory.create).not.toHaveBeenCalled()
  })
})

describe('productService.updateProduct', () => {
  it('persists Product.gender on update (Phase 48 — apparel gender)', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await productService.updateProduct({
      id: 'prod-1', productName: 'Widget', productType: 'STANDARD', sellByWeight: false, sellByPack: false,
      costPrice: 50, sellingPrice: 100, unit: 'PCS', taxRate: 18,
      reorderLevel: 10, reorderQuantity: 50, gender: 'UNISEX'
    })

    expect(db._tx.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ gender: 'UNISEX' }) })
    )
  })

  it('persists Product.hsnCode on update (Phase 54F.17)', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await productService.updateProduct({
      id: 'prod-1', productName: 'Widget', productType: 'STANDARD', sellByWeight: false, sellByPack: false,
      costPrice: 50, sellingPrice: 100, unit: 'PCS', taxRate: 18,
      reorderLevel: 10, reorderQuantity: 50, hsnCode: '1006'
    })

    expect(db._tx.product.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ hsnCode: '1006' }) })
    )
  })
})

describe('productService.archiveProduct', () => {
  it('archives a product with no active invoices', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const result = await productService.archiveProduct('prod-1')

    expect(result.success).toBe(true)
    const db = vi.mocked(getPrisma)()
    expect(vi.mocked(db.product.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } })
    )
  })

  it('blocks archiving product used in active invoices', async () => {
    const db = makeDb()
    db.invoiceItem.count = vi.fn().mockResolvedValue(3)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await productService.archiveProduct('prod-1')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('PRD-004')
  })
})

describe('productService.listProducts', () => {
  it('returns paginated product list', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const result = await productService.listProducts({ page: 1, limit: 20 })

    expect(result.success).toBe(true)
  })

  it('filters by categoryId when provided', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    await productService.listProducts({ categoryId: 'cat-1' })

    const db = vi.mocked(getPrisma)()
    const findManyCall = vi.mocked(db.product.findMany).mock.calls[0][0] as { where: Record<string, unknown> }
    expect(findManyCall.where).toEqual(expect.objectContaining({ categoryId: 'cat-1' }))
  })
})

describe('productService.searchProducts', () => {
  it('returns matching products by name or SKU', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const result = await productService.searchProducts('Widget')

    expect(result.success).toBe(true)
  })
})

// ─── Phase 58 §2 (2026-07-17) — setProductAvailability ("86 today") ────────

describe('productService.setProductAvailability', () => {
  it('sets unavailableUntil when 86ing a product', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const endOfToday = new Date(); endOfToday.setHours(23, 59, 59, 999)

    const result = await productService.setProductAvailability('prod-1', endOfToday.toISOString())

    expect(result.success).toBe(true)
    expect(db.product.update).toHaveBeenCalledWith({ where: { id: 'prod-1' }, data: { unavailableUntil: endOfToday } })
  })

  it('clears unavailableUntil back to null when restoring availability', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await productService.setProductAvailability('prod-1', null)

    expect(result.success).toBe(true)
    expect(db.product.update).toHaveBeenCalledWith({ where: { id: 'prod-1' }, data: { unavailableUntil: null } })
  })
})

// Phase 58 §2 — Distributor customer-class/negotiated pricing. Resolved
// fresh server-side at every add-to-cart/accept site — never trusted from
// the client, exactly like Product.sellingPrice itself.
describe('productService.resolveCustomerPrice', () => {
  it('throws if the product does not exist', async () => {
    const db = makeDb()
    db.product.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await expect(productService.resolveCustomerPrice('ghost')).rejects.toThrow('Product not found.')
  })

  it('returns the plain sellingPrice when no customerId is given', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const price = await productService.resolveCustomerPrice('prod-1')
    expect(price).toBe(100)
  })

  it('returns the plain sellingPrice when the customer has no customerClass set', async () => {
    const db = makeDb({ customer: { findUnique: vi.fn().mockResolvedValue({ customerClass: null }) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const price = await productService.resolveCustomerPrice('prod-1', 'cust-1')
    expect(price).toBe(100)
  })

  it('returns the plain sellingPrice when the customer has a class but no price is on file for it', async () => {
    const db = makeDb({
      customer: { findUnique: vi.fn().mockResolvedValue({ customerClass: 'RETAILER' }) },
      customerClassPrice: { findUnique: vi.fn().mockResolvedValue(null) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const price = await productService.resolveCustomerPrice('prod-1', 'cust-1')
    expect(price).toBe(100)
  })

  it('returns the negotiated class price when one is on file, overriding sellingPrice', async () => {
    const findUniqueSpy = vi.fn().mockResolvedValue({ id: 'cp-1', price: 75 })
    const db = makeDb({
      customer: { findUnique: vi.fn().mockResolvedValue({ customerClass: 'WHOLESALER' }) },
      customerClassPrice: { findUnique: findUniqueSpy }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const price = await productService.resolveCustomerPrice('prod-1', 'cust-1')
    expect(price).toBe(75)
    expect(findUniqueSpy).toHaveBeenCalledWith({
      where: { productId_customerClass: { productId: 'prod-1', customerClass: 'WHOLESALER' } }
    })
  })
})

describe('productService.upsertCustomerClassPrice / listCustomerClassPrices / deleteCustomerClassPrice', () => {
  it('rejects a negative price', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await productService.upsertCustomerClassPrice({ productId: 'prod-1', customerClass: 'RETAILER', price: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects when the product does not exist', async () => {
    const db = makeDb()
    db.product.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await productService.upsertCustomerClassPrice({ productId: 'ghost', customerClass: 'RETAILER', price: 10 })
    expect(result.success).toBe(false)
  })

  it('upserts keyed on (productId, customerClass), creating on first call and updating on repeat', async () => {
    const upsertSpy = vi.fn().mockResolvedValue({ id: 'cp-1', productId: 'prod-1', customerClass: 'RETAILER', price: 90 })
    const db = makeDb({ customerClassPrice: { upsert: upsertSpy } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await productService.upsertCustomerClassPrice({ productId: 'prod-1', customerClass: 'RETAILER', price: 90 })
    expect(result.success).toBe(true)
    expect(upsertSpy).toHaveBeenCalledWith({
      where: { productId_customerClass: { productId: 'prod-1', customerClass: 'RETAILER' } },
      create: { productId: 'prod-1', customerClass: 'RETAILER', price: 90 },
      update: { price: 90 }
    })
  })

  it('lists prices, optionally scoped to a product', async () => {
    const findManySpy = vi.fn().mockResolvedValue([{ id: 'cp-1', productId: 'prod-1', customerClass: 'RETAILER', price: 90 }])
    const db = makeDb({ customerClassPrice: { findMany: findManySpy } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await productService.listCustomerClassPrices('prod-1')
    expect(result.success).toBe(true)
    expect(findManySpy).toHaveBeenCalledWith(expect.objectContaining({ where: { productId: 'prod-1' } }))
  })

  it('deletes a price by id', async () => {
    const deleteSpy = vi.fn().mockResolvedValue({})
    const db = makeDb({ customerClassPrice: { delete: deleteSpy } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await productService.deleteCustomerClassPrice('cp-1')
    expect(result.success).toBe(true)
    expect(deleteSpy).toHaveBeenCalledWith({ where: { id: 'cp-1' } })
  })
})
