import { requirePermission } from '../permission-guard'
import {
  getLearnerProfile,
  upsertLearnerProfile,
  listDrivingVehicles,
  createDrivingVehicle,
  updateDrivingVehicle,
  deleteDrivingVehicle,
  listDrivingSessions,
  createDrivingSession,
  updateDrivingSession,
  generateDrivingSessionInvoice,
  listDrivingTests,
  createDrivingTest,
  updateDrivingTest,
  listDrivingPackages,
  createDrivingPackage,
  updateDrivingPackage,
  deleteDrivingPackage,
  listDrivingPackageEnrollments,
  createDrivingPackageEnrollment,
  deleteDrivingPackageEnrollment,
  generateDrivingPackageInvoice,
} from '../../services/driving.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  // ── Learner Profile ────────────────────────────────────────────────────────
  handle('learnerProfile:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { customerId: string }
    return getLearnerProfile(payload.customerId)
  })

  handle('learnerProfile:upsert', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { customerId: string; dlApplicationNumber?: string | null; learnerLicenseNumber?: string | null; learnerLicenseDate?: string | null; permanentLicenseNumber?: string | null; permanentLicenseDate?: string | null; licenseClass?: string; vehicleClassPreference?: string | null }
    return upsertLearnerProfile(payload)
  })

  // ── Vehicles ───────────────────────────────────────────────────────────────
  handle('drivingVehicle:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { status?: string }
    return listDrivingVehicles(payload.status)
  })

  handle('drivingVehicle:create', async (raw) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const payload = raw as { registrationNumber: string; make: string; model: string; vehicleClass: string; instructorId?: string; status?: string }
    return createDrivingVehicle(payload)
  })

  handle('drivingVehicle:update', async (raw) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const payload = raw as { id: string; registrationNumber?: string; make?: string; model?: string; vehicleClass?: string; instructorId?: string | null; status?: string }
    return updateDrivingVehicle(payload)
  })

  handle('drivingVehicle:delete', async (raw) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const payload = raw as { id: string }
    return deleteDrivingVehicle(payload.id)
  })

  // ── Sessions ───────────────────────────────────────────────────────────────
  handle('drivingSession:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { learnerId?: string; instructorId?: string; date?: string; status?: string }
    return listDrivingSessions(payload)
  })

  handle('drivingSession:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { learnerId: string; instructorId: string; vehicleId: string; sessionDate: string; sessionTime: string; durationMinutes?: number; pickupPoint?: string; sessionNumber?: number; sessionFee?: number; packageEnrollmentId?: string }
    return createDrivingSession(payload)
  })

  handle('drivingSession:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string; status?: string; instructorNotes?: string; sessionDate?: string; sessionTime?: string; durationMinutes?: number; pickupPoint?: string | null; sessionFee?: number | null }
    return updateDrivingSession(payload)
  })

  handle('drivingSession:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const { id } = raw as { id: string }
    return generateDrivingSessionInvoice(id)
  })

  // ── Tests ──────────────────────────────────────────────────────────────────
  handle('drivingSession:listTests', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { learnerId?: string; testType?: string; result?: string }
    return listDrivingTests(payload)
  })

  handle('drivingSession:createTest', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { learnerId: string; testType: string; testDate: string; testCenter: string; notes?: string }
    return createDrivingTest(payload)
  })

  handle('drivingSession:updateTest', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string; result?: string; retestDate?: string | null; notes?: string | null }
    return updateDrivingTest(payload)
  })

  // ── Packages (Phase 41) ─────────────────────────────────────────────────────
  handle('drivingPackage:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { isActive?: boolean }
    return listDrivingPackages(payload.isActive)
  })

  handle('drivingPackage:create', async (raw) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const payload = raw as { packageName: string; totalSessions: number; price: number; vehicleClass?: string; isActive?: boolean }
    return createDrivingPackage(payload)
  })

  handle('drivingPackage:update', async (raw) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const payload = raw as { id: string; packageName?: string; totalSessions?: number; price?: number; vehicleClass?: string; isActive?: boolean }
    return updateDrivingPackage(payload)
  })

  handle('drivingPackage:delete', async (raw) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const { id } = raw as { id: string }
    return deleteDrivingPackage(id)
  })

  handle('drivingPackageEnrollment:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { learnerId?: string }
    return listDrivingPackageEnrollments(payload.learnerId)
  })

  handle('drivingPackageEnrollment:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { learnerId: string; packageId: string; purchaseDate?: string; notes?: string }
    return createDrivingPackageEnrollment(payload)
  })

  handle('drivingPackageEnrollment:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const { id } = raw as { id: string }
    return deleteDrivingPackageEnrollment(id)
  })

  handle('drivingPackageEnrollment:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const { id } = raw as { id: string }
    return generateDrivingPackageInvoice(id)
  })
}
