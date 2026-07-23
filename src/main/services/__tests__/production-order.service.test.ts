import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { completeProductionOrder, startProductionOrder, cancelProductionOrder } from '../production-order.service'

const IN_PROGRESS_ORDER = {
  id: 'po-1',
  orderNumber: 'PROD-00001',
  productId: 'prod-finished-1',
  bomId: 'bom-1',
  plannedQty: 10,
  producedQty: 0,
  status: 'IN_PROGRESS',
  product: { productName: 'Finished Widget' },
  materialUsage: [
    { id: 'mu-1', rawMaterialId: 'rm-1', componentProductId: null, quantityPlanned: 20, quantityActual: 20, rawMaterial: { unitCost: 5 }, componentProduct: null, batchConsumption: [] }, // 100
    { id: 'mu-2', rawMaterialId: 'rm-2', componentProductId: null, quantityPlanned: 5, quantityActual: 5, rawMaterial: { unitCost: 10 }, componentProduct: null, batchConsumption: [] }   // 50
  ]
  // total material cost = 150
}

function makeDb(existingInventory: { quantity: number; averageCost: number } | null) {
  const inventoryState = existingInventory ? { ...existingInventory } : null
  const txClient = {
    inventory: {
      findUnique: vi.fn(async () => inventoryState),
      update: vi.fn(async ({ data }: { data: { quantity: { increment: number }; averageCost: number } }) => {
        if (inventoryState) {
          inventoryState.quantity += data.quantity.increment
          inventoryState.averageCost = data.averageCost
        }
        return inventoryState
      }),
      create: vi.fn(async ({ data }: { data: { quantity: number; averageCost: number } }) => data)
    },
    inventoryMovement: { create: vi.fn().mockResolvedValue({}) },
    productionOrder: {
      update: vi.fn().mockResolvedValue({
        ...IN_PROGRESS_ORDER,
        status: 'COMPLETED',
        producedQty: 10,
        startDate: new Date(),
        completedDate: new Date(),
        notes: null,
        createdAt: new Date(),
        materialUsage: IN_PROGRESS_ORDER.materialUsage.map(u => ({ ...u, rawMaterial: { name: 'x', unit: 'kg', unitCost: u.rawMaterial.unitCost } }))
      })
    }
  }
  return {
    productionOrder: { findUnique: vi.fn().mockResolvedValue(IN_PROGRESS_ORDER) },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(txClient)),
    __txClient: txClient,
    __inventoryState: () => inventoryState
  }
}

beforeEach(() => vi.clearAllMocks())

describe('completeProductionOrder — finished-goods cost basis', () => {
  it('sets averageCost from consumed raw-material cost when the product has no prior inventory', async () => {
    const db = makeDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await completeProductionOrder({ id: 'po-1', producedQty: 10 }, 'user-1')

    expect(res.success).toBe(true)
    // total material cost 150 / producedQty 10 = 15 per unit
    expect(db.__txClient.inventory.create).toHaveBeenCalledWith({
      data: { productId: 'prod-finished-1', quantity: 10, averageCost: 15 }
    })
    expect(db.__txClient.inventory.update).not.toHaveBeenCalled()
  })

  it('blends into existing averageCost via the same weighted-average formula as every other stock-in path', async () => {
    // Existing: 10 units @ cost 20 (value 200). Adding 10 units @ cost 15 (value 150).
    // New weighted average = (200 + 150) / 20 = 17.5
    const db = makeDb({ quantity: 10, averageCost: 20 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await completeProductionOrder({ id: 'po-1', producedQty: 10 }, 'user-1')

    expect(res.success).toBe(true)
    expect(db.__txClient.inventory.update).toHaveBeenCalledWith({
      where: { productId: 'prod-finished-1' },
      data: { quantity: { increment: 10 }, averageCost: 17.5 }
    })
    expect(db.__txClient.inventory.create).not.toHaveBeenCalled()
  })
})

describe('completeProductionOrder — Phase 58 §2 scrap qty + labor costing', () => {
  it('folds laborCost into the produced unit cost basis', async () => {
    const db = makeDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // material 150 + labor 50 = 200, / producedQty 10 = 20 per unit
    const res = await completeProductionOrder({ id: 'po-1', producedQty: 10, laborCost: 50 }, 'user-1')

    expect(res.success).toBe(true)
    expect(db.__txClient.inventory.create).toHaveBeenCalledWith({
      data: { productId: 'prod-finished-1', quantity: 10, averageCost: 20 }
    })
  })

  it('spreads total cost over producedQty only, not producedQty+scrapQty (scrap cost is absorbed by the good units)', async () => {
    const db = makeDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // material 150, scrapQty 5 units failed QC — still 150 / producedQty 10 = 15/unit,
    // NOT 150 / (10+5) — the scrapped units contributed zero inventory value.
    const res = await completeProductionOrder({ id: 'po-1', producedQty: 10, scrapQty: 5 }, 'user-1')

    expect(res.success).toBe(true)
    expect(db.__txClient.inventory.create).toHaveBeenCalledWith({
      data: { productId: 'prod-finished-1', quantity: 10, averageCost: 15 }
    })
    expect(db.__txClient.productionOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ scrapQty: 5 })
    }))
  })

  it('persists laborCost and scrapQty (default 0) on the order record', async () => {
    const db = makeDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await completeProductionOrder({ id: 'po-1', producedQty: 10 }, 'user-1')

    expect(db.__txClient.productionOrder.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ scrapQty: 0, laborCost: 0 })
    }))
  })
})

describe('startProductionOrder — Phase 58 §2 multi-level BOM component consumption', () => {
  function makeStartDb(opts: {
    rawUsage?: { currentStock: number; quantityPlanned: number }
    componentUsage?: { productId: string; availableQty: number; quantityPlanned: number }
  }) {
    const materialUsage: any[] = []
    if (opts.rawUsage) {
      materialUsage.push({
        id: 'mu-1', rawMaterialId: 'rm-1', componentProductId: null,
        quantityPlanned: opts.rawUsage.quantityPlanned, quantityActual: 0,
        rawMaterial: { name: 'Steel', unit: 'kg', unitCost: 5, currentStock: opts.rawUsage.currentStock },
        componentProduct: null
      })
    }
    if (opts.componentUsage) {
      materialUsage.push({
        id: 'mu-2', rawMaterialId: null, componentProductId: opts.componentUsage.productId,
        quantityPlanned: opts.componentUsage.quantityPlanned, quantityActual: 0,
        rawMaterial: null,
        componentProduct: { productName: 'Sub-assembly', costPrice: 40, inventory: { quantity: opts.componentUsage.availableQty, averageCost: 40 } }
      })
    }
    const order = {
      id: 'po-2', orderNumber: 'PROD-00002', productId: 'prod-finished', bomId: 'bom-1',
      plannedQty: 10, producedQty: 0, scrapQty: 0, laborCost: 0, status: 'DRAFT',
      startDate: null, completedDate: null, notes: null, createdAt: new Date(), materialUsage
    }
    const txClient: Record<string, any> = {
      // Regression for a real TOCTOU stock race found 2026-07-22:
      // startProductionOrder now re-reads currentStock/inventory.quantity
      // fresh INSIDE the transaction (findUniqueOrThrow/findUnique below)
      // immediately before each decrement, not just relying on the
      // pre-transaction snapshot already on materialUsage — mirror that
      // same fixture data here so these fresh reads see consistent values.
      rawMaterial: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(
          opts.rawUsage ? { currentStock: opts.rawUsage.currentStock, name: 'Steel', unit: 'kg' } : { currentStock: 0, name: 'Steel', unit: 'kg' }
        ),
        update: vi.fn().mockResolvedValue({ currentStock: 0 })
      },
      rawMaterialMovement: { create: vi.fn().mockResolvedValue({}) },
      rawMaterialBatch: { findMany: vi.fn().mockResolvedValue([]), update: vi.fn() },
      productionMaterialBatchConsumption: { create: vi.fn().mockResolvedValue({}) },
      inventory: {
        findUnique: vi.fn().mockResolvedValue(
          opts.componentUsage ? { quantity: opts.componentUsage.availableQty } : { quantity: 0 }
        ),
        update: vi.fn().mockResolvedValue({})
      },
      inventoryMovement: { create: vi.fn().mockResolvedValue({}) },
      productionMaterialUsage: { update: vi.fn().mockResolvedValue({}) },
      productionOrder: {
        update: vi.fn().mockResolvedValue({ ...order, status: 'IN_PROGRESS', startDate: new Date(), product: { productName: 'Finished' }, materialUsage: materialUsage.map(u => ({ ...u, batchConsumption: [] })) })
      }
    }
    return {
      productionOrder: { findUnique: vi.fn().mockResolvedValue(order) },
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(txClient)),
      __txClient: txClient
    }
  }

  // Regression for a real TOCTOU stock race found 2026-07-22: the
  // pre-transaction shortfall check used to be the ONLY check — a
  // concurrent decrement between that check and the actual mutation could
  // drive stock negative with no error. Simulates exactly that: the
  // pre-check snapshot shows enough stock, but a fresh in-transaction read
  // (as if another concurrent order had just consumed it) shows there isn't.
  it('re-checks stock fresh INSIDE the transaction and rejects if a concurrent consumer already used it up, even though the pre-check passed', async () => {
    const db = makeStartDb({ rawUsage: { currentStock: 20, quantityPlanned: 20 } })
    // Pre-check (outside tx) sees 20 available — passes. Fresh in-tx read
    // sees only 5 left, as if a concurrent order consumed 15 in between.
    db.__txClient.rawMaterial.findUniqueOrThrow.mockResolvedValue({ currentStock: 5, name: 'Steel', unit: 'kg' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await startProductionOrder('po-2', 'user-1')

    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('PO-008')
    expect(db.__txClient.rawMaterial.update).not.toHaveBeenCalled()
  })

  it('deducts the component product\'s OWN inventory (not RawMaterial) for a sub-assembly usage row', async () => {
    const db = makeStartDb({ componentUsage: { productId: 'prod-sub', availableQty: 10, quantityPlanned: 3 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await startProductionOrder('po-2', 'user-1')

    expect(res.success).toBe(true)
    expect(db.__txClient.inventory.update).toHaveBeenCalledWith({
      where: { productId: 'prod-sub' },
      data: { quantity: { decrement: 3 } }
    })
    expect(db.__txClient.inventoryMovement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ productId: 'prod-sub', movementType: 'PRODUCTION_OUT', quantity: -3 })
    }))
    expect(db.__txClient.rawMaterial.update).not.toHaveBeenCalled()
  })

  it('rejects starting when the component product does not have enough stock', async () => {
    const db = makeStartDb({ componentUsage: { productId: 'prod-sub', availableQty: 1, quantityPlanned: 3 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await startProductionOrder('po-2', 'user-1')
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('PO-008')
  })

  it('FIFO-consumes raw-material batches and records which lot(s) were drawn', async () => {
    const db = makeStartDb({ rawUsage: { currentStock: 100, quantityPlanned: 8 } })
    db.__txClient.rawMaterialBatch.findMany.mockResolvedValue([
      { id: 'batch-old', quantityRemaining: 5, receivedDate: new Date('2026-01-01') },
      { id: 'batch-new', quantityRemaining: 20, receivedDate: new Date('2026-02-01') }
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await startProductionOrder('po-2', 'user-1')

    expect(res.success).toBe(true)
    // 8 needed: 5 from the older batch first, remaining 3 from the newer one
    expect(db.__txClient.rawMaterialBatch.update).toHaveBeenCalledWith({ where: { id: 'batch-old' }, data: { quantityRemaining: { decrement: 5 } } })
    expect(db.__txClient.rawMaterialBatch.update).toHaveBeenCalledWith({ where: { id: 'batch-new' }, data: { quantityRemaining: { decrement: 3 } } })
    expect(db.__txClient.productionMaterialBatchConsumption.create).toHaveBeenCalledTimes(2)
  })

  it('is a no-op on batches for a raw material with no batch records at all (untracked stock)', async () => {
    const db = makeStartDb({ rawUsage: { currentStock: 100, quantityPlanned: 8 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await startProductionOrder('po-2', 'user-1')
    expect(res.success).toBe(true)
    expect(db.__txClient.productionMaterialBatchConsumption.create).not.toHaveBeenCalled()
  })
})

describe('cancelProductionOrder — Phase 58 §2 restores component-product stock and raw-material batches', () => {
  it('restores a component product\'s inventory on cancel of an IN_PROGRESS order', async () => {
    const order = {
      id: 'po-3', orderNumber: 'PROD-00003', status: 'IN_PROGRESS',
      materialUsage: [
        { id: 'mu-2', rawMaterialId: null, componentProductId: 'prod-sub', quantityActual: 3, rawMaterial: null, componentProduct: { productName: 'Sub' } }
      ]
    }
    const txClient: Record<string, any> = {
      rawMaterial: { update: vi.fn() },
      rawMaterialMovement: { create: vi.fn() },
      rawMaterialBatch: { update: vi.fn() },
      productionMaterialBatchConsumption: { findMany: vi.fn().mockResolvedValue([]), deleteMany: vi.fn() },
      inventory: { update: vi.fn().mockResolvedValue({}) },
      inventoryMovement: { create: vi.fn().mockResolvedValue({}) },
      productionOrder: { update: vi.fn().mockResolvedValue({}) }
    }
    const db = {
      productionOrder: { findUnique: vi.fn().mockResolvedValue(order) },
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(txClient)),
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await cancelProductionOrder({ id: 'po-3' }, 'user-1')

    expect(res.success).toBe(true)
    expect(txClient.inventory.update).toHaveBeenCalledWith({ where: { productId: 'prod-sub' }, data: { quantity: { increment: 3 } } })
    expect(txClient.inventoryMovement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ productId: 'prod-sub', movementType: 'PRODUCTION_RETURN', quantity: 3 })
    }))
  })

  it('restores consumed raw-material batch quantities on cancel', async () => {
    const order = {
      id: 'po-4', orderNumber: 'PROD-00004', status: 'IN_PROGRESS',
      materialUsage: [
        { id: 'mu-1', rawMaterialId: 'rm-1', componentProductId: null, quantityActual: 8, rawMaterial: { name: 'Steel', unit: 'kg', unitCost: 5, currentStock: 0 }, componentProduct: null }
      ]
    }
    const txClient: Record<string, any> = {
      rawMaterial: { update: vi.fn().mockResolvedValue({ currentStock: 8 }) },
      rawMaterialMovement: { create: vi.fn().mockResolvedValue({}) },
      rawMaterialBatch: { update: vi.fn().mockResolvedValue({}) },
      productionMaterialBatchConsumption: {
        findMany: vi.fn().mockResolvedValue([
          { rawMaterialBatchId: 'batch-old', quantityConsumed: 5 },
          { rawMaterialBatchId: 'batch-new', quantityConsumed: 3 }
        ]),
        deleteMany: vi.fn().mockResolvedValue({})
      },
      inventory: { update: vi.fn() },
      inventoryMovement: { create: vi.fn() },
      productionOrder: { update: vi.fn().mockResolvedValue({}) }
    }
    const db = {
      productionOrder: { findUnique: vi.fn().mockResolvedValue(order) },
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(txClient)),
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await cancelProductionOrder({ id: 'po-4' }, 'user-1')

    expect(res.success).toBe(true)
    expect(txClient.rawMaterialBatch.update).toHaveBeenCalledWith({ where: { id: 'batch-old' }, data: { quantityRemaining: { increment: 5 } } })
    expect(txClient.rawMaterialBatch.update).toHaveBeenCalledWith({ where: { id: 'batch-new' }, data: { quantityRemaining: { increment: 3 } } })
    expect(txClient.productionMaterialBatchConsumption.deleteMany).toHaveBeenCalledWith({ where: { productionMaterialUsageId: 'mu-1' } })
  })
})
