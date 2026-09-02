import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { parseLocalDateStart } from '../utils/date.util'

// 2026-09 §12 — Tours & Travels vertical: reusable tour package templates
// (TourPackage) and their scheduled occurrences (TourDeparture) — the
// "template vs. instance" split, same shape RecurringProfile/Invoice
// already establishes elsewhere in this schema.

export async function createTourPackage(payload: {
  packageName: string; itineraryDescription?: string; durationDays: number
  defaultTotalSeats: number; farePerSeat: number
}) {
  try {
    if (!payload.packageName.trim()) return { success: false, error: { code: 'TPK-001', message: 'Package name is required.' } }
    if (payload.durationDays <= 0) return { success: false, error: { code: 'TPK-002', message: 'Duration must be at least 1 day.' } }
    if (payload.defaultTotalSeats <= 0) return { success: false, error: { code: 'TPK-003', message: 'Default total seats must be greater than zero.' } }
    if (payload.farePerSeat < 0) return { success: false, error: { code: 'TPK-004', message: 'Fare per seat cannot be negative.' } }
    const db = getPrisma()
    const pkg = await db.tourPackage.create({
      data: {
        packageName: payload.packageName.trim(), itineraryDescription: payload.itineraryDescription ?? null,
        durationDays: payload.durationDays, defaultTotalSeats: payload.defaultTotalSeats, farePerSeat: payload.farePerSeat,
      }
    })
    await logAction({ action: 'TOUR_PACKAGE_CREATED', entityType: 'TourPackage', entityId: pkg.id, newValue: { packageName: pkg.packageName } })
    return { success: true, data: pkg }
  } catch (err) {
    return { success: false, error: { code: 'TPK-005', message: err instanceof Error ? err.message : 'Could not create tour package.' } }
  }
}

export async function listTourPackages(filters?: { isActive?: boolean }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.isActive !== undefined) where.isActive = filters.isActive
    const packages = await db.tourPackage.findMany({ where, orderBy: { packageName: 'asc' } })
    return { success: true, data: packages }
  } catch (err) {
    return { success: false, error: { code: 'TPK-006', message: err instanceof Error ? err.message : 'Could not list tour packages.' } }
  }
}

export async function updateTourPackageStatus(id: string, isActive: boolean) {
  try {
    const db = getPrisma()
    const existing = await db.tourPackage.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'TPK-007', message: 'Tour package not found.' } }
    const updated = await db.tourPackage.update({ where: { id }, data: { isActive } })
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'TPK-008', message: err instanceof Error ? err.message : 'Could not update tour package.' } }
  }
}

export async function createTourDeparture(payload: {
  tourPackageId: string; departureDate: string; vehicleId?: string; totalSeats?: number
}) {
  try {
    const db = getPrisma()
    const pkg = await db.tourPackage.findUnique({ where: { id: payload.tourPackageId } })
    if (!pkg) return { success: false, error: { code: 'TPK-007', message: 'Tour package not found.' } }
    const departure = await db.tourDeparture.create({
      data: {
        tourPackageId: payload.tourPackageId, departureDate: parseLocalDateStart(payload.departureDate),
        vehicleId: payload.vehicleId ?? null, totalSeats: payload.totalSeats ?? pkg.defaultTotalSeats,
      },
      include: { tourPackage: { select: { packageName: true } }, vehicle: { select: { registrationNumber: true } } }
    })
    await logAction({ action: 'TOUR_DEPARTURE_CREATED', entityType: 'TourDeparture', entityId: departure.id, newValue: { tourPackageId: payload.tourPackageId, departureDate: payload.departureDate } })
    return { success: true, data: departure }
  } catch (err) {
    return { success: false, error: { code: 'TPD-001', message: err instanceof Error ? err.message : 'Could not create tour departure.' } }
  }
}

export async function listTourDepartures(filters?: { tourPackageId?: string; status?: string }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.tourPackageId) where.tourPackageId = filters.tourPackageId
    if (filters?.status) where.status = filters.status
    const departures = await db.tourDeparture.findMany({
      where,
      include: { tourPackage: { select: { packageName: true, farePerSeat: true } }, vehicle: { select: { registrationNumber: true } } },
      orderBy: { departureDate: 'asc' }
    })
    return { success: true, data: departures }
  } catch (err) {
    return { success: false, error: { code: 'TPD-002', message: err instanceof Error ? err.message : 'Could not list tour departures.' } }
  }
}

export async function updateTourDepartureStatus(id: string, status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED') {
  try {
    const db = getPrisma()
    const existing = await db.tourDeparture.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'TPD-003', message: 'Tour departure not found.' } }
    const updated = await db.tourDeparture.update({ where: { id }, data: { status } })
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'TPD-004', message: err instanceof Error ? err.message : 'Could not update tour departure.' } }
  }
}

export const tourPackageService = {
  createTourPackage, listTourPackages, updateTourPackageStatus,
  createTourDeparture, listTourDepartures, updateTourDepartureStatus,
}
