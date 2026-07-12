import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))

import { getPrisma } from '../../database/db'
import { createVehicle, updateVehicle, updateVehicleStatus } from '../logistics-vehicle.service'

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    vehicle: {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'veh-1', createdAt: new Date(), updatedAt: new Date(), ...data })),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'veh-1', createdAt: new Date(), updatedAt: new Date(), ...data })),
    },
    ...overrides,
  } as never
}

beforeEach(() => vi.clearAllMocks())

describe('createVehicle', () => {
  it('rejects a negative capacity', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb())
    const result = await createVehicle({ vehicleNumber: 'MH12AB1234', vehicleType: 'VAN', capacity: -100 })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-002')
  })

  it('accepts a valid vehicle', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb())
    const result = await createVehicle({ vehicleNumber: 'MH12AB1234', vehicleType: 'VAN', capacity: 500 })
    expect(result.success).toBe(true)
  })
})

describe('updateVehicle', () => {
  it('rejects a negative capacity on update', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb())
    const result = await updateVehicle({ id: 'veh-1', capacity: -1 })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-002')
  })
})

describe('updateVehicleStatus', () => {
  it('rejects manually setting status to IN_TRANSIT — only shipment transitions may do that', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb())
    const result = await updateVehicleStatus('veh-1', 'IN_TRANSIT')
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-002')
  })

  it('allows setting status to MAINTENANCE', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb())
    const result = await updateVehicleStatus('veh-1', 'MAINTENANCE')
    expect(result.success).toBe(true)
  })
})
