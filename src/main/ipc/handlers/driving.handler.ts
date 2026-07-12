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
import {
  UpsertLearnerProfileSchema,
  CreateDrivingVehicleSchema,
  UpdateDrivingVehicleSchema,
  DeleteDrivingVehicleSchema,
  CreateDrivingSessionSchema,
  UpdateDrivingSessionSchema,
  GenerateDrivingSessionInvoiceSchema,
  CreateDrivingTestSchema,
  UpdateDrivingTestSchema,
  CreateDrivingPackageSchema,
  UpdateDrivingPackageSchema,
  DeleteDrivingPackageSchema,
  CreateDrivingPackageEnrollmentSchema,
  DeleteDrivingPackageEnrollmentSchema,
  GenerateDrivingPackageInvoiceSchema,
} from '../../validation/driving.validation'

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
    const parsed = UpsertLearnerProfileSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return upsertLearnerProfile(parsed.data)
  })

  // ── Vehicles ───────────────────────────────────────────────────────────────
  handle('drivingVehicle:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { status?: string }
    return listDrivingVehicles(payload.status)
  })

  handle('drivingVehicle:create', async (raw) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const parsed = CreateDrivingVehicleSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createDrivingVehicle(parsed.data)
  })

  handle('drivingVehicle:update', async (raw) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const parsed = UpdateDrivingVehicleSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateDrivingVehicle(parsed.data)
  })

  handle('drivingVehicle:delete', async (raw) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const parsed = DeleteDrivingVehicleSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteDrivingVehicle(parsed.data.id)
  })

  // ── Sessions ───────────────────────────────────────────────────────────────
  handle('drivingSession:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { learnerId?: string; instructorId?: string; date?: string; status?: string }
    return listDrivingSessions(payload)
  })

  handle('drivingSession:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateDrivingSessionSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createDrivingSession(parsed.data)
  })

  handle('drivingSession:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateDrivingSessionSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateDrivingSession(parsed.data)
  })

  handle('drivingSession:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = GenerateDrivingSessionInvoiceSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return generateDrivingSessionInvoice(parsed.data.id)
  })

  // ── Tests ──────────────────────────────────────────────────────────────────
  handle('drivingSession:listTests', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { learnerId?: string; testType?: string; result?: string }
    return listDrivingTests(payload)
  })

  handle('drivingSession:createTest', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateDrivingTestSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createDrivingTest(parsed.data)
  })

  handle('drivingSession:updateTest', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateDrivingTestSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateDrivingTest(parsed.data)
  })

  // ── Packages (Phase 41) ─────────────────────────────────────────────────────
  handle('drivingPackage:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { isActive?: boolean }
    return listDrivingPackages(payload.isActive)
  })

  handle('drivingPackage:create', async (raw) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const parsed = CreateDrivingPackageSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createDrivingPackage(parsed.data)
  })

  handle('drivingPackage:update', async (raw) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const parsed = UpdateDrivingPackageSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateDrivingPackage(parsed.data)
  })

  handle('drivingPackage:delete', async (raw) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const parsed = DeleteDrivingPackageSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteDrivingPackage(parsed.data.id)
  })

  handle('drivingPackageEnrollment:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { learnerId?: string }
    return listDrivingPackageEnrollments(payload.learnerId)
  })

  handle('drivingPackageEnrollment:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateDrivingPackageEnrollmentSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createDrivingPackageEnrollment(parsed.data)
  })

  handle('drivingPackageEnrollment:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = DeleteDrivingPackageEnrollmentSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteDrivingPackageEnrollment(parsed.data.id)
  })

  handle('drivingPackageEnrollment:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = GenerateDrivingPackageInvoiceSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return generateDrivingPackageInvoice(parsed.data.id)
  })
}
