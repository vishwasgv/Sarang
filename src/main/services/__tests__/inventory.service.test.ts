import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { inventoryService } from '../inventory.service'

function makeInventoryRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inv-record-1', productId: 'prod-1', quantity: 100, reorderLevel: 10,
    reorderQuantity: 50, averageCost: 50,
    product: { id: 'prod-1', productName: 'Widget', sku: 'W-001', productType: 'STANDARD', isActive: true, costPrice: 50, sellingPrice: 100, unit: 'PCS', category: { id: 'cat-1', name: 'General' } },
    ...overrides
  }
}

function makeTx() {
  return {
    inventory: {
      update: vi.fn().mockResolvedValue(makeInventoryRecord({ quantity: 120 })),
      findUnique: vi.fn().mockResolvedValue(makeInventoryRecord())
    },
    inventoryMovement: { create: vi.fn().mockResolvedValue({ id: 'mov-1' }) }
  }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  const tx = makeTx()
  return {
    inventory: {
      findUnique: vi.fn().mockResolvedValue(makeInventoryRecord()),
      findMany: vi.fn().mockResolvedValue([makeInventoryRecord()]),
      update: vi.fn().mockResolvedValue(makeInventoryRecord())
    },
    inventoryMovement: {
      create: vi.fn().mockResolvedValue({ id: 'mov-1' }),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0)
    },
    product: {
      findUnique: vi.fn().mockResolvedValue({ id: 'prod-1', isActive: true, productType: 'STANDARD', productName: 'Widget' })
    },
    setting: { findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
    _tx: tx,
    ...overrides
  }
}

beforeEach(() => vi.clearAllMocks())

describe('inventoryService.getInventory', () => {
  it('returns inventory for a known product', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const result = await inventoryService.getInventory('prod-1')

    expect(result.success).toBe(true)
    expect((result.data as { quantity: number }).quantity).toBe(100)
  })

  it('returns INV-001 error when no inventory record exists', async () => {
    const db = makeDb()
    db.inventory.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await inventoryService.getInventory('nonexistent')

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('INV-001')
  })
})

describe('inventoryService.listInventory', () => {
  it('returns inventory list with pagination', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const result = await inventoryService.listInventory({ page: 1, limit: 20 })

    expect(result.success).toBe(true)
  })

  it('applies in-memory lowStockOnly filter', async () => {
    const db = makeDb()
    db.inventory.findMany = vi.fn().mockResolvedValue([
      makeInventoryRecord({ quantity: 5, reorderLevel: 10 }),    // low stock
      makeInventoryRecord({ id: 'inv-2', quantity: 100, reorderLevel: 10 })  // normal
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await inventoryService.listInventory({ lowStockOnly: true })

    expect(result.success).toBe(true)
    const data = result.data as { inventory: unknown[] }
    expect(data.inventory).toHaveLength(1)
  })
})

describe('inventoryService.addStock', () => {
  it('adds stock successfully when inventory record exists', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const result = await inventoryService.addStock({ productId: 'prod-1', quantity: 20, unitCost: 50, reason: 'Purchase receipt' })

    expect(result.success).toBe(true)
  })

  it('returns INV-001 when inventory record does not exist', async () => {
    const db = makeDb()
    db._tx.inventory.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await inventoryService.addStock({ productId: 'ghost', quantity: 10, unitCost: 50, reason: 'Purchase' })

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('INV-001')
  })

  it('creates an ADDITION movement record inside transaction', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await inventoryService.addStock({ productId: 'prod-1', quantity: 20, unitCost: 50, reason: 'Purchase' })

    expect(db._tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ movementType: 'ADDITION', quantity: 20 })
      })
    )
  })

  it('recalculates weighted average cost on stock addition', async () => {
    // Current: 100 qty @ 50 = 5000 value; adding 20 @ 60 = 1200; new avg = 6200/120 ≈ 51.67
    const db = makeDb()
    db._tx.inventory.findUnique = vi.fn().mockResolvedValue(makeInventoryRecord({ quantity: 100, averageCost: 50 }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await inventoryService.addStock({ productId: 'prod-1', quantity: 20, unitCost: 60, reason: 'Purchase' })

    expect(db._tx.inventory.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          averageCost: expect.closeTo(51.67, 1)
        })
      })
    )
  })
})

describe('inventoryService.adjustStock', () => {
  it('adjusts stock to the new quantity', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const result = await inventoryService.adjustStock({ productId: 'prod-1', quantity: 80, reason: 'Count correction' })

    expect(result.success).toBe(true)
  })

  it('returns INV-001 when inventory record not found', async () => {
    const db = makeDb()
    db._tx.inventory.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await inventoryService.adjustStock({ productId: 'ghost', quantity: 10, reason: 'Test' })

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('INV-001')
  })

  it('creates an ADJUSTMENT movement with the quantity difference', async () => {
    const db = makeDb()
    db._tx.inventory.findUnique = vi.fn().mockResolvedValue(makeInventoryRecord({ quantity: 100 }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await inventoryService.adjustStock({ productId: 'prod-1', quantity: 80, reason: 'Stock count' })

    expect(db._tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          movementType: 'ADJUSTMENT',
          quantity: -20  // 80 - 100 = -20 difference
        })
      })
    )
  })

  it('recalculates weighted average cost when adjusting stock upward with a unit cost', async () => {
    // Current: 100 qty @ 50 = 5000 value; adjusting up to 120 (+20 @ 60) = 1200; new avg = 6200/120 ≈ 51.67
    const db = makeDb()
    db._tx.inventory.findUnique = vi.fn().mockResolvedValue(makeInventoryRecord({ quantity: 100, averageCost: 50 }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await inventoryService.adjustStock({ productId: 'prod-1', quantity: 120, unitCost: 60, reason: 'Opening stock count' })

    expect(db._tx.inventory.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ quantity: 120, averageCost: expect.closeTo(51.67, 1) })
      })
    )
  })

  it('does not change average cost when adjusting stock downward', async () => {
    const db = makeDb()
    db._tx.inventory.findUnique = vi.fn().mockResolvedValue(makeInventoryRecord({ quantity: 100, averageCost: 50 }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await inventoryService.adjustStock({ productId: 'prod-1', quantity: 80, unitCost: 999, reason: 'Stock count' })

    expect(db._tx.inventory.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ quantity: 80, averageCost: 50 }) })
    )
  })

  it('rejects with INV-006 and writes no movement when the quantity is unchanged', async () => {
    const db = makeDb()
    db._tx.inventory.findUnique = vi.fn().mockResolvedValue(makeInventoryRecord({ quantity: 100 }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await inventoryService.adjustStock({ productId: 'prod-1', quantity: 100, reason: 'No actual change' })

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('INV-006')
    expect(db._tx.inventoryMovement.create).not.toHaveBeenCalled()
    expect(db._tx.inventory.update).not.toHaveBeenCalled()
  })

  it('records a DAMAGE movement when reasonCategory is DAMAGE and the adjustment is a decrease', async () => {
    const db = makeDb()
    db._tx.inventory.findUnique = vi.fn().mockResolvedValue(makeInventoryRecord({ quantity: 100 }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await inventoryService.adjustStock({ productId: 'prod-1', quantity: 90, reason: '10 units dropped and broke', reasonCategory: 'DAMAGE' })

    expect(db._tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ movementType: 'DAMAGE', quantity: -10 }) })
    )
  })

  it('never records DAMAGE for an increase, even if reasonCategory is DAMAGE — you cannot damage stock into existence', async () => {
    const db = makeDb()
    db._tx.inventory.findUnique = vi.fn().mockResolvedValue(makeInventoryRecord({ quantity: 100 }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await inventoryService.adjustStock({ productId: 'prod-1', quantity: 110, reason: 'Miscategorized', reasonCategory: 'DAMAGE' })

    expect(db._tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ movementType: 'ADJUSTMENT', quantity: 10 }) })
    )
  })

  it('defaults to the plain ADJUSTMENT movement when reasonCategory is omitted, unchanged from every pre-existing caller', async () => {
    const db = makeDb()
    db._tx.inventory.findUnique = vi.fn().mockResolvedValue(makeInventoryRecord({ quantity: 100 }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await inventoryService.adjustStock({ productId: 'prod-1', quantity: 90, reason: 'Recount' })

    expect(db._tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ movementType: 'ADJUSTMENT' }) })
    )
  })

  it('records the plain ADJUSTMENT movement for a non-DAMAGE reasonCategory like RECOUNT', async () => {
    const db = makeDb()
    db._tx.inventory.findUnique = vi.fn().mockResolvedValue(makeInventoryRecord({ quantity: 100 }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await inventoryService.adjustStock({ productId: 'prod-1', quantity: 90, reason: 'Physical count', reasonCategory: 'RECOUNT' })

    expect(db._tx.inventoryMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ movementType: 'ADJUSTMENT' }) })
    )
  })
})

describe('inventoryService.getInventoryValue', () => {
  it('returns total stock value aggregated', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)

    const result = await inventoryService.getInventoryValue()

    expect(result.success).toBe(true)
  })
})
