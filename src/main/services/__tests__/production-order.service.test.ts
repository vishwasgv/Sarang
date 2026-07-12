import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { completeProductionOrder } from '../production-order.service'

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
    { id: 'mu-1', rawMaterialId: 'rm-1', quantityPlanned: 20, quantityActual: 20, rawMaterial: { unitCost: 5 } }, // 100
    { id: 'mu-2', rawMaterialId: 'rm-2', quantityPlanned: 5, quantityActual: 5, rawMaterial: { unitCost: 10 } }   // 50
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
