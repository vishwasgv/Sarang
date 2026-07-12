import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../inventory.service', () => ({ inventoryService: { adjustStock: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { inventoryService } from '../inventory.service'
import { updateKOTStatus } from '../restaurant.service'

function makeKot(status: string) {
  return {
    id: 'kot-1', status, tableId: null,
    invoice: { items: [{ productId: 'prod-1', quantity: 2, product: {} }] }
  }
}

function makeMockDb(kotStatus: string) {
  const db: Record<string, any> = {
    kOT: {
      findUnique: vi.fn().mockResolvedValue(makeKot(kotStatus)),
      count: vi.fn().mockResolvedValue(0),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'kot-1', ...data })
      ),
    },
    restaurantTable: { update: vi.fn() },
    recipe: { findUnique: vi.fn().mockResolvedValue(null) },
  }
  return db
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('restaurant.service.updateKOTStatus', () => {
  it('allows the normal forward transition PENDING -> IN_PROGRESS', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb('PENDING') as never)
    const res = await updateKOTStatus('kot-1', 'IN_PROGRESS')
    expect(res.success).toBe(true)
  })

  it('rejects changing status of an already-DONE KOT — prevents double ingredient deduction', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb('DONE') as never)
    const res = await updateKOTStatus('kot-1', 'CANCELLED')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RST-017')
    // Ingredient deduction must never even be attempted for a rejected transition
    expect(inventoryService.adjustStock).not.toHaveBeenCalled()
  })

  it('rejects re-marking a CANCELLED KOT as DONE — the DONE -> CANCELLED -> DONE double-deduction path', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb('CANCELLED') as never)
    const res = await updateKOTStatus('kot-1', 'DONE')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('RST-017')
    expect(inventoryService.adjustStock).not.toHaveBeenCalled()
  })

  it('is a no-op-safe idempotent call when re-setting the same terminal status', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeMockDb('DONE') as never)
    const res = await updateKOTStatus('kot-1', 'DONE')
    // Same status -> same status is allowed through (status !== kot.status is false),
    // but must not re-deduct ingredients since kot.status === 'DONE' already.
    expect(res.success).toBe(true)
    expect(inventoryService.adjustStock).not.toHaveBeenCalled()
  })
})
