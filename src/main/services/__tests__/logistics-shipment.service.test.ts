import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../logistics-notification.service', () => ({
  scheduleShipmentDispatchNotification: vi.fn().mockResolvedValue(undefined),
  scheduleShipmentDelayedNotification: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { createShipment, updateShipment, updateShipmentStatus, addShipmentStop, updateShipmentStopStatus, deleteShipmentStop } from '../logistics-shipment.service'

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
    shipmentStop: {
      aggregate: vi.fn().mockResolvedValue({ _max: { sequenceNumber: null } }),
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'stop-1', status: 'PENDING', deliveredAt: null, ...data })),
      findUnique: vi.fn().mockResolvedValue({ id: 'stop-1', status: 'PENDING', deliveredAt: null, shipmentId: 'ship-1' }),
      update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'stop-1', shipmentId: 'ship-1', ...data })),
      delete: vi.fn().mockResolvedValue({}),
    },
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

// Phase 58 §2 — Distributor route/beat planning. A stop is additive on top
// of the shipment's own primary destinationAddress — never touches
// Vehicle.status/inventory itself, matching updateShipmentStatus's existing
// vehicle side-effects above (a vehicle stays "in transit" for the whole
// run, not per stop).
describe('addShipmentStop', () => {
  it('rejects a missing destination address', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const result = await addShipmentStop({ shipmentId: 'ship-1', destinationAddress: '' })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown shipment', async () => {
    const db = makeDb({ shipment: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const result = await addShipmentStop({ shipmentId: 'ghost', destinationAddress: 'X' })
    expect(result.success).toBe(false)
  })

  it('rejects adding a stop to a terminal shipment', async () => {
    const db = makeDb({ shipment: { findUnique: vi.fn().mockResolvedValue(makeShipment({ status: 'DELIVERED' })) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const result = await addShipmentStop({ shipmentId: 'ship-1', destinationAddress: 'X' })
    expect(result.success).toBe(false)
  })

  it('assigns sequenceNumber 1 to the first stop on a shipment', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const result = await addShipmentStop({ shipmentId: 'ship-1', destinationAddress: 'Customer A' })
    expect(result.success).toBe(true)
    expect(db.shipmentStop.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ shipmentId: 'ship-1', sequenceNumber: 1, destinationAddress: 'Customer A' })
    }))
  })

  it('assigns the next sequenceNumber after existing stops', async () => {
    const db = makeDb({ shipmentStop: { aggregate: vi.fn().mockResolvedValue({ _max: { sequenceNumber: 3 } }), create: vi.fn().mockResolvedValue({ id: 'stop-4' }) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await addShipmentStop({ shipmentId: 'ship-1', destinationAddress: 'Customer B' })
    expect(db.shipmentStop.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sequenceNumber: 4 })
    }))
  })
})

describe('updateShipmentStopStatus', () => {
  it('rejects an unknown stop', async () => {
    const db = makeDb({ shipmentStop: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const result = await updateShipmentStopStatus({ id: 'ghost', status: 'DELIVERED' })
    expect(result.success).toBe(false)
  })

  it('sets deliveredAt when marking a stop DELIVERED', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await updateShipmentStopStatus({ id: 'stop-1', status: 'DELIVERED' })
    const updateCall = db.shipmentStop.update.mock.calls[0][0]
    expect(updateCall.data.status).toBe('DELIVERED')
    expect(updateCall.data.deliveredAt).toBeInstanceOf(Date)
  })

  it('does not set deliveredAt when marking a stop SKIPPED', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await updateShipmentStopStatus({ id: 'stop-1', status: 'SKIPPED' })
    const updateCall = db.shipmentStop.update.mock.calls[0][0]
    expect(updateCall.data.status).toBe('SKIPPED')
    expect(updateCall.data.deliveredAt).toBeNull()
  })
})

describe('deleteShipmentStop', () => {
  it('rejects an unknown stop', async () => {
    const db = makeDb({ shipmentStop: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const result = await deleteShipmentStop('ghost')
    expect(result.success).toBe(false)
  })

  it('deletes an existing stop', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const result = await deleteShipmentStop('stop-1')
    expect(result.success).toBe(true)
    expect(db.shipmentStop.delete).toHaveBeenCalledWith({ where: { id: 'stop-1' } })
  })
})
