import { describe, it, expect, vi } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { allocateLandedCostAcrossLines, getLandedCostPerUnitForPO, landedCostService } from '../landed-cost.service'

describe('allocateLandedCostAcrossLines', () => {
  it('splits BY_VALUE proportional to each line\'s own value share', () => {
    // Line A: 10*100=1000, Line B: 1*500=500. Total value 1500. Freight 300.
    // A gets 1000/1500*300=200, B gets 500/1500*300=100.
    const shares = allocateLandedCostAcrossLines(300, 'BY_VALUE', [{ value: 1000, quantity: 10 }, { value: 500, quantity: 1 }])
    expect(shares).toEqual([200, 100])
  })

  it('splits BY_QUANTITY proportional to each line\'s own quantity share', () => {
    // Line A: qty 30, Line B: qty 10. Total qty 40. Freight 400.
    // A gets 30/40*400=300, B gets 10/40*400=100.
    const shares = allocateLandedCostAcrossLines(400, 'BY_QUANTITY', [{ value: 1000, quantity: 30 }, { value: 5000, quantity: 10 }])
    expect(shares).toEqual([300, 100])
  })

  it('returns all zeros for a zero or negative total landed cost', () => {
    expect(allocateLandedCostAcrossLines(0, 'BY_VALUE', [{ value: 100, quantity: 1 }])).toEqual([0])
    expect(allocateLandedCostAcrossLines(-50, 'BY_VALUE', [{ value: 100, quantity: 1 }])).toEqual([0])
  })

  it('returns an empty array for zero lines', () => {
    expect(allocateLandedCostAcrossLines(300, 'BY_VALUE', [])).toEqual([])
  })

  it('splits evenly instead of dividing by zero when every line has zero value/quantity basis', () => {
    const shares = allocateLandedCostAcrossLines(300, 'BY_VALUE', [{ value: 0, quantity: 5 }, { value: 0, quantity: 5 }])
    expect(shares).toEqual([150, 150])
  })
})

describe('getLandedCostPerUnitForPO', () => {
  function makeTx(allocations: Array<{ amount: number; allocationMethod: string }>) {
    return { landedCostAllocation: { findMany: vi.fn().mockResolvedValue(allocations) } } as any
  }

  it('returns an empty map when the PO has no landed cost allocations', async () => {
    const tx = makeTx([])
    const result = await getLandedCostPerUnitForPO(tx, 'po-1', [{ productId: 'p1', quantity: 10, unitCost: 100 }])
    expect(result.size).toBe(0)
  })

  it('converts the per-line total share into a real per-unit addition', async () => {
    // Single product line: qty 10 @ unitCost 100 (value 1000). One freight allocation of 200, BY_VALUE.
    // Since it's the only line, it gets the full 200 share -> 200/10 = 20 per unit.
    const tx = makeTx([{ amount: 200, allocationMethod: 'BY_VALUE' }])
    const result = await getLandedCostPerUnitForPO(tx, 'po-1', [{ productId: 'p1', quantity: 10, unitCost: 100 }])
    expect(result.get('p1')).toBe(20)
  })

  it('pools multiple allocations (freight + duty) onto the same lines, each using its own method', async () => {
    // Line A: qty 10 val 1000, Line B: qty 5 val 2500. Freight 300 BY_VALUE (A:200,B:100... wait recompute)
    // Total value 3500: A share 1000/3500*300=85.71, B share 2500/3500*300=214.29
    // Duty 150 BY_QUANTITY, total qty 15: A share 10/15*150=100, B share 5/15*150=50
    const tx = makeTx([
      { amount: 300, allocationMethod: 'BY_VALUE' },
      { amount: 150, allocationMethod: 'BY_QUANTITY' }
    ])
    const result = await getLandedCostPerUnitForPO(tx, 'po-1', [
      { productId: 'A', quantity: 10, unitCost: 100 },
      { productId: 'B', quantity: 5, unitCost: 500 }
    ])
    // A total = 85.714... + 100 = 185.714..., per unit = /10 = 18.5714...
    expect(result.get('A')).toBeCloseTo((1000 / 3500 * 300 + 100) / 10, 5)
    // B total = 214.28... + 50 = 264.28..., per unit = /5 = 52.857...
    expect(result.get('B')).toBeCloseTo((2500 / 3500 * 300 + 50) / 5, 5)
  })
})

function makeServiceDb(overrides: Record<string, unknown> = {}) {
  const db = {
    purchaseOrder: { findUnique: vi.fn().mockResolvedValue({ id: 'po-1', status: 'APPROVED' }) },
    landedCostAllocation: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'lc-1', purchaseOrderId: 'po-1', costType: 'FREIGHT', amount: 500, allocationMethod: 'BY_VALUE' }),
      findUnique: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue({})
    },
    ...overrides
  } as Record<string, any>
  vi.mocked(getPrisma).mockReturnValue(db as never)
  return db
}

describe('landedCostService.addAllocation', () => {
  it('creates a real allocation row for a PO not yet received', async () => {
    const db = makeServiceDb()
    const result = await landedCostService.addAllocation({ purchaseOrderId: 'po-1', costType: 'FREIGHT', amount: 500 })
    expect(result.success).toBe(true)
    expect(db.landedCostAllocation.create).toHaveBeenCalledWith({
      data: { purchaseOrderId: 'po-1', costType: 'FREIGHT', amount: 500, allocationMethod: 'BY_VALUE' }
    })
  })

  it('rejects a zero or negative amount', async () => {
    makeServiceDb()
    const result = await landedCostService.addAllocation({ purchaseOrderId: 'po-1', costType: 'FREIGHT', amount: 0 })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('LC-001')
  })

  it('rejects adding a landed cost once the PO has started receiving (RECEIVED)', async () => {
    makeServiceDb({ purchaseOrder: { findUnique: vi.fn().mockResolvedValue({ id: 'po-1', status: 'RECEIVED' }) } })
    const result = await landedCostService.addAllocation({ purchaseOrderId: 'po-1', costType: 'FREIGHT', amount: 500 })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('LC-002')
  })

  it('rejects adding a landed cost once the PO is PARTIAL_RECEIVED', async () => {
    makeServiceDb({ purchaseOrder: { findUnique: vi.fn().mockResolvedValue({ id: 'po-1', status: 'PARTIAL_RECEIVED' }) } })
    const result = await landedCostService.addAllocation({ purchaseOrderId: 'po-1', costType: 'FREIGHT', amount: 500 })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('LC-002')
  })

  it('returns a not-found error for an unknown PO', async () => {
    makeServiceDb({ purchaseOrder: { findUnique: vi.fn().mockResolvedValue(null) } })
    const result = await landedCostService.addAllocation({ purchaseOrderId: 'missing', costType: 'FREIGHT', amount: 500 })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('PO-001')
  })
})

describe('landedCostService.removeAllocation', () => {
  it('removes an allocation from a PO not yet received', async () => {
    const db = makeServiceDb({
      landedCostAllocation: {
        findUnique: vi.fn().mockResolvedValue({ id: 'lc-1', purchaseOrderId: 'po-1', billId: null, purchaseOrder: { status: 'APPROVED' } }),
        delete: vi.fn().mockResolvedValue({})
      }
    })
    const result = await landedCostService.removeAllocation('lc-1')
    expect(result.success).toBe(true)
    expect(db.landedCostAllocation.delete).toHaveBeenCalledWith({ where: { id: 'lc-1' } })
  })

  it('rejects removing an allocation once receiving has started', async () => {
    makeServiceDb({
      landedCostAllocation: {
        findUnique: vi.fn().mockResolvedValue({ id: 'lc-1', purchaseOrderId: 'po-1', billId: null, purchaseOrder: { status: 'RECEIVED' } }),
        delete: vi.fn()
      }
    })
    const result = await landedCostService.removeAllocation('lc-1')
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('LC-002')
  })
})
