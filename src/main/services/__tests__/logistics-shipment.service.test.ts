import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../logistics-notification.service', () => ({
  scheduleShipmentDispatchNotification: vi.fn().mockResolvedValue(undefined),
  scheduleShipmentDelayedNotification: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { createShipment, updateShipment, updateShipmentStatus } from '../logistics-shipment.service'

function makeShipment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ship-1', shipmentNumber: 'SHP-202601-0001', status: 'READY',
    vehicleId: 'veh-1', carrierId: null,
    customerId: null, customerName: 'Acme Co', destinationAddress: 'Warehouse B',
    trackingNumber: null, expectedDelivery: null,
    scheduledDate: null, readyAt: null, inTransitAt: null, outForDeliveryAt: null, deliveredAt: null,
    challanNumber: null, ewayBillNumber: null, notes: null, weight: null, packages: 1, freightAmount: 0,
    supplierId: null, supplierName: null, carrier: null, items: [],
    createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01'),
    vehicle: { id: 'veh-1', status: 'AVAILABLE', vehicleNumber: 'MH12AB1234', vehicleType: 'VAN', driverName: null },
    ...overrides,
  }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  const db: Record<string, any> = {
    shipment: {
      findUnique: vi.fn().mockResolvedValue(makeShipment()),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...makeShipment(), ...data })),
      create: vi.fn(),
    },
    shipmentItem: { deleteMany: vi.fn() },
    vehicle: {
      findUnique: vi.fn().mockResolvedValue({ id: 'veh-2', status: 'AVAILABLE', vehicleNumber: 'MH12CD5678' }),
      update: vi.fn().mockResolvedValue({}),
    },
    customer: { findUnique: vi.fn().mockResolvedValue({ phone: null }) },
    freightLedger: { count: vi.fn().mockResolvedValue(0) },
    ...overrides,
  }
  db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('createShipment — numeric validation', () => {
  it('rejects negative freight amount', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const result = await createShipment({ destinationAddress: 'X', freightAmount: -10 })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-005')
  })

  it('rejects zero-quantity items', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const result = await createShipment({ destinationAddress: 'X', items: [{ productName: 'Widget', quantity: 0 }] })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-005')
  })

  it('rejects packages less than 1', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const result = await createShipment({ destinationAddress: 'X', packages: 0 })
    expect(result.success).toBe(false)
  })
})

describe('updateShipmentStatus — vehicle double-booking guard', () => {
  it('rejects transition to IN_TRANSIT when the assigned vehicle is not AVAILABLE', async () => {
    const db = makeDb({
      shipment: {
        findUnique: vi.fn().mockResolvedValue(makeShipment({ vehicle: { id: 'veh-1', status: 'IN_TRANSIT', vehicleNumber: 'MH12AB1234' } })),
        update: vi.fn(),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await updateShipmentStatus({ id: 'ship-1', status: 'IN_TRANSIT' })

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-004')
    expect(db.shipment.update).not.toHaveBeenCalled()
  })

  it('allows transition to IN_TRANSIT when the vehicle is AVAILABLE and marks the vehicle IN_TRANSIT', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await updateShipmentStatus({ id: 'ship-1', status: 'IN_TRANSIT' })

    expect(result.success).toBe(true)
    expect(db.vehicle.update).toHaveBeenCalledWith({ where: { id: 'veh-1' }, data: { status: 'IN_TRANSIT' } })
  })

  it('releases the vehicle back to AVAILABLE when the shipment is DELIVERED', async () => {
    const db = makeDb({
      shipment: {
        findUnique: vi.fn().mockResolvedValue(makeShipment({ status: 'IN_TRANSIT', vehicle: { id: 'veh-1', status: 'IN_TRANSIT', vehicleNumber: 'MH12AB1234' } })),
        update: vi.fn().mockResolvedValue(makeShipment({ status: 'DELIVERED' })),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await updateShipmentStatus({ id: 'ship-1', status: 'DELIVERED' })

    expect(result.success).toBe(true)
    expect(db.vehicle.update).toHaveBeenCalledWith({ where: { id: 'veh-1' }, data: { status: 'AVAILABLE' } })
  })

  it('rejects an invalid status transition', async () => {
    const db = makeDb({ shipment: { findUnique: vi.fn().mockResolvedValue(makeShipment({ status: 'PENDING' })), update: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await updateShipmentStatus({ id: 'ship-1', status: 'DELIVERED' })

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-003')
  })

  it('allows cancelling an IN_TRANSIT shipment', async () => {
    const db = makeDb({
      shipment: {
        findUnique: vi.fn().mockResolvedValue(makeShipment({ status: 'IN_TRANSIT', vehicle: { id: 'veh-1', status: 'IN_TRANSIT', vehicleNumber: 'MH12AB1234' } })),
        update: vi.fn().mockResolvedValue(makeShipment({ status: 'CANCELLED' })),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await updateShipmentStatus({ id: 'ship-1', status: 'CANCELLED' })

    expect(result.success).toBe(true)
    expect(db.vehicle.update).toHaveBeenCalledWith({ where: { id: 'veh-1' }, data: { status: 'AVAILABLE' } })
  })
})

describe('updateShipment — vehicle reassignment while IN_TRANSIT', () => {
  it('rejects reassigning to a vehicle that is not AVAILABLE', async () => {
    const db = makeDb({
      shipment: { findUnique: vi.fn().mockResolvedValue(makeShipment({ status: 'IN_TRANSIT' })), update: vi.fn() },
      vehicle: { findUnique: vi.fn().mockResolvedValue({ id: 'veh-2', status: 'IN_TRANSIT' }), update: vi.fn() },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await updateShipment({ id: 'ship-1', vehicleId: 'veh-2' })

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-004')
    expect(db.shipment.update).not.toHaveBeenCalled()
  })

  it('releases the old vehicle and assigns IN_TRANSIT to the new one when reassigning an IN_TRANSIT shipment', async () => {
    const db = makeDb({
      shipment: {
        findUnique: vi.fn().mockResolvedValue(makeShipment({ status: 'IN_TRANSIT' })),
        update: vi.fn().mockResolvedValue(makeShipment({ status: 'IN_TRANSIT', vehicleId: 'veh-2' })),
      },
      vehicle: { findUnique: vi.fn().mockResolvedValue({ id: 'veh-2', status: 'AVAILABLE' }), update: vi.fn() },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await updateShipment({ id: 'ship-1', vehicleId: 'veh-2' })

    expect(result.success).toBe(true)
    expect(db.vehicle.update).toHaveBeenCalledWith({ where: { id: 'veh-1' }, data: { status: 'AVAILABLE' } })
    expect(db.vehicle.update).toHaveBeenCalledWith({ where: { id: 'veh-2' }, data: { status: 'IN_TRANSIT' } })
  })

  it('does not touch vehicle status when reassigning a non-IN_TRANSIT shipment', async () => {
    const db = makeDb({
      shipment: {
        findUnique: vi.fn().mockResolvedValue(makeShipment({ status: 'READY' })),
        update: vi.fn().mockResolvedValue(makeShipment({ status: 'READY', vehicleId: 'veh-2' })),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await updateShipment({ id: 'ship-1', vehicleId: 'veh-2' })

    expect(result.success).toBe(true)
    expect(db.vehicle.update).not.toHaveBeenCalled()
  })

  it('rejects editing a terminal (DELIVERED) shipment', async () => {
    const db = makeDb({ shipment: { findUnique: vi.fn().mockResolvedValue(makeShipment({ status: 'DELIVERED' })), update: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await updateShipment({ id: 'ship-1', notes: 'late note' })

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-002')
  })

  it('rejects negative weight on update', async () => {
    const db = makeDb({ shipment: { findUnique: vi.fn().mockResolvedValue(makeShipment({ status: 'PENDING' })), update: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const result = await updateShipment({ id: 'ship-1', weight: -5 })

    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('VAL-005')
  })
})
