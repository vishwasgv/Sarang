import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { roundCurrency } from './currency.service'
import { parseLocalDateStart } from '../utils/date.util'

// 2026-09 §12 — Tours & Travels vertical: driver duty settlement, the
// mechanic the user specifically asked for ("driver charges... total km
// vehicle run... extra pay once exceeding"). Real-market-grounded (web
// research, Sept 2026): outstation cab fares are quoted per-km by vehicle
// class with a minimum daily km, NOT live metering — the customer-facing
// excess-km/hour charge only kicks in once the package's included daily
// allowance is exceeded. Driver Bata/night-halt/night-driving are a
// SEPARATE, largely flat driver-cost side (paid out, never billed as a
// markup) — these two sides are computed and stored independently here.

// Per-km excess rate by vehicle class — same figures the market research
// found (sedan ~₹12/km, SUV/Innova ~₹17/km, Tempo Traveller ~₹18/km,
// Bus ~₹38/km; MINI_BUS interpolated between Tempo and Bus). A shop's real
// rate varies by local market — this is a reasonable default, not a
// regulated figure, and is the one constant a future pass might want to
// make configurable per business rather than hardcoded.
const EXCESS_KM_RATE_BY_VEHICLE_TYPE: Record<string, number> = {
  SEDAN: 12, SUV: 17, TEMPO_TRAVELLER: 18, MINI_BUS: 25, BUS: 38,
}
const DEFAULT_EXCESS_KM_RATE = EXCESS_KM_RATE_BY_VEHICLE_TYPE.SEDAN
// Excess-hour rate for local full-day hire exceeding includedHoursPerDay —
// no equivalent per-vehicle-class breakdown surfaced in the market
// research, so one flat default.
const EXCESS_HOUR_RATE = 100

export async function startDuty(payload: {
  tripBookingId: string
  driverId: string
  dutyDate: string
  startOdometer: number
  dutyStartTime: string
  driverBataAmount?: number
  nightHaltCharge?: number
  nightDrivingAllowance?: number
  notes?: string
}) {
  try {
    const db = getPrisma()
    const booking = await db.tripBooking.findUnique({ where: { id: payload.tripBookingId } })
    if (!booking) return { success: false, error: { code: 'DDL-006', message: 'Trip booking not found.' } }
    const driver = await db.employee.findUnique({ where: { id: payload.driverId } })
    if (!driver) return { success: false, error: { code: 'DDL-007', message: 'Driver not found.' } }
    if (payload.startOdometer < 0) return { success: false, error: { code: 'DDL-008', message: 'Start odometer cannot be negative.' } }

    const log = await db.driverDutyLog.create({
      data: {
        tripBookingId: payload.tripBookingId, driverId: payload.driverId, dutyDate: parseLocalDateStart(payload.dutyDate),
        startOdometer: payload.startOdometer, dutyStartTime: new Date(payload.dutyStartTime),
        driverBataAmount: payload.driverBataAmount ?? 0, nightHaltCharge: payload.nightHaltCharge ?? 0, nightDrivingAllowance: payload.nightDrivingAllowance ?? 0,
        notes: payload.notes ?? null,
      }
    })
    await logAction({ action: 'DRIVER_DUTY_STARTED', entityType: 'DriverDutyLog', entityId: log.id, newValue: { tripBookingId: payload.tripBookingId, driverId: payload.driverId } })
    return { success: true, data: log }
  } catch (err) {
    return { success: false, error: { code: 'DDL-009', message: err instanceof Error ? err.message : 'Could not start duty.' } }
  }
}

// Settles the duty: kmDriven/drivingHours are simple deltas; excessKm/
// excessHours only accrue past the trip booking's own included daily
// allowance (null allowance = no excess concept for this trip, e.g. an
// outstation multi-day charter with no local-hour cap). Snapshotted once,
// here, at close time — a closed duty log is a settled financial record,
// same reasoning InvoiceItem snapshots jewellery pricing at sale time
// rather than re-deriving it later from possibly-since-changed data.
export async function closeDuty(payload: { id: string; endOdometer: number; dutyEndTime: string }) {
  try {
    const db = getPrisma()
    const log = await db.driverDutyLog.findUnique({ where: { id: payload.id }, include: { tripBooking: { include: { vehicle: true } } } })
    if (!log) return { success: false, error: { code: 'DDL-001', message: 'Duty log not found.' } }
    if (log.endOdometer != null) return { success: false, error: { code: 'DDL-002', message: 'This duty has already been closed.' } }
    if (payload.endOdometer < log.startOdometer) return { success: false, error: { code: 'DDL-003', message: 'End odometer cannot be less than start odometer.' } }
    const dutyEndTime = new Date(payload.dutyEndTime)
    if (dutyEndTime.getTime() < log.dutyStartTime.getTime()) return { success: false, error: { code: 'DDL-004', message: 'Duty end time cannot be before start time.' } }

    const kmDriven = roundCurrency(payload.endOdometer - log.startOdometer)
    const drivingHours = Math.round(((dutyEndTime.getTime() - log.dutyStartTime.getTime()) / 3600000) * 100) / 100

    const booking = log.tripBooking
    const vehicleType = booking.vehicle?.vehicleType
    const excessKmRate = vehicleType ? (EXCESS_KM_RATE_BY_VEHICLE_TYPE[vehicleType] ?? DEFAULT_EXCESS_KM_RATE) : DEFAULT_EXCESS_KM_RATE

    const excessKm = booking.includedKmPerDay != null ? Math.max(0, roundCurrency(kmDriven - booking.includedKmPerDay)) : 0
    const excessKmCharge = roundCurrency(excessKm * excessKmRate)
    const excessHours = booking.includedHoursPerDay != null ? Math.max(0, roundCurrency(drivingHours - booking.includedHoursPerDay)) : 0
    const excessHourCharge = roundCurrency(excessHours * EXCESS_HOUR_RATE)

    const updated = await db.$transaction(async (tx) => {
      const closed = await tx.driverDutyLog.update({
        where: { id: payload.id },
        data: { endOdometer: payload.endOdometer, dutyEndTime, kmDriven, drivingHours, excessKm, excessKmCharge, excessHours, excessHourCharge }
      })
      if (booking.vehicleId && payload.endOdometer > (booking.vehicle?.currentOdometer ?? 0)) {
        await tx.tourVehicle.update({ where: { id: booking.vehicleId }, data: { currentOdometer: payload.endOdometer } })
      }
      return closed
    })

    await logAction({ action: 'DRIVER_DUTY_CLOSED', entityType: 'DriverDutyLog', entityId: payload.id, newValue: { kmDriven, drivingHours, excessKmCharge, excessHourCharge } })
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'DDL-005', message: err instanceof Error ? err.message : 'Could not close duty.' } }
  }
}

export async function listDutyLogs(filters?: { tripBookingId?: string; driverId?: string }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.tripBookingId) where.tripBookingId = filters.tripBookingId
    if (filters?.driverId) where.driverId = filters.driverId
    const logs = await db.driverDutyLog.findMany({ where, include: { driver: { select: { id: true, fullName: true } } }, orderBy: { dutyDate: 'desc' } })
    return { success: true, data: logs }
  } catch (err) {
    return { success: false, error: { code: 'DDL-010', message: err instanceof Error ? err.message : 'Could not list duty logs.' } }
  }
}

export const driverDutyLogService = { startDuty, closeDuty, listDutyLogs }
