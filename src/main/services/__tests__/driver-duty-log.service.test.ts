import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { startDuty, closeDuty } from '../driver-duty-log.service'

// 2026-09 §12 — Tours & Travels: driver duty settlement — the mechanic the
// user specifically asked for. Real money on both the revenue (excess-km/
// hour, billed to the customer) and payroll (Bata/night-halt/night-driving)
// side, so this file gets the most careful coverage of the whole vertical.

beforeEach(() => vi.clearAllMocks())

function makeCloseDutyDb(overrides: {
  log?: Record<string, unknown>
  vehicleType?: string | null
  includedKmPerDay?: number | null
  includedHoursPerDay?: number | null
  vehicleCurrentOdometer?: number
} = {}) {
  const log = {
    id: 'ddl-1', startOdometer: 1000, dutyStartTime: new Date('2024-06-01T08:00:00'), endOdometer: null,
    tripBooking: {
      vehicleId: 'v-1',
      includedKmPerDay: overrides.includedKmPerDay === undefined ? 300 : overrides.includedKmPerDay,
      includedHoursPerDay: overrides.includedHoursPerDay === undefined ? 12 : overrides.includedHoursPerDay,
      vehicle: { id: 'v-1', vehicleType: overrides.vehicleType === undefined ? 'SEDAN' : overrides.vehicleType, currentOdometer: overrides.vehicleCurrentOdometer ?? 1000 },
    },
    ...overrides.log,
  }
  const tx: Record<string, any> = {
    driverDutyLog: { update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'ddl-1', ...data })) },
    tourVehicle: { update: vi.fn().mockResolvedValue({}) },
  }
  const db: Record<string, any> = {
    driverDutyLog: { findUnique: vi.fn().mockResolvedValue(log) },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx)),
  }
  return { db, tx }
}

describe('driver-duty-log.service.closeDuty — km/hour math', () => {
  it('computes zero excess when kmDriven and drivingHours stay within the included allowance', async () => {
    const { db } = makeCloseDutyDb({ includedKmPerDay: 300, includedHoursPerDay: 12 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // 1000 -> 1250 = 250km (< 300 included); 08:00 -> 18:00 = 10hrs (< 12 included)
    const res = await closeDuty({ id: 'ddl-1', endOdometer: 1250, dutyEndTime: '2024-06-01T18:00:00' })

    expect(res.success).toBe(true)
    const data = (res as { data: { kmDriven: number; drivingHours: number; excessKm: number; excessKmCharge: number; excessHours: number; excessHourCharge: number } }).data
    expect(data.kmDriven).toBe(250)
    expect(data.drivingHours).toBe(10)
    expect(data.excessKm).toBe(0)
    expect(data.excessKmCharge).toBe(0)
    expect(data.excessHours).toBe(0)
    expect(data.excessHourCharge).toBe(0)
  })

  it('charges excess km at the SEDAN rate (₹12/km) once kmDriven exceeds includedKmPerDay', async () => {
    const { db } = makeCloseDutyDb({ vehicleType: 'SEDAN', includedKmPerDay: 300, includedHoursPerDay: 12 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // 1000 -> 1350 = 350km, 50km over the 300 included -> 50 * 12 = 600
    const res = await closeDuty({ id: 'ddl-1', endOdometer: 1350, dutyEndTime: '2024-06-01T18:00:00' })

    const data = (res as { data: { excessKm: number; excessKmCharge: number } }).data
    expect(data.excessKm).toBe(50)
    expect(data.excessKmCharge).toBe(600)
  })

  it('charges excess km at the BUS rate (₹38/km) — different vehicle classes use different rates', async () => {
    const { db } = makeCloseDutyDb({ vehicleType: 'BUS', includedKmPerDay: 300, includedHoursPerDay: 12 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await closeDuty({ id: 'ddl-1', endOdometer: 1350, dutyEndTime: '2024-06-01T18:00:00' })

    const data = (res as { data: { excessKm: number; excessKmCharge: number } }).data
    expect(data.excessKm).toBe(50)
    expect(data.excessKmCharge).toBe(1900) // 50 * 38
  })

  it('charges excess hours at the flat ₹100/hr rate once drivingHours exceeds includedHoursPerDay', async () => {
    const { db } = makeCloseDutyDb({ includedKmPerDay: 300, includedHoursPerDay: 8 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // 08:00 -> 18:00 = 10hrs, 2hrs over the 8 included -> 2 * 100 = 200
    const res = await closeDuty({ id: 'ddl-1', endOdometer: 1100, dutyEndTime: '2024-06-01T18:00:00' })

    const data = (res as { data: { excessHours: number; excessHourCharge: number } }).data
    expect(data.excessHours).toBe(2)
    expect(data.excessHourCharge).toBe(200)
  })

  it('never computes an excess when includedKmPerDay/includedHoursPerDay are null (e.g. an outstation multi-day charter with no local-hour cap)', async () => {
    const { db } = makeCloseDutyDb({ includedKmPerDay: null, includedHoursPerDay: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await closeDuty({ id: 'ddl-1', endOdometer: 5000, dutyEndTime: '2024-06-02T18:00:00' })

    const data = (res as { data: { excessKm: number; excessKmCharge: number; excessHours: number; excessHourCharge: number } }).data
    expect(data.excessKm).toBe(0)
    expect(data.excessKmCharge).toBe(0)
    expect(data.excessHours).toBe(0)
    expect(data.excessHourCharge).toBe(0)
  })

  it('advances the vehicle currentOdometer when endOdometer is greater than what is on file', async () => {
    const { db, tx } = makeCloseDutyDb({ vehicleCurrentOdometer: 1000 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await closeDuty({ id: 'ddl-1', endOdometer: 1250, dutyEndTime: '2024-06-01T18:00:00' })

    expect(tx.tourVehicle.update).toHaveBeenCalledWith({ where: { id: 'v-1' }, data: { currentOdometer: 1250 } })
  })
})

describe('driver-duty-log.service.closeDuty — validation', () => {
  it('rejects a duty log that has already been closed', async () => {
    const { db } = makeCloseDutyDb({ log: { endOdometer: 1200 } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await closeDuty({ id: 'ddl-1', endOdometer: 1300, dutyEndTime: '2024-06-01T18:00:00' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DDL-002')
  })

  it('rejects an endOdometer less than startOdometer', async () => {
    const { db } = makeCloseDutyDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await closeDuty({ id: 'ddl-1', endOdometer: 500, dutyEndTime: '2024-06-01T18:00:00' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DDL-003')
  })

  it('rejects a dutyEndTime before dutyStartTime', async () => {
    const { db } = makeCloseDutyDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await closeDuty({ id: 'ddl-1', endOdometer: 1200, dutyEndTime: '2024-06-01T07:00:00' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DDL-004')
  })

  it('rejects an unknown duty log id', async () => {
    const db = { driverDutyLog: { findUnique: vi.fn().mockResolvedValue(null) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await closeDuty({ id: 'ddl-missing', endOdometer: 1200, dutyEndTime: '2024-06-01T18:00:00' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DDL-001')
  })
})

describe('driver-duty-log.service.startDuty', () => {
  it('rejects an unknown trip booking', async () => {
    const db = { tripBooking: { findUnique: vi.fn().mockResolvedValue(null) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await startDuty({ tripBookingId: 'trp-missing', driverId: 'emp-1', dutyDate: '2024-06-01', startOdometer: 1000, dutyStartTime: '2024-06-01T08:00:00' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DDL-006')
  })

  it('rejects an unknown driver', async () => {
    const db = {
      tripBooking: { findUnique: vi.fn().mockResolvedValue({ id: 'trp-1' }) },
      employee: { findUnique: vi.fn().mockResolvedValue(null) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await startDuty({ tripBookingId: 'trp-1', driverId: 'emp-missing', dutyDate: '2024-06-01', startOdometer: 1000, dutyStartTime: '2024-06-01T08:00:00' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DDL-007')
  })

  it('creates a duty log with the driver-cost fields defaulted to zero when omitted', async () => {
    const db = {
      tripBooking: { findUnique: vi.fn().mockResolvedValue({ id: 'trp-1' }) },
      employee: { findUnique: vi.fn().mockResolvedValue({ id: 'emp-1' }) },
      driverDutyLog: { create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'ddl-1', ...data })) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await startDuty({ tripBookingId: 'trp-1', driverId: 'emp-1', dutyDate: '2024-06-01', startOdometer: 1000, dutyStartTime: '2024-06-01T08:00:00' })

    expect(res.success).toBe(true)
    expect((res as { data: { driverBataAmount: number; nightHaltCharge: number; nightDrivingAllowance: number } }).data).toMatchObject({ driverBataAmount: 0, nightHaltCharge: 0, nightDrivingAllowance: 0 })
  })
})
