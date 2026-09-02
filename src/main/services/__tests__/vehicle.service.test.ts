import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { createVehicle, createVehicleServiceLog, getFleetAndSeatAvailability } from '../vehicle.service'

beforeEach(() => vi.clearAllMocks())

describe('vehicle.service.createVehicle', () => {
  it('rejects a duplicate registration number', async () => {
    const db = { tourVehicle: { findUnique: vi.fn().mockResolvedValue({ id: 'v-1' }) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createVehicle({ registrationNumber: 'KA01AB1234', vehicleType: 'SEDAN', seatingCapacity: 4 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('VEH-001')
  })

  it('creates a vehicle when the registration number is free', async () => {
    const db = {
      tourVehicle: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'v-1', registrationNumber: 'KA01AB1234' }),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createVehicle({ registrationNumber: 'KA01AB1234', vehicleType: 'SEDAN', seatingCapacity: 4 })

    expect(res.success).toBe(true)
  })
})

describe('vehicle.service.createVehicleServiceLog', () => {
  it('advances currentOdometer when the recorded reading is newer than what is on file', async () => {
    const tx = {
      vehicleServiceLog: { create: vi.fn().mockResolvedValue({ id: 'vsl-1' }) },
      tourVehicle: { update: vi.fn().mockResolvedValue({}) },
    }
    const db = {
      tourVehicle: { findUnique: vi.fn().mockResolvedValue({ id: 'v-1', currentOdometer: 10000 }) },
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createVehicleServiceLog({ vehicleId: 'v-1', serviceDate: '2024-01-01', serviceType: 'SERVICE', odometerAtService: 10500 })

    expect(res.success).toBe(true)
    expect(tx.tourVehicle.update).toHaveBeenCalledWith({ where: { id: 'v-1' }, data: { currentOdometer: 10500 } })
  })

  it('does not move currentOdometer backwards when the reading is older than what is on file', async () => {
    const tx = {
      vehicleServiceLog: { create: vi.fn().mockResolvedValue({ id: 'vsl-1' }) },
      tourVehicle: { update: vi.fn().mockResolvedValue({}) },
    }
    const db = {
      tourVehicle: { findUnique: vi.fn().mockResolvedValue({ id: 'v-1', currentOdometer: 10000 }) },
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createVehicleServiceLog({ vehicleId: 'v-1', serviceDate: '2024-01-01', serviceType: 'SERVICE', odometerAtService: 9000 })

    expect(res.success).toBe(true)
    expect(tx.tourVehicle.update).not.toHaveBeenCalled()
  })
})

describe('vehicle.service.getFleetAndSeatAvailability', () => {
  it('computes seatsRemaining per departure and groups booked date ranges per vehicle', async () => {
    const db = {
      tourVehicle: { findMany: vi.fn().mockResolvedValue([{ id: 'v-1', registrationNumber: 'KA01AB1234', vehicleType: 'SEDAN' }]) },
      tripBooking: {
        findMany: vi.fn().mockResolvedValue([
          { vehicleId: 'v-1', tripStartDate: new Date('2024-06-10'), tripEndDate: new Date('2024-06-12'), bookingNumber: 'TRP-00001' },
        ]),
      },
      tourDeparture: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'dep-1', departureDate: new Date('2024-06-15'), totalSeats: 20, seatsBooked: 14, tourPackage: { packageName: 'Kerala Tour' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getFleetAndSeatAvailability({ dateFrom: '2024-06-01', dateTo: '2024-06-30' })

    expect(res.success).toBe(true)
    const data = (res as { data: { vehicles: Array<{ bookedDateRanges: unknown[] }>; departures: Array<{ seatsRemaining: number }> } }).data
    expect(data.vehicles[0].bookedDateRanges).toHaveLength(1)
    expect(data.departures[0].seatsRemaining).toBe(6)
  })
})
