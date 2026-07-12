import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { createCarrier, updateCarrier, deleteCarrier } from '../logistics-carrier.service'

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    carrier: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'car-1', createdAt: new Date(), updatedAt: new Date(), ...data })),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'car-1', createdAt: new Date(), updatedAt: new Date(), ...data })),
    },
    shipment: { count: vi.fn().mockResolvedValue(0) },
    freightLedger: { count: vi.fn().mockResolvedValue(0) },
    ...overrides,
  } as never
}

beforeEach(() => vi.clearAllMocks())

describe('createCarrier', () => {
  it('rejects a negative ratePerKg', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb())
    const result = await createCarrier({ name: 'FastTrans', ratePerKg: -5 })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-002')
  })

  it('rejects a negative ratePerKm', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb())
    const result = await createCarrier({ name: 'FastTrans', ratePerKm: -5 })
    expect(result.success).toBe(false)
  })

  it('accepts valid rates', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb())
    const result = await createCarrier({ name: 'FastTrans', ratePerKg: 10, ratePerKm: 5 })
    expect(result.success).toBe(true)
  })
})

describe('updateCarrier', () => {
  it('rejects a negative rate on update', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb())
    const result = await updateCarrier({ id: 'car-1', ratePerKg: -1 })
    expect(result.success).toBe(false)
  })
})

describe('deleteCarrier', () => {
  it('blocks deletion when the carrier has shipment references', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb({ shipment: { count: vi.fn().mockResolvedValue(3) } }))
    const result = await deleteCarrier('car-1')
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('REF-001')
  })
})
