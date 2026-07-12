import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../logistics-notification.service', () => ({ scheduleGRNPostedNotification: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../inventory.service', () => ({
  inventoryService: { addStockTx: vi.fn().mockResolvedValue(undefined), reduceStockTx: vi.fn().mockResolvedValue(undefined) }
}))
vi.mock('../supplier-ledger.service', () => ({
  supplierLedgerService: { addEntry: vi.fn().mockResolvedValue(undefined) }
}))

import { getPrisma } from '../../database/db'
import { postGRN, updateGRN, createGRN, reverseGRN } from '../logistics-grn.service'
import { inventoryService } from '../inventory.service'
import { supplierLedgerService } from '../supplier-ledger.service'
import { ServiceError } from '../../errors/service-error'

function makeGRN(overrides: Record<string, unknown> = {}) {
  return {
    id: 'grn-1', grnNumber: 'GRN-00001', status: 'VERIFIED',
    supplierId: 'sup-1', supplierName: 'ACME', purchaseOrderId: null,
    totalValue: 1000,
    items: [{ id: 'gi-1', productId: 'prod-1', rawMaterialId: null, itemName: 'Widget', receivedQty: 10, rejectedQty: 0, unitCost: 100 }],
    ...overrides
  }
}

function makePOItem(overrides: Record<string, unknown> = {}) {
  return { id: 'poi-1', productId: 'prod-1', quantity: 10, receivedQty: 0, ...overrides }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  const db: Record<string, any> = {
    goodsReceiptNote: {
      findUnique: vi.fn().mockResolvedValue(makeGRN()),
      update: vi.fn().mockResolvedValue(makeGRN({ status: 'POSTED' }))
    },
    purchaseOrder: {
      findUnique: vi.fn().mockResolvedValue({ id: 'po-1', status: 'APPROVED' }),
      update: vi.fn().mockResolvedValue({ id: 'po-1', status: 'RECEIVED' })
    },
    purchaseOrderItem: {
      findMany: vi.fn().mockResolvedValue([makePOItem()]),
      update: vi.fn().mockResolvedValue(makePOItem({ receivedQty: 10 }))
    },
    rawMaterial: { findUnique: vi.fn().mockResolvedValue(null) },
    rawMaterialMovement: { create: vi.fn() },
    gRNItem: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    productBatch: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'batch-new' }),
      update: vi.fn().mockResolvedValue({ id: 'batch-existing' }),
    },
    ...overrides
  }
  db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('createGRN / updateGRN — rejectedQty validation', () => {
  it('createGRN rejects an item where rejectedQty exceeds receivedQty', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await createGRN({
      supplierName: 'ACME',
      items: [{ itemName: 'Widget', receivedQty: 10, rejectedQty: 15, unitCost: 100 }]
    })

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-004')
  })

  it('updateGRN rejects an item where rejectedQty exceeds receivedQty', async () => {
    const db = makeDb({
      goodsReceiptNote: { findUnique: vi.fn().mockResolvedValue(makeGRN({ status: 'DRAFT' })), update: vi.fn() }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await updateGRN({
      id: 'grn-1',
      items: [{ itemName: 'Widget', receivedQty: 10, rejectedQty: 15, unitCost: 100 }]
    })

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-004')
  })
})

describe('postGRN', () => {
  it('creates a movement record (via addStockTx) and a supplier ledger debit', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await postGRN('grn-1', 'user-1')

    expect(result.success).toBe(true)
    expect(inventoryService.addStockTx).toHaveBeenCalledWith(
      db, 'prod-1', 10, 100, expect.stringContaining('GRN-00001'), 'GOODS_RECEIPT_NOTE', 'grn-1', 'user-1'
    )
    expect(supplierLedgerService.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({ supplierId: 'sup-1', debitAmount: 1000, referenceType: 'GOODS_RECEIPT_NOTE' }),
      db
    )
  })

  it('does not create a supplier ledger entry when the GRN has no linked supplier', async () => {
    const db = makeDb({ goodsReceiptNote: { findUnique: vi.fn().mockResolvedValue(makeGRN({ supplierId: null })), update: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await postGRN('grn-1')

    expect(supplierLedgerService.addEntry).not.toHaveBeenCalled()
  })

  it('rejects posting against a PO that is not APPROVED or PARTIAL_RECEIVED', async () => {
    const db = makeDb({
      goodsReceiptNote: { findUnique: vi.fn().mockResolvedValue(makeGRN({ purchaseOrderId: 'po-1' })), update: vi.fn() },
      purchaseOrder: { findUnique: vi.fn().mockResolvedValue({ id: 'po-1', status: 'CANCELLED' }), update: vi.fn() }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await postGRN('grn-1')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('PO-006')
    expect(inventoryService.addStockTx).not.toHaveBeenCalled()
  })

  it('rejects receiving more than was ordered on the linked PO', async () => {
    const db = makeDb({
      goodsReceiptNote: {
        findUnique: vi.fn().mockResolvedValue(makeGRN({ purchaseOrderId: 'po-1', items: [{ id: 'gi-1', productId: 'prod-1', rawMaterialId: null, itemName: 'Widget', receivedQty: 8, unitCost: 100 }] })),
        update: vi.fn()
      },
      purchaseOrder: { findUnique: vi.fn().mockResolvedValue({ id: 'po-1', status: 'PARTIAL_RECEIVED' }), update: vi.fn() },
      purchaseOrderItem: { findMany: vi.fn().mockResolvedValue([makePOItem({ receivedQty: 5, quantity: 10 })]), update: vi.fn() }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await postGRN('grn-1')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('GRN-001')
    expect(inventoryService.addStockTx).not.toHaveBeenCalled()
  })

  it('marks the PO RECEIVED once all line items are fully received', async () => {
    const db = makeDb({
      goodsReceiptNote: { findUnique: vi.fn().mockResolvedValue(makeGRN({ purchaseOrderId: 'po-1' })), update: vi.fn() },
      // First call (pre-update over-receipt check) sees the "before" state; second
      // call (post-update status check) sees the "after" state — mirroring what a
      // real re-fetch inside the transaction would see once the update lands.
      purchaseOrderItem: {
        findMany: vi.fn()
          .mockResolvedValueOnce([makePOItem({ receivedQty: 0, quantity: 10 })])
          .mockResolvedValue([makePOItem({ receivedQty: 10, quantity: 10 })]),
        update: vi.fn().mockResolvedValue(makePOItem({ receivedQty: 10 }))
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await postGRN('grn-1')

    expect(db.purchaseOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'RECEIVED' } })
    )
  })

  it('preserves a ServiceError thrown by addStockTx instead of swallowing it', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(inventoryService.addStockTx).mockRejectedValueOnce(new ServiceError('INV-001', 'Inventory not found for product prod-1.'))

    const result = await postGRN('grn-1')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('INV-001')
  })

  // Regression coverage for the Phase 37 re-audit finding: postGRN added the
  // full receivedQty to stock without subtracting rejectedQty, so goods that
  // failed QC on receipt were silently counted as usable inventory. Live-
  // reproduced: a GRN with receivedQty=100/rejectedQty=20 increased on-hand
  // stock by 100 instead of the correct 80.
  it('adds only the accepted quantity (receivedQty - rejectedQty) to product stock, not the full receivedQty', async () => {
    const db = makeDb({
      goodsReceiptNote: {
        findUnique: vi.fn().mockResolvedValue(makeGRN({
          items: [{ id: 'gi-1', productId: 'prod-1', rawMaterialId: null, itemName: 'Widget', receivedQty: 100, rejectedQty: 20, unitCost: 100 }]
        })),
        update: vi.fn()
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await postGRN('grn-1', 'user-1')

    expect(result.success).toBe(true)
    expect(inventoryService.addStockTx).toHaveBeenCalledWith(
      db, 'prod-1', 80, 100, expect.stringContaining('GRN-00001'), 'GOODS_RECEIPT_NOTE', 'grn-1', 'user-1'
    )
  })

  it('adds only the accepted quantity to raw material stock, not the full receivedQty', async () => {
    const db = makeDb({
      goodsReceiptNote: {
        findUnique: vi.fn().mockResolvedValue(makeGRN({
          items: [{ id: 'gi-1', productId: null, rawMaterialId: 'mat-1', itemName: 'Steel Sheet', receivedQty: 50, rejectedQty: 5, unitCost: 20 }]
        })),
        update: vi.fn()
      },
      rawMaterial: { findUnique: vi.fn().mockResolvedValue({ id: 'mat-1', currentStock: 200 }), update: vi.fn() },
      rawMaterialMovement: { create: vi.fn() },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await postGRN('grn-1')

    expect(result.success).toBe(true)
    expect(db.rawMaterial.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { currentStock: 245 } }) // 200 + (50 - 5), not 200 + 50
    )
    expect(db.rawMaterialMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantity: 45, balanceAfter: 245 }) })
    )
  })

  it('skips the stock update entirely when the full received quantity was rejected', async () => {
    const db = makeDb({
      goodsReceiptNote: {
        findUnique: vi.fn().mockResolvedValue(makeGRN({
          items: [{ id: 'gi-1', productId: 'prod-1', rawMaterialId: null, itemName: 'Widget', receivedQty: 10, rejectedQty: 10, unitCost: 100 }]
        })),
        update: vi.fn()
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await postGRN('grn-1')

    expect(result.success).toBe(true)
    expect(inventoryService.addStockTx).not.toHaveBeenCalled()
  })

  it('auto-creates a ProductBatch when the GRN line captured batchNumber + expiryDate', async () => {
    const expiryDate = new Date('2027-01-01')
    const db = makeDb({
      goodsReceiptNote: {
        findUnique: vi.fn().mockResolvedValue(makeGRN({
          items: [{ id: 'gi-1', productId: 'prod-1', rawMaterialId: null, itemName: 'Paracetamol 500mg', receivedQty: 100, rejectedQty: 0, unitCost: 2, batchNumber: 'b-2027a', expiryDate }]
        })),
        update: vi.fn()
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await postGRN('grn-1')

    expect(result.success).toBe(true)
    expect(db.productBatch.findUnique).toHaveBeenCalledWith({
      where: { productId_batchNumber: { productId: 'prod-1', batchNumber: 'B-2027A' } }
    })
    expect(db.productBatch.create).toHaveBeenCalledWith({
      data: { productId: 'prod-1', batchNumber: 'B-2027A', expiryDate, quantityReceived: 100, quantityRemaining: 100, unitCost: 2, supplierId: 'sup-1' }
    })
  })

  it('tops up an existing batch (same product + batch number) instead of creating a duplicate', async () => {
    const expiryDate = new Date('2027-01-01')
    const db = makeDb({
      goodsReceiptNote: {
        findUnique: vi.fn().mockResolvedValue(makeGRN({
          items: [{ id: 'gi-1', productId: 'prod-1', rawMaterialId: null, itemName: 'Paracetamol 500mg', receivedQty: 50, rejectedQty: 0, unitCost: 2, batchNumber: 'B-2027A', expiryDate }]
        })),
        update: vi.fn()
      },
      productBatch: {
        findUnique: vi.fn().mockResolvedValue({ id: 'batch-existing', quantityReceived: 100, quantityRemaining: 40 }),
        create: vi.fn(), update: vi.fn().mockResolvedValue({}),
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await postGRN('grn-1')

    expect(result.success).toBe(true)
    expect(db.productBatch.create).not.toHaveBeenCalled()
    expect(db.productBatch.update).toHaveBeenCalledWith({
      where: { id: 'batch-existing' },
      data: { quantityReceived: { increment: 50 }, quantityRemaining: { increment: 50 } }
    })
  })

  it('does not touch ProductBatch when the GRN line has no batchNumber/expiryDate (non-tracked product)', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await postGRN('grn-1')

    expect(result.success).toBe(true)
    expect(db.productBatch.findUnique).not.toHaveBeenCalled()
    expect(db.productBatch.create).not.toHaveBeenCalled()
  })
})

describe('updateGRN', () => {
  it('preserves productId/rawMaterialId when items are replaced (no silent unlink)', async () => {
    const db = makeDb({
      goodsReceiptNote: {
        findUnique: vi.fn().mockResolvedValue(makeGRN({ status: 'DRAFT' })),
        update: vi.fn().mockResolvedValue(makeGRN({ status: 'DRAFT' }))
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateGRN({
      id: 'grn-1',
      items: [{ productId: 'prod-1', itemName: 'Widget', receivedQty: 12, unitCost: 100 }]
    })

    expect(db.goodsReceiptNote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: { create: [expect.objectContaining({ productId: 'prod-1', receivedQty: 12 })] }
        })
      })
    )
  })
})

describe('postGRN', () => {
  it('rejects re-posting an already-posted GRN', async () => {
    const db = makeDb({ goodsReceiptNote: { findUnique: vi.fn().mockResolvedValue(makeGRN({ status: 'POSTED' })), update: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await postGRN('grn-1')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-002')
  })
})

describe('reverseGRN', () => {
  it('rejects reversing a GRN that is not POSTED', async () => {
    const db = makeDb({ goodsReceiptNote: { findUnique: vi.fn().mockResolvedValue(makeGRN({ status: 'VERIFIED' })), update: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reverseGRN('grn-1')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-002')
  })

  it('reduces product stock and credits the supplier ledger for a POSTED GRN', async () => {
    const db = makeDb({
      goodsReceiptNote: { findUnique: vi.fn().mockResolvedValue(makeGRN({ status: 'POSTED' })), update: vi.fn().mockResolvedValue(makeGRN({ status: 'REVERSED' })) },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reverseGRN('grn-1', 'user-1')

    expect(result.success).toBe(true)
    expect(inventoryService.reduceStockTx).toHaveBeenCalledWith(
      db, 'prod-1', 10, expect.stringContaining('GRN-00001'), 'GOODS_RECEIPT_NOTE_REVERSAL', 'grn-1', 'user-1'
    )
    expect(supplierLedgerService.addEntry).toHaveBeenCalledWith(
      expect.objectContaining({ supplierId: 'sup-1', creditAmount: 1000, debitAmount: 0 }),
      db
    )
    expect(db.goodsReceiptNote.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'grn-1' }, data: expect.objectContaining({ status: 'REVERSED' }) })
    )
  })

  it('decrements raw material stock and rejects if not enough remains', async () => {
    const db = makeDb({
      goodsReceiptNote: {
        findUnique: vi.fn().mockResolvedValue(makeGRN({
          status: 'POSTED',
          items: [{ id: 'gi-1', productId: null, rawMaterialId: 'mat-1', itemName: 'Steel Sheet', receivedQty: 50, rejectedQty: 0, unitCost: 20 }]
        })),
        update: vi.fn(),
      },
      rawMaterial: { findUnique: vi.fn().mockResolvedValue({ id: 'mat-1', currentStock: 30 }) }, // less than the 50 this GRN added
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reverseGRN('grn-1')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('GRN-003')
  })

  it('rolls back PO receivedQty and status on reversal', async () => {
    const db = makeDb({
      goodsReceiptNote: {
        findUnique: vi.fn().mockResolvedValue(makeGRN({ status: 'POSTED', purchaseOrderId: 'po-1' })),
        update: vi.fn().mockResolvedValue(makeGRN({ status: 'REVERSED' })),
      },
      purchaseOrderItem: {
        // First call sees pre-rollback state (receivedQty: 10, matching this GRN's
        // 10 received); second call sees the post-rollback state used to recompute PO status.
        findMany: vi.fn()
          .mockResolvedValueOnce([makePOItem({ receivedQty: 10, quantity: 10 })])
          .mockResolvedValue([makePOItem({ receivedQty: 0, quantity: 10 })]),
        update: vi.fn().mockResolvedValue(makePOItem({ receivedQty: 0 })),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reverseGRN('grn-1')

    expect(result.success).toBe(true)
    expect(db.purchaseOrderItem.update).toHaveBeenCalledWith({ where: { id: 'poi-1' }, data: { receivedQty: 0 } })
    expect(db.purchaseOrder.update).toHaveBeenCalledWith({ where: { id: 'po-1' }, data: { status: 'APPROVED' } })
  })

  it('decrements the matching ProductBatch symmetrically when reversing a GRN that created/topped one up', async () => {
    const expiryDate = new Date('2027-01-01')
    const db = makeDb({
      goodsReceiptNote: {
        findUnique: vi.fn().mockResolvedValue(makeGRN({
          status: 'POSTED',
          items: [{ id: 'gi-1', productId: 'prod-1', rawMaterialId: null, itemName: 'Paracetamol 500mg', receivedQty: 100, rejectedQty: 0, unitCost: 2, batchNumber: 'B-2027A', expiryDate }]
        })),
        update: vi.fn(),
      },
      productBatch: {
        findUnique: vi.fn().mockResolvedValue({ id: 'batch-existing', quantityReceived: 100, quantityRemaining: 100 }),
        create: vi.fn(), update: vi.fn().mockResolvedValue({}),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reverseGRN('grn-1')

    expect(result.success).toBe(true)
    expect(db.productBatch.update).toHaveBeenCalledWith({
      where: { id: 'batch-existing' },
      data: { quantityReceived: { decrement: 100 }, quantityRemaining: { decrement: 100 } }
    })
  })

  it('refuses to reverse when some of the batch has already been sold (quantityRemaining < what this GRN added)', async () => {
    const expiryDate = new Date('2027-01-01')
    const db = makeDb({
      goodsReceiptNote: {
        findUnique: vi.fn().mockResolvedValue(makeGRN({
          status: 'POSTED',
          items: [{ id: 'gi-1', productId: 'prod-1', rawMaterialId: null, itemName: 'Paracetamol 500mg', receivedQty: 100, rejectedQty: 0, unitCost: 2, batchNumber: 'B-2027A', expiryDate }]
        })),
        update: vi.fn(),
      },
      productBatch: {
        findUnique: vi.fn().mockResolvedValue({ id: 'batch-existing', quantityReceived: 100, quantityRemaining: 30 }), // 70 already sold
        create: vi.fn(), update: vi.fn(),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await reverseGRN('grn-1')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('GRN-003')
    expect(db.productBatch.update).not.toHaveBeenCalled()
  })
})
