import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { toLocalISODate, parseLocalDateStart, parseLocalDateEnd } from '../utils/date.util'

// 2026-09 §12 — Tours & Travels vertical: fleet (TourVehicle, named to avoid
// colliding with the pre-existing Logistics & Supply Chain "Vehicle" model —
// a different concept, own-goods-delivery fleet, that happened to want the
// same name) + vehicle service log + the Fleet & Seat Availability Calendar.

export async function createVehicle(payload: {
  registrationNumber: string
  vehicleType: 'SEDAN' | 'SUV' | 'TEMPO_TRAVELLER' | 'MINI_BUS' | 'BUS'
  seatingCapacity: number
  notes?: string
}) {
  try {
    const db = getPrisma()
    const existing = await db.tourVehicle.findUnique({ where: { registrationNumber: payload.registrationNumber } })
    if (existing) return { success: false, error: { code: 'VEH-001', message: 'A vehicle with this registration number already exists.' } }
    const vehicle = await db.tourVehicle.create({
      data: { registrationNumber: payload.registrationNumber, vehicleType: payload.vehicleType, seatingCapacity: payload.seatingCapacity, notes: payload.notes ?? null }
    })
    await logAction({ action: 'TOUR_VEHICLE_CREATED', entityType: 'TourVehicle', entityId: vehicle.id, newValue: { registrationNumber: vehicle.registrationNumber } })
    return { success: true, data: vehicle }
  } catch (err) {
    return { success: false, error: { code: 'VEH-002', message: err instanceof Error ? err.message : 'Could not create vehicle.' } }
  }
}

export async function listVehicles(filters?: { status?: string }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.status) where.status = filters.status
    const vehicles = await db.tourVehicle.findMany({ where, orderBy: { registrationNumber: 'asc' } })
    return { success: true, data: vehicles }
  } catch (err) {
    return { success: false, error: { code: 'VEH-003', message: err instanceof Error ? err.message : 'Could not list vehicles.' } }
  }
}

export async function updateVehicleStatus(id: string, status: 'ACTIVE' | 'IN_SERVICE' | 'INACTIVE') {
  try {
    const db = getPrisma()
    const existing = await db.tourVehicle.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'VEH-004', message: 'Vehicle not found.' } }
    const updated = await db.tourVehicle.update({ where: { id }, data: { status } })
    await logAction({ action: 'TOUR_VEHICLE_STATUS_UPDATED', entityType: 'TourVehicle', entityId: id, newValue: { status } })
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'VEH-005', message: err instanceof Error ? err.message : 'Could not update vehicle status.' } }
  }
}

export async function deleteVehicle(id: string) {
  try {
    const db = getPrisma()
    const existing = await db.tourVehicle.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'VEH-004', message: 'Vehicle not found.' } }
    const bookingCount = await db.tripBooking.count({ where: { vehicleId: id } })
    if (bookingCount > 0) return { success: false, error: { code: 'VEH-006', message: 'Cannot delete a vehicle that has trip bookings — mark it Inactive instead.' } }
    await db.tourVehicle.delete({ where: { id } })
    await logAction({ action: 'TOUR_VEHICLE_DELETED', entityType: 'TourVehicle', entityId: id })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'VEH-007', message: err instanceof Error ? err.message : 'Could not delete vehicle.' } }
  }
}

// Signature item 4's write path — Vehicle Service-Due & Total-KM-Run report
// (report.service.ts) reads VehicleServiceLog rolled up against
// DriverDutyLog.kmDriven. Logging a service visit also advances the
// vehicle's currentOdometer when the recorded reading is newer than what's
// on file — the same "a service visit is also a real odometer reading"
// convention this schema otherwise has no other trigger for.
export async function createVehicleServiceLog(payload: {
  vehicleId: string
  serviceDate: string
  serviceType: 'SERVICE' | 'REPAIR' | 'MAINTENANCE'
  odometerAtService: number
  cost?: number
  nextServiceDueKm?: number
  nextServiceDueDate?: string
  vendorName?: string
  notes?: string
  createdById?: string
}) {
  try {
    const db = getPrisma()
    const vehicle = await db.tourVehicle.findUnique({ where: { id: payload.vehicleId } })
    if (!vehicle) return { success: false, error: { code: 'VEH-004', message: 'Vehicle not found.' } }
    const log = await db.$transaction(async (tx) => {
      const created = await tx.vehicleServiceLog.create({
        data: {
          vehicleId: payload.vehicleId, serviceDate: parseLocalDateStart(payload.serviceDate), serviceType: payload.serviceType,
          odometerAtService: payload.odometerAtService, cost: payload.cost ?? 0,
          nextServiceDueKm: payload.nextServiceDueKm ?? null,
          nextServiceDueDate: payload.nextServiceDueDate ? parseLocalDateStart(payload.nextServiceDueDate) : null,
          vendorName: payload.vendorName ?? null, notes: payload.notes ?? null, createdById: payload.createdById ?? null,
        }
      })
      if (payload.odometerAtService > vehicle.currentOdometer) {
        await tx.tourVehicle.update({ where: { id: payload.vehicleId }, data: { currentOdometer: payload.odometerAtService } })
      }
      return created
    })
    await logAction({ userId: payload.createdById, action: 'VEHICLE_SERVICE_LOGGED', entityType: 'VehicleServiceLog', entityId: log.id, newValue: { vehicleId: payload.vehicleId } })
    return { success: true, data: log }
  } catch (err) {
    return { success: false, error: { code: 'VEH-008', message: err instanceof Error ? err.message : 'Could not log vehicle service.' } }
  }
}

export async function listVehicleServiceLogs(vehicleId?: string) {
  try {
    const db = getPrisma()
    const logs = await db.vehicleServiceLog.findMany({ where: vehicleId ? { vehicleId } : undefined, orderBy: { serviceDate: 'desc' } })
    return { success: true, data: logs }
  } catch (err) {
    return { success: false, error: { code: 'VEH-009', message: err instanceof Error ? err.message : 'Could not list service logs.' } }
  }
}

// Signature item 1 — Fleet & Seat Availability Calendar. Every non-inactive
// vehicle's booked date ranges in the window (from CHARTER TripBookings),
// plus every scheduled TourDeparture's live seats-remaining — one screen
// answers both "which vehicle is free when" and "which tour still has room."
export interface VehicleAvailabilityRow {
  vehicleId: string; registrationNumber: string; vehicleType: string
  bookedDateRanges: Array<{ from: string; to: string; bookingNumber: string }>
}
export interface DepartureAvailabilityRow {
  departureId: string; packageName: string; departureDate: string
  totalSeats: number; seatsBooked: number; seatsRemaining: number
}

export async function getFleetAndSeatAvailability(params: { dateFrom: string; dateTo: string }) {
  try {
    const db = getPrisma()
    const from = parseLocalDateStart(params.dateFrom)
    const to = parseLocalDateEnd(params.dateTo)

    const [vehicles, bookings, departures] = await Promise.all([
      db.tourVehicle.findMany({ where: { status: { not: 'INACTIVE' } }, orderBy: { registrationNumber: 'asc' } }),
      db.tripBooking.findMany({
        where: {
          bookingType: 'CHARTER', status: { not: 'CANCELLED' }, vehicleId: { not: null },
          tripStartDate: { lte: to },
          OR: [{ tripEndDate: { gte: from } }, { tripEndDate: null, tripStartDate: { gte: from } }]
        },
        select: { vehicleId: true, tripStartDate: true, tripEndDate: true, bookingNumber: true }
      }),
      db.tourDeparture.findMany({
        where: { status: 'SCHEDULED', departureDate: { gte: from, lte: to } },
        include: { tourPackage: { select: { packageName: true } } },
        orderBy: { departureDate: 'asc' }
      })
    ])

    const bookingsByVehicle = new Map<string, Array<{ from: string; to: string; bookingNumber: string }>>()
    for (const b of bookings) {
      if (!b.vehicleId) continue
      const arr = bookingsByVehicle.get(b.vehicleId) ?? []
      arr.push({ from: toLocalISODate(b.tripStartDate), to: toLocalISODate(b.tripEndDate ?? b.tripStartDate), bookingNumber: b.bookingNumber })
      bookingsByVehicle.set(b.vehicleId, arr)
    }

    const vehicleRows: VehicleAvailabilityRow[] = vehicles.map(v => ({
      vehicleId: v.id, registrationNumber: v.registrationNumber, vehicleType: v.vehicleType,
      bookedDateRanges: bookingsByVehicle.get(v.id) ?? []
    }))
    const departureRows: DepartureAvailabilityRow[] = departures.map(d => ({
      departureId: d.id, packageName: d.tourPackage.packageName, departureDate: toLocalISODate(d.departureDate),
      totalSeats: d.totalSeats, seatsBooked: d.seatsBooked, seatsRemaining: Math.max(0, d.totalSeats - d.seatsBooked)
    }))

    return { success: true, data: { vehicles: vehicleRows, departures: departureRows } }
  } catch (err) {
    return { success: false, error: { code: 'VEH-010', message: err instanceof Error ? err.message : 'Could not load availability.' } }
  }
}

export const vehicleService = {
  createVehicle, listVehicles, updateVehicleStatus, deleteVehicle,
  createVehicleServiceLog, listVehicleServiceLogs, getFleetAndSeatAvailability,
}
