import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../inventory.service', () => ({
  inventoryService: { addStockTx: vi.fn().mockResolvedValue(undefined) }
}))
vi.mock('../supplier-ledger.service', () => ({
  supplierLedgerService: { addEntry: vi.fn().mockResolvedValue(undefined) }
}))
vi.mock('../auth.service', () => ({ getCurrentSession: vi.fn().mockReturnValue({ userId: 'user-1' }) }))

import { getPrisma } from '../../database/db'
import { purchaseOrderService } from '../purchase-order.service'
import { ServiceError } from '../../errors/service-error'

const baseItem = { productId: 'prod-1', quantity: 10, unitCost: 100, taxRate: 18 }
const basePayload = { supplierId: 'sup-1', items: [baseItem] }

function makeSupplier(overrides: Record<string, unknown> = {}) {
  return { id: 'sup-1', supplierName: 'ACME', isActive: true, ...overrides }
}

function makeProduct(overrides: Record<string, unknown> = {}) {
  return { id: 'prod-1', productName: 'Widget', isActive: true, productType: 'STANDARD', ...overrides }
}

function makePO(overrides: Record<string, unknown> = {}) {
  return {
    id: 'po-1', poNumber: 'PO-00001', supplierId: 'sup-1',
    status: 'DRAFT', subtotal: 1000, taxAmount: 180, totalAmount: 1180,
    notes: null, items: [],
    ...overrides
  }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  // tx === db: createPO and receivePO now run their writes inside $transaction,
  // so the callback must see the same mocked purchaseOrder/etc. the tests assert against.
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db = {
    supplier: { findUnique: vi.fn().mockResolvedValue(makeSupplier()) },
    product: { findUnique: vi.fn().mockResolvedValue(makeProduct()) },
    purchaseOrder: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ ...makePO(), supplier: makeSupplier(), items: [] }),
      findUnique: vi.fn().mockResolvedValue(makePO()),
      update: vi.fn().mockResolvedValue(makePO({ status: 'RECEIVED' })),
      findMany: vi.fn().mockResolvedValue([])
    },
    setting: {
      findUnique: vi.fn(async () => settingRow),
      update: vi.fn(async ({ data }: { data: { settingValue: string } }) => { settingRow = settingRow ? { ...settingRow, settingValue: data.settingValue } : null; return settingRow }),
      create: vi.fn(async ({ data }: { data: { settingKey: string; settingValue: string } }) => { settingRow = { settingKey: data.settingKey, settingValue: data.settingValue }; return settingRow })
    },
    ...overrides
  } as Record<string, any>
  db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('purchaseOrderService.createPO', () => {
  it('creates a PO with correct subtotal and tax', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const result = await purchaseOrderService.createPO(basePayload)

    expect(result.success).toBe(true)
    const db = vi.mocked(getPrisma)()
    const createCall = vi.mocked(db.purchaseOrder.create).mock.calls[0][0] as {
      data: { subtotal: number; taxAmount: number; totalAmount: number }
    }
    expect(createCall.data.subtotal).toBe(1000)    // 10 * 100
    expect(createCall.data.taxAmount).toBeCloseTo(180)  // 18% of 1000
    expect(createCall.data.totalAmount).toBeCloseTo(1180)
  })

  it('stores taxAmount and itcAmount on each PO item', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    await purchaseOrderService.createPO(basePayload)

    const db = vi.mocked(getPrisma)()
    const createCall = vi.mocked(db.purchaseOrder.create).mock.calls[0][0] as {
      data: { items: { create: { taxAmount: number; itcAmount: number }[] } }
    }
    const item = createCall.data.items.create[0]
    expect(item.taxAmount).toBeCloseTo(180)
    expect(item.itcAmount).toBeCloseTo(180)  // ITC = full input tax
  })

  it('rejects archived supplier with SUP-004', async () => {
    const db = makeDb()
    db.supplier.findUnique = vi.fn().mockResolvedValue(makeSupplier({ isActive: false }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await purchaseOrderService.createPO(basePayload)

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('SUP-004')
  })

  it('rejects non-existent supplier with SUP-001', async () => {
    const db = makeDb()
    db.supplier.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await purchaseOrderService.createPO(basePayload)

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('SUP-001')
  })

  it('rejects service products from PO with PRD-006', async () => {
    const db = makeDb()
    db.product.findUnique = vi.fn().mockResolvedValue(makeProduct({ productType: 'SERVICE' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await purchaseOrderService.createPO(basePayload)

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('PRD-006')
  })

  it('generates sequential PO numbers, bootstrapping from the highest existing poNumber on first use', async () => {
    const db = makeDb()
    db.purchaseOrder.findMany = vi.fn().mockResolvedValue([{ poNumber: 'PO-00099' }])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await purchaseOrderService.createPO(basePayload)

    const createCall = vi.mocked(db.purchaseOrder.create).mock.calls[0][0] as {
      data: { poNumber: string }
    }
    expect(createCall.data.poNumber).toBe('PO-00100')
  })

  it('generates the PO number inside the same transaction as the insert (no race window)', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await purchaseOrderService.createPO(basePayload)

    expect(db.$transaction).toHaveBeenCalledTimes(1)
    const settingReadOrder = vi.mocked(db.setting.findUnique).mock.invocationCallOrder[0]
    const createCallOrder = vi.mocked(db.purchaseOrder.create).mock.invocationCallOrder[0]
    expect(settingReadOrder).toBeLessThan(createCallOrder)
  })
})

describe('purchaseOrderService.approvePO', () => {
  it('transitions status from DRAFT to APPROVED', async () => {
    const db = makeDb()
    db.purchaseOrder.findUnique = vi.fn().mockResolvedValue(makePO({ status: 'DRAFT' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await purchaseOrderService.approvePO('po-1')

    expect(result.success).toBe(true)
    expect(vi.mocked(db.purchaseOrder.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'APPROVED' } })
    )
  })

  it('reads the current status inside the transaction (no read-then-write race)', async () => {
    const db = makeDb()
    db.purchaseOrder.findUnique = vi.fn().mockResolvedValue(makePO({ status: 'DRAFT' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await purchaseOrderService.approvePO('po-1')

    const txCallOrder = vi.mocked(db.$transaction).mock.invocationCallOrder[0]
    const findCallOrder = vi.mocked(db.purchaseOrder.findUnique).mock.invocationCallOrder[0]
    expect(txCallOrder).toBeLessThan(findCallOrder)
  })

  it('rejects approval when PO is not in DRAFT status', async () => {
    const db = makeDb()
    db.purchaseOrder.findUnique = vi.fn().mockResolvedValue(makePO({ status: 'RECEIVED' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await purchaseOrderService.approvePO('po-1')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('PO-002')
  })
})

describe('purchaseOrderService.receivePO', () => {
  it('requires APPROVED status before receiving', async () => {
    const db = makeDb()
    db.purchaseOrder.findUnique = vi.fn().mockResolvedValue(makePO({ status: 'DRAFT', items: [] }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await purchaseOrderService.receivePO('po-1')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('PO-003')
  })

  it('reads the PO status inside the transaction so two concurrent receives cannot both pass (no double-receive)', async () => {
    const db = makeDb()
    db.purchaseOrder.findUnique = vi.fn().mockResolvedValue(
      makePO({ status: 'APPROVED', totalAmount: 1180, items: [{ id: 'poi-1', productId: 'prod-1', quantity: 10, unitCost: 100 }] })
    )
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await purchaseOrderService.receivePO('po-1', 'user-1')

    const txCallOrder = vi.mocked(db.$transaction).mock.invocationCallOrder[0]
    const findCallOrder = vi.mocked(db.purchaseOrder.findUnique).mock.invocationCallOrder[0]
    expect(txCallOrder).toBeLessThan(findCallOrder)
  })

  it('runs inventory update and supplier ledger in a transaction', async () => {
    const db = makeDb()
    db.purchaseOrder.findUnique = vi.fn().mockResolvedValue(
      makePO({ status: 'APPROVED', totalAmount: 1180, items: [{ id: 'poi-1', productId: 'prod-1', quantity: 10, unitCost: 100 }] })
    )
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const { inventoryService } = await import('../inventory.service')
    const { supplierLedgerService } = await import('../supplier-ledger.service')

    const result = await purchaseOrderService.receivePO('po-1', 'user-1')

    expect(result.success).toBe(true)
    expect(inventoryService.addStockTx).toHaveBeenCalled()
    expect(supplierLedgerService.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({ debitAmount: 1180 }),
      expect.anything()
    )
  })

  it('preserves the specific error code when a step inside the transaction throws', async () => {
    const db = makeDb()
    db.purchaseOrder.findUnique = vi.fn().mockResolvedValue(
      makePO({ status: 'APPROVED', items: [{ id: 'poi-1', productId: 'prod-1', quantity: 10, unitCost: 100 }] })
    )
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const { inventoryService } = await import('../inventory.service')
    vi.mocked(inventoryService.addStockTx).mockRejectedValueOnce(
      new ServiceError('INV-001', 'Inventory not found for product prod-1.')
    )

    const result = await purchaseOrderService.receivePO('po-1', 'user-1')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string; message: string } }).error.code).toBe('INV-001')
    expect((result as { error: { code: string; message: string } }).error.message).toBe('Inventory not found for product prod-1.')
  })
})

describe('purchaseOrderService.cancelPO', () => {
  it('reads the current status inside the transaction (no read-then-write race)', async () => {
    const db = makeDb()
    db.purchaseOrder.findUnique = vi.fn().mockResolvedValue(makePO({ status: 'DRAFT' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await purchaseOrderService.cancelPO('po-1', 'Changed plans')

    const txCallOrder = vi.mocked(db.$transaction).mock.invocationCallOrder[0]
    const findCallOrder = vi.mocked(db.purchaseOrder.findUnique).mock.invocationCallOrder[0]
    expect(txCallOrder).toBeLessThan(findCallOrder)
  })

  it('cancels a DRAFT PO with a reason', async () => {
    const db = makeDb()
    db.purchaseOrder.findUnique = vi.fn().mockResolvedValue(makePO({ status: 'DRAFT' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await purchaseOrderService.cancelPO('po-1', 'Supplier out of stock')

    expect(result.success).toBe(true)
    expect(vi.mocked(db.purchaseOrder.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CANCELLED' }) })
    )
  })

  it('cannot cancel an already-received PO', async () => {
    const db = makeDb()
    db.purchaseOrder.findUnique = vi.fn().mockResolvedValue(makePO({ status: 'RECEIVED' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await purchaseOrderService.cancelPO('po-1', 'Mistake')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('PO-004')
  })
})

// Phase 58 §2 — reorder automation, triggered from low-stock alerts. Only
// ever drafts for a product with a default supplier configured, groups by
// supplier into one PO each, and never duplicates a product already on an
// open (DRAFT/APPROVED) PO.
describe('purchaseOrderService.generateReorderDraftPOs', () => {
  function makeReorderInventoryRow(overrides: Record<string, unknown> = {}) {
    return {
      productId: 'prod-a', quantity: 2, reorderLevel: 5, reorderQuantity: 20,
      product: { id: 'prod-a', productName: 'Widget A', productType: 'STANDARD', isActive: true, defaultSupplierId: 'sup-1', costPrice: 50, taxRate: 18 },
      ...overrides
    }
  }

  function makeReorderDb(inventoryRows: Array<Record<string, any>>, openItems: Array<{ productId: string }> = []) {
    const suppliers: Record<string, any> = {
      'sup-1': { id: 'sup-1', supplierName: 'Supplier One', isActive: true },
      'sup-2': { id: 'sup-2', supplierName: 'Supplier Two', isActive: true }
    }
    const products: Record<string, any> = {}
    for (const row of inventoryRows) products[row.product.id] = row.product

    let poCounter = 0
    let settingRow: { settingKey: string; settingValue: string } | null = null
    const db: Record<string, any> = {
      inventory: { findMany: vi.fn().mockResolvedValue(inventoryRows) },
      purchaseOrderItem: { findMany: vi.fn().mockResolvedValue(openItems) },
      supplier: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => suppliers[where.id] ?? null) },
      product: { findUnique: vi.fn(async ({ where }: { where: { id: string } }) => products[where.id] ?? null) },
      setting: {
        findUnique: vi.fn(async () => settingRow),
        update: vi.fn(async ({ data }: { data: { settingValue: string } }) => { settingRow = settingRow ? { ...settingRow, settingValue: data.settingValue } : null; return settingRow }),
        create: vi.fn(async ({ data }: { data: { settingKey: string; settingValue: string } }) => { settingRow = { settingKey: data.settingKey, settingValue: data.settingValue }; return settingRow }),
        updateMany: vi.fn(async ({ data }: { data: { settingValue: string } }) => {
          if (!settingRow) return { count: 0 }
          settingRow = { ...settingRow, settingValue: data.settingValue }
          return { count: 1 }
        })
      },
      purchaseOrder: {
        count: vi.fn().mockResolvedValue(0),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(async ({ data }: { data: { supplierId: string; notes: string | null } }) => {
          poCounter++
          return {
            id: `po-${poCounter}`, poNumber: `PO-0000${poCounter}`, supplierId: data.supplierId,
            status: 'DRAFT', subtotal: 0, taxAmount: 0, totalAmount: 0, notes: data.notes,
            supplier: suppliers[data.supplierId], items: []
          }
        })
      }
    }
    db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
    return db
  }

  it('skips a low-stock product with no default supplier configured', async () => {
    const db = makeReorderDb([
      makeReorderInventoryRow({ product: { id: 'prod-a', productName: 'A', isActive: true, defaultSupplierId: null, costPrice: 50, taxRate: 18 } })
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await purchaseOrderService.generateReorderDraftPOs()

    expect(result.success).toBe(true)
    expect(result.data?.created).toHaveLength(0)
    expect(result.data?.skippedNoDefaultSupplier).toBe(1)
  })

  it('does not draft a PO for a product whose stock is above its reorder level', async () => {
    const db = makeReorderDb([makeReorderInventoryRow({ quantity: 50, reorderLevel: 5 })])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await purchaseOrderService.generateReorderDraftPOs()

    expect(result.success).toBe(true)
    expect(result.data?.created).toHaveLength(0)
  })

  it('drafts one PO per supplier, grouping multiple due products for the same supplier', async () => {
    const db = makeReorderDb([
      makeReorderInventoryRow({ productId: 'prod-a', quantity: 2, reorderLevel: 5, reorderQuantity: 20, product: { id: 'prod-a', productName: 'A', productType: 'STANDARD', isActive: true, defaultSupplierId: 'sup-1', costPrice: 50, taxRate: 18 } }),
      makeReorderInventoryRow({ productId: 'prod-b', quantity: 1, reorderLevel: 5, reorderQuantity: 10, product: { id: 'prod-b', productName: 'B', productType: 'STANDARD', isActive: true, defaultSupplierId: 'sup-1', costPrice: 30, taxRate: 5 } })
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await purchaseOrderService.generateReorderDraftPOs()

    expect(result.success).toBe(true)
    expect(result.data?.created).toHaveLength(1)
    expect(result.data?.created?.[0].itemCount).toBe(2)
    expect(result.data?.created?.[0].supplierId).toBe('sup-1')
  })

  it('drafts separate POs for products with different default suppliers', async () => {
    const db = makeReorderDb([
      makeReorderInventoryRow({ productId: 'prod-a', quantity: 2, reorderLevel: 5, reorderQuantity: 20, product: { id: 'prod-a', productName: 'A', productType: 'STANDARD', isActive: true, defaultSupplierId: 'sup-1', costPrice: 50, taxRate: 18 } }),
      makeReorderInventoryRow({ productId: 'prod-c', quantity: 1, reorderLevel: 5, reorderQuantity: 10, product: { id: 'prod-c', productName: 'C', productType: 'STANDARD', isActive: true, defaultSupplierId: 'sup-2', costPrice: 30, taxRate: 5 } })
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await purchaseOrderService.generateReorderDraftPOs()

    expect(result.success).toBe(true)
    expect(result.data?.created).toHaveLength(2)
    expect(result.data?.created?.map(c => c.supplierId).sort()).toEqual(['sup-1', 'sup-2'])
  })

  it('skips a due product that already has an open (DRAFT/APPROVED) PO in flight — does not duplicate on repeat runs', async () => {
    const db = makeReorderDb(
      [makeReorderInventoryRow()],
      [{ productId: 'prod-a' }]
    )
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await purchaseOrderService.generateReorderDraftPOs()

    expect(result.success).toBe(true)
    expect(result.data?.created).toHaveLength(0)
    expect(result.data?.skippedAlreadyOnOpenPO).toBe(1)
  })

  it('ignores an inactive (archived) product even if its stock is below reorder level', async () => {
    const db = makeReorderDb([
      makeReorderInventoryRow({ product: { id: 'prod-a', productName: 'A', isActive: false, defaultSupplierId: 'sup-1', costPrice: 50, taxRate: 18 } })
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await purchaseOrderService.generateReorderDraftPOs()

    expect(result.success).toBe(true)
    expect(result.data?.created).toHaveLength(0)
  })

  it('produces zero results (no error) when nothing is low on stock', async () => {
    const db = makeReorderDb([])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await purchaseOrderService.generateReorderDraftPOs()

    expect(result.success).toBe(true)
    expect(result.data?.created).toHaveLength(0)
    expect(result.data?.skippedNoDefaultSupplier).toBe(0)
    expect(result.data?.skippedAlreadyOnOpenPO).toBe(0)
  })
})
