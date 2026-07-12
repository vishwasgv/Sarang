import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../inventory.service', () => ({
  inventoryService: { reduceStockTx: vi.fn().mockResolvedValue(undefined), addStockTx: vi.fn().mockResolvedValue(undefined) }
}))

import { getPrisma } from '../../database/db'
import { createChallan, updateChallan, updateChallanStatus, recordChallanReturn } from '../logistics-challan.service'
import { inventoryService } from '../inventory.service'

function makeChallan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'dc-1', challanNumber: 'DC-202601-0001', challanType: 'DELIVERY', status: 'DRAFT',
    customerId: null, customerName: 'Acme Co', customerAddress: null,
    shipmentId: null, invoiceId: null, vehicleId: null, vehicleNumber: null,
    driverName: null, driverPhone: null, dispatchDate: null, expectedReturn: null, returnedAt: null,
    totalValue: 500, notes: null, createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
    items: [{ id: 'ci-1', productId: null, productName: 'Widget', quantity: 10, returnedQty: 0, unit: 'PCS', unitValue: 50, totalValue: 500, notes: null }],
    ...overrides,
  }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  const db: Record<string, any> = {
    deliveryChallan: {
      findUnique: vi.fn().mockResolvedValue(makeChallan()),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...makeChallan(), ...data })),
      create: vi.fn(),
    },
    challanItem: { deleteMany: vi.fn(), update: vi.fn() },
    inventory: { findUnique: vi.fn().mockResolvedValue({ productId: 'prod-1', averageCost: 75 }) },
    ...overrides,
  }
  db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('createChallan — validation', () => {
  it('rejects a zero-quantity item', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const result = await createChallan({ customerName: 'Acme', items: [{ productName: 'Widget', quantity: 0 }] })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-005')
  })

  it('rejects a negative unit value', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const result = await createChallan({ customerName: 'Acme', items: [{ productName: 'Widget', quantity: 1, unitValue: -5 }] })
    expect(result.success).toBe(false)
  })
})

describe('updateChallan — items wipe guard', () => {
  it('rejects an explicit empty items array instead of silently clearing the challan', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const result = await updateChallan({ id: 'dc-1', items: [] })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-004')
    expect(db.challanItem.deleteMany).not.toHaveBeenCalled()
  })

  it('rejects editing a non-DRAFT challan', async () => {
    const db = makeDb({ deliveryChallan: { findUnique: vi.fn().mockResolvedValue(makeChallan({ status: 'ISSUED' })), update: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const result = await updateChallan({ id: 'dc-1', notes: 'x' })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-002')
  })
})

describe('updateChallanStatus — transitions', () => {
  it('allows cancelling a DRAFT challan', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const result = await updateChallanStatus({ id: 'dc-1', status: 'CANCELLED' })
    expect(result.success).toBe(true)
  })

  it('allows cancelling an ISSUED challan', async () => {
    const db = makeDb({ deliveryChallan: { findUnique: vi.fn().mockResolvedValue(makeChallan({ status: 'ISSUED' })), update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...makeChallan({ status: 'ISSUED' }), ...data })) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const result = await updateChallanStatus({ id: 'dc-1', status: 'CANCELLED' })
    expect(result.success).toBe(true)
  })

  it('rejects transitioning a terminal RETURNED challan', async () => {
    const db = makeDb({ deliveryChallan: { findUnique: vi.fn().mockResolvedValue(makeChallan({ status: 'RETURNED' })), update: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const result = await updateChallanStatus({ id: 'dc-1', status: 'ISSUED' })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-003')
  })
})

describe('recordChallanReturn — quantity guards', () => {
  it('rejects a negative returnedQty', async () => {
    const db = makeDb({
      deliveryChallan: { findUnique: vi.fn().mockResolvedValue(makeChallan({ status: 'ISSUED', challanType: 'RETURNABLE' })), update: vi.fn() },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const result = await recordChallanReturn({ id: 'dc-1', items: [{ itemId: 'ci-1', returnedQty: -2 }] })
    expect(result.success).toBe(false)
  })

  it('rejects returnedQty exceeding the dispatched quantity', async () => {
    const db = makeDb({
      deliveryChallan: { findUnique: vi.fn().mockResolvedValue(makeChallan({ status: 'ISSUED', challanType: 'RETURNABLE' })), update: vi.fn() },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const result = await recordChallanReturn({ id: 'dc-1', items: [{ itemId: 'ci-1', returnedQty: 999 }] })
    expect(result.success).toBe(false)
  })

  it('rejects recording a return on a non-RETURNABLE challan', async () => {
    const db = makeDb({
      deliveryChallan: { findUnique: vi.fn().mockResolvedValue(makeChallan({ status: 'ISSUED', challanType: 'DELIVERY' })), update: vi.fn() },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const result = await recordChallanReturn({ id: 'dc-1', items: [{ itemId: 'ci-1', returnedQty: 5 }] })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-002')
  })

  it('accepts a valid partial return', async () => {
    const db = makeDb({
      deliveryChallan: {
        findUnique: vi.fn().mockResolvedValue(makeChallan({ status: 'ISSUED', challanType: 'RETURNABLE' })),
        update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...makeChallan({ status: 'ISSUED', challanType: 'RETURNABLE' }), ...data })),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const result = await recordChallanReturn({ id: 'dc-1', items: [{ itemId: 'ci-1', returnedQty: 5 }] })
    expect(result.success).toBe(true)
    expect(db.challanItem.update).toHaveBeenCalledWith({ where: { id: 'ci-1' }, data: { returnedQty: 5 } })
  })
})

describe('updateChallanStatus — inventory movement on dispatch', () => {
  it('reduces stock on ISSUE for a catalog item with no linked invoice', async () => {
    const db = makeDb({
      deliveryChallan: {
        findUnique: vi.fn().mockResolvedValue(makeChallan({ items: [{ id: 'ci-1', productId: 'prod-1', productName: 'Widget', quantity: 10, returnedQty: 0, unit: 'PCS', unitValue: 50, totalValue: 500, notes: null }] })),
        update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...makeChallan(), ...data })),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await updateChallanStatus({ id: 'dc-1', status: 'ISSUED' }, 'user-1')

    expect(result.success).toBe(true)
    expect(inventoryService.reduceStockTx).toHaveBeenCalledWith(
      db, 'prod-1', 10, expect.stringContaining('DC-202601-0001'), 'DELIVERY_CHALLAN', 'dc-1', 'user-1'
    )
  })

  it('does not touch inventory when the challan is already linked to an invoice', async () => {
    const db = makeDb({
      deliveryChallan: {
        findUnique: vi.fn().mockResolvedValue(makeChallan({
          invoiceId: 'inv-1',
          items: [{ id: 'ci-1', productId: 'prod-1', productName: 'Widget', quantity: 10, returnedQty: 0, unit: 'PCS', unitValue: 50, totalValue: 500, notes: null }],
        })),
        update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...makeChallan(), ...data })),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await updateChallanStatus({ id: 'dc-1', status: 'ISSUED' })

    expect(result.success).toBe(true)
    expect(inventoryService.reduceStockTx).not.toHaveBeenCalled()
  })

  it('does not touch inventory for a BRANCH_TRANSFER challan', async () => {
    const db = makeDb({
      deliveryChallan: {
        findUnique: vi.fn().mockResolvedValue(makeChallan({
          challanType: 'BRANCH_TRANSFER',
          items: [{ id: 'ci-1', productId: 'prod-1', productName: 'Widget', quantity: 10, returnedQty: 0, unit: 'PCS', unitValue: 50, totalValue: 500, notes: null }],
        })),
        update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...makeChallan(), ...data })),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await updateChallanStatus({ id: 'dc-1', status: 'ISSUED' })

    expect(result.success).toBe(true)
    expect(inventoryService.reduceStockTx).not.toHaveBeenCalled()
  })
})

describe('recordChallanReturn — inventory restoration', () => {
  it('restores stock at the product current average cost when a RETURNABLE item comes back', async () => {
    const db = makeDb({
      deliveryChallan: {
        findUnique: vi.fn().mockResolvedValue(makeChallan({
          status: 'ISSUED', challanType: 'RETURNABLE',
          items: [{ id: 'ci-1', productId: 'prod-1', productName: 'Widget', quantity: 10, returnedQty: 0, unit: 'PCS', unitValue: 50, totalValue: 500, notes: null }],
        })),
        update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...makeChallan({ status: 'ISSUED', challanType: 'RETURNABLE' }), ...data })),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await recordChallanReturn({ id: 'dc-1', items: [{ itemId: 'ci-1', returnedQty: 4 }] }, 'user-1')

    expect(result.success).toBe(true)
    expect(inventoryService.addStockTx).toHaveBeenCalledWith(
      db, 'prod-1', 4, 75, expect.stringContaining('DC-202601-0001'), 'DELIVERY_CHALLAN_RETURN', 'dc-1', 'user-1'
    )
  })

  it('does not restore stock when returnedQty is 0', async () => {
    const db = makeDb({
      deliveryChallan: {
        findUnique: vi.fn().mockResolvedValue(makeChallan({
          status: 'ISSUED', challanType: 'RETURNABLE',
          items: [{ id: 'ci-1', productId: 'prod-1', productName: 'Widget', quantity: 10, returnedQty: 0, unit: 'PCS', unitValue: 50, totalValue: 500, notes: null }],
        })),
        update: vi.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...makeChallan({ status: 'ISSUED', challanType: 'RETURNABLE' }), ...data })),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await recordChallanReturn({ id: 'dc-1', items: [{ itemId: 'ci-1', returnedQty: 0 }] })

    expect(result.success).toBe(true)
    expect(inventoryService.addStockTx).not.toHaveBeenCalled()
  })
})
