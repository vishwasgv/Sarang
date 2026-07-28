import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../permission-guard', () => ({ requirePermission: vi.fn() }))
vi.mock('../../../services/driving.service', () => ({
  getLearnerProfile: vi.fn(),
  upsertLearnerProfile: vi.fn(),
  listDrivingVehicles: vi.fn(),
  createDrivingVehicle: vi.fn().mockResolvedValue({ success: true, data: {} }),
  updateDrivingVehicle: vi.fn().mockResolvedValue({ success: true, data: {} }),
  deleteDrivingVehicle: vi.fn().mockResolvedValue({ success: true }),
  listDrivingSessions: vi.fn(),
  createDrivingSession: vi.fn(),
  updateDrivingSession: vi.fn(),
  generateDrivingSessionInvoice: vi.fn(),
  listDrivingTests: vi.fn(),
  createDrivingTest: vi.fn(),
  updateDrivingTest: vi.fn(),
  getInstructorPassRates: vi.fn(),
  logVehicleMaintenance: vi.fn().mockResolvedValue({ success: true, data: {} }),
  listVehicleMaintenanceLogs: vi.fn(),
  listDrivingPackages: vi.fn(),
  createDrivingPackage: vi.fn().mockResolvedValue({ success: true, data: {} }),
  updateDrivingPackage: vi.fn().mockResolvedValue({ success: true, data: {} }),
  deleteDrivingPackage: vi.fn().mockResolvedValue({ success: true }),
  listDrivingPackageEnrollments: vi.fn(),
  createDrivingPackageEnrollment: vi.fn(),
  deleteDrivingPackageEnrollment: vi.fn(),
  generateDrivingPackageInvoice: vi.fn(),
}))

import { requirePermission } from '../../permission-guard'
import { register } from '../driving.handler'

// Real bug found live (2026-07-28 service-vertical audit, continued): 7
// fleet/package mutations (drivingVehicle create/update/delete/
// logMaintenance, drivingPackage create/update/delete) were gated on
// 'settings.view' — a READ-tier permission — instead of 'settings.modify',
// the write-tier permission this codebase's own permission matrix defines
// for exactly this purpose. provider-schedule.handler.ts and service-
// catalog.handler.ts (the direct siblings: other admin-config CRUD screens
// under Settings) both correctly gate their own mutations on
// 'settings.modify'. Since Manager holds 'settings.view' but NOT
// 'settings.modify' (only Admin does), this let any Manager add/edit/delete
// fleet vehicles and pricing packages.
describe('driving.handler — fleet/package mutation permission gating', () => {
  function captureHandlers() {
    const handlers = new Map<string, (payload: unknown) => Promise<unknown>>()
    register((channel, handler) => { handlers.set(channel, handler) })
    return handlers
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requirePermission).mockResolvedValue(null) // allow, by default
  })

  const cases: Array<[string, unknown]> = [
    ['drivingVehicle:create', { registrationNumber: 'KA01AB1234', make: 'Maruti', model: 'Alto', vehicleClass: 'LMV' }],
    ['drivingVehicle:update', { id: 'veh-1', make: 'Hyundai' }],
    ['drivingVehicle:delete', { id: 'veh-1' }],
    ['drivingVehicle:logMaintenance', { vehicleId: 'veh-1', odometerKm: 5000, serviceType: 'Oil Change' }],
    ['drivingPackage:create', { packageName: '10-Lesson', totalSessions: 10, price: 5000 }],
    ['drivingPackage:update', { id: 'pkg-1', price: 6000 }],
    ['drivingPackage:delete', { id: 'pkg-1' }],
  ]

  it.each(cases)('%s requires settings.modify, not settings.view', async (channel, payload) => {
    const handlers = captureHandlers()
    await handlers.get(channel)!(payload)
    expect(requirePermission).toHaveBeenCalledWith('settings.modify')
    expect(requirePermission).not.toHaveBeenCalledWith('settings.view')
  })

  it('a denial from requirePermission blocks the mutation', async () => {
    const handlers = captureHandlers()
    vi.mocked(requirePermission).mockResolvedValueOnce({ success: false, error: { code: 'PERM-001', message: 'You do not have permission to perform this action.' } })
    const res = await handlers.get('drivingVehicle:create')!({ registrationNumber: 'KA01AB1234', make: 'Maruti', model: 'Alto', vehicleClass: 'LMV' })
    expect(res).toEqual({ success: false, error: { code: 'PERM-001', message: 'You do not have permission to perform this action.' } })
  })

  // Read endpoints in the same file are unaffected by this fix.
  it('drivingVehicle:list and drivingPackage:list are unaffected', async () => {
    const handlers = captureHandlers()
    await handlers.get('drivingVehicle:list')!(undefined)
    await handlers.get('drivingPackage:list')!(undefined)
    expect(requirePermission).not.toHaveBeenCalledWith('settings.modify')
  })
})
