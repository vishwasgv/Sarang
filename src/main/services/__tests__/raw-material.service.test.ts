import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { receiveRawMaterialBatch, listRawMaterialBatches, adjustRawMaterialStock } from '../raw-material.service'

function makeMockDb(material: { id: string; unitCost: number } | null = { id: 'rm-1', unitCost: 5 }) {
  const db: Record<string, any> = {
    rawMaterial: {
      findUnique: vi.fn().mockResolvedValue(material),
      update: vi.fn().mockResolvedValue({ currentStock: 100 }),
    },
    rawMaterialBatch: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({
        id: 'batch-1', receivedDate: new Date(), quantityRemaining: data.quantityReceived, isActive: true, createdAt: new Date(), ...data,
        rawMaterial: { name: 'Steel' }, supplier: null
      })),
      findMany: vi.fn().mockResolvedValue([]),
    },
    rawMaterialMovement: { create: vi.fn().mockResolvedValue({}) },
  }
  db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return db
}

describe('raw-material.service.receiveRawMaterialBatch — Phase 58 §2 lot/batch traceability', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing raw material', async () => {
    const db = makeMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await receiveRawMaterialBatch({ rawMaterialId: 'rm-missing', batchNumber: 'L1', quantity: 10 })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RM-003')
  })

  it('rejects a non-positive quantity', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await receiveRawMaterialBatch({ rawMaterialId: 'rm-1', batchNumber: 'L1', quantity: 0 })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RM-009')
  })

  it('creates the batch, increments currentStock, and records a PURCHASE movement in one call', async () => {
    const db = makeMockDb({ id: 'rm-1', unitCost: 5 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await receiveRawMaterialBatch({ rawMaterialId: 'rm-1', batchNumber: ' lot-2026-01 ', quantity: 20, unitCost: 6 })

    expect(res.success).toBe(true)
    expect(db.rawMaterialBatch.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ rawMaterialId: 'rm-1', batchNumber: 'LOT-2026-01', quantityReceived: 20, quantityRemaining: 20, unitCost: 6 })
    }))
    expect(db.rawMaterial.update).toHaveBeenCalledWith({
      where: { id: 'rm-1' },
      data: { currentStock: { increment: 20 } },
      select: { currentStock: true }
    })
    expect(db.rawMaterialMovement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'PURCHASE', quantity: 20, reference: 'LOT-2026-01' })
    }))
  })

  it('defaults unitCost to the material\'s own unitCost when not provided', async () => {
    const db = makeMockDb({ id: 'rm-1', unitCost: 5 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await receiveRawMaterialBatch({ rawMaterialId: 'rm-1', batchNumber: 'L2', quantity: 10 })

    expect(db.rawMaterialBatch.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ unitCost: 5 })
    }))
  })
})

describe('raw-material.service.adjustRawMaterialStock', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeAdjustDb(currentStock = 50) {
    const db: Record<string, any> = {
      rawMaterial: {
        findUnique: vi.fn().mockResolvedValue({ id: 'rm-1', unitCost: 5, currentStock }),
        update: vi.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({ currentStock: typeof data.currentStock === 'object' ? currentStock + data.currentStock.increment : data.currentStock })
        ),
      },
      rawMaterialMovement: { create: vi.fn().mockResolvedValue({}) },
    }
    db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
    return db
  }

  // Regression for a real defect found 2026-07-22: PURCHASE and RETURN both
  // flowed into the same atomic increment on the documented-but-unenforced
  // assumption that "both are positive quantities" — a negative PURCHASE
  // quantity flowed straight through, silently decreasing stock while
  // recording a movement mislabeled as an increase.
  it('rejects a negative PURCHASE quantity', async () => {
    const db = makeAdjustDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await adjustRawMaterialStock({ id: 'rm-1', type: 'PURCHASE', quantity: -10 })

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RM-011')
    expect(db.rawMaterial.update).not.toHaveBeenCalled()
  })

  it('rejects a zero PURCHASE quantity', async () => {
    const db = makeAdjustDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await adjustRawMaterialStock({ id: 'rm-1', type: 'PURCHASE', quantity: 0 })

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RM-011')
  })

  it('rejects a negative RETURN quantity', async () => {
    const db = makeAdjustDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await adjustRawMaterialStock({ id: 'rm-1', type: 'RETURN', quantity: -5 })

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RM-011')
    expect(db.rawMaterial.update).not.toHaveBeenCalled()
  })

  it('allows a positive PURCHASE quantity and increments stock', async () => {
    const db = makeAdjustDb(50)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await adjustRawMaterialStock({ id: 'rm-1', type: 'PURCHASE', quantity: 20 })

    expect(res.success).toBe(true)
    expect(db.rawMaterial.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { currentStock: { increment: 20 } }
    }))
  })

  it('still allows a negative ADJUSTMENT-target that is actually a valid absolute value of zero or more (ADJUSTMENT is absolute, not incremental)', async () => {
    const db = makeAdjustDb(50)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await adjustRawMaterialStock({ id: 'rm-1', type: 'ADJUSTMENT', quantity: 30 })

    expect(res.success).toBe(true)
    expect(db.rawMaterial.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { currentStock: 30 }
    }))
  })
})

describe('raw-material.service.listRawMaterialBatches', () => {
  beforeEach(() => vi.clearAllMocks())

  it('scopes to a specific raw material when provided, and only active batches', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await listRawMaterialBatches({ rawMaterialId: 'rm-1' })

    expect(db.rawMaterialBatch.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isActive: true, rawMaterialId: 'rm-1' }
    }))
  })
})
