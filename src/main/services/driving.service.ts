import { getPrisma } from '../database/db'
import { billingService } from './billing.service'

// DrivingSession.sessionFee and DrivingPackage.price/DrivingPackageEnrollment
// are Prisma Decimal fields — Electron's IPC (structured clone) cannot
// serialize a Decimal instance and throws "An object could not be cloned"
// on every response that includes one.
function serializeSession<T extends { sessionFee: unknown }>(s: T): T {
  return { ...s, sessionFee: s.sessionFee == null ? null : Number(s.sessionFee) }
}
function serializePackage<T extends { price: unknown }>(p: T): T {
  return { ...p, price: Number(p.price) }
}

// ── LearnerProfile ────────────────────────────────────────────────────────────

export async function getLearnerProfile(customerId: string) {
  try {
    const db = getPrisma()
    const profile = await db.learnerProfile.findUnique({
      where: { customerId },
      include: { customer: { select: { id: true, customerName: true, phone: true, email: true } } },
    })
    return { success: true, data: profile }
  } catch (err) {
    return { success: false, error: { code: 'LP27-001', message: err instanceof Error ? err.message : 'Could not get learner profile.' } }
  }
}

export async function upsertLearnerProfile(payload: {
  customerId: string
  dlApplicationNumber?: string | null
  learnerLicenseNumber?: string | null
  learnerLicenseDate?: string | null
  permanentLicenseNumber?: string | null
  permanentLicenseDate?: string | null
  licenseClass?: string
  vehicleClassPreference?: string | null
}) {
  try {
    const db = getPrisma()
    const { customerId, learnerLicenseDate, permanentLicenseDate, ...rest } = payload
    const data = {
      ...rest,
      ...(learnerLicenseDate !== undefined ? { learnerLicenseDate: learnerLicenseDate ? new Date(learnerLicenseDate) : null } : {}),
      ...(permanentLicenseDate !== undefined ? { permanentLicenseDate: permanentLicenseDate ? new Date(permanentLicenseDate) : null } : {}),
    }
    const profile = await db.learnerProfile.upsert({
      where: { customerId },
      create: { customerId, ...data },
      update: data,
      include: { customer: { select: { id: true, customerName: true, phone: true, email: true } } },
    })
    return { success: true, data: profile }
  } catch (err) {
    return { success: false, error: { code: 'LP27-002', message: err instanceof Error ? err.message : 'Could not save learner profile.' } }
  }
}

// ── DrivingVehicle ────────────────────────────────────────────────────────────

// Phase 58 §2 — Driving School: "due for service" derived from real usage
// (session count and/or odometer), not a fixed calendar reminder.
function withMaintenanceStatus<T extends {
  sessionsSinceService: number
  serviceIntervalSessions: number
  odometerKm: number
  lastServiceOdometerKm: number
  serviceIntervalKm: number
}>(vehicle: T): T & { dueForService: boolean } {
  const dueForService =
    vehicle.sessionsSinceService >= vehicle.serviceIntervalSessions ||
    vehicle.odometerKm - vehicle.lastServiceOdometerKm >= vehicle.serviceIntervalKm
  return { ...vehicle, dueForService }
}

export async function listDrivingVehicles(status?: string) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (status) where.status = status

    const vehicles = await db.drivingVehicle.findMany({
      where,
      include: { instructor: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return { success: true, data: vehicles.map(withMaintenanceStatus) }
  } catch (err) {
    return { success: false, error: { code: 'DV27-001', message: err instanceof Error ? err.message : 'Could not list vehicles.' } }
  }
}

export async function createDrivingVehicle(payload: {
  registrationNumber: string
  make: string
  model: string
  vehicleClass: string
  instructorId?: string
  status?: string
  odometerKm?: number
  serviceIntervalKm?: number
  serviceIntervalSessions?: number
}) {
  try {
    const db = getPrisma()
    const vehicle = await db.drivingVehicle.create({
      data: {
        registrationNumber: payload.registrationNumber.toUpperCase(),
        make: payload.make,
        model: payload.model,
        vehicleClass: payload.vehicleClass,
        instructorId: payload.instructorId ?? null,
        status: payload.status ?? 'ACTIVE',
        odometerKm: payload.odometerKm ?? 0,
        lastServiceOdometerKm: payload.odometerKm ?? 0,
        serviceIntervalKm: payload.serviceIntervalKm ?? 5000,
        serviceIntervalSessions: payload.serviceIntervalSessions ?? 30,
      },
    })
    await db.auditLog.create({ data: { action: 'CREATE', entityType: 'DrivingVehicle', entityId: vehicle.id, newValue: JSON.stringify({ registrationNumber: vehicle.registrationNumber }) } }).catch(() => {})
    return { success: true, data: withMaintenanceStatus(vehicle) }
  } catch (err) {
    return { success: false, error: { code: 'DV27-002', message: err instanceof Error ? err.message : 'Could not create vehicle.' } }
  }
}

export async function updateDrivingVehicle(payload: {
  id: string
  registrationNumber?: string
  make?: string
  model?: string
  vehicleClass?: string
  instructorId?: string | null
  status?: string
  odometerKm?: number
  serviceIntervalKm?: number
  serviceIntervalSessions?: number
}) {
  try {
    const db = getPrisma()
    const { id, ...rest } = payload
    const vehicle = await db.drivingVehicle.update({ where: { id }, data: rest })
    await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'DrivingVehicle', entityId: vehicle.id } }).catch(() => {})
    return { success: true, data: withMaintenanceStatus(vehicle) }
  } catch (err) {
    return { success: false, error: { code: 'DV27-003', message: err instanceof Error ? err.message : 'Could not update vehicle.' } }
  }
}

// Phase 58 §2 — Driving School: log a real service event. Updates the
// vehicle's aggregate fields (lastServiceOdometerKm/lastServiceDate,
// resets sessionsSinceService to 0) while keeping the log row as the
// permanent, append-only history — same "ledger alongside the aggregate"
// pattern used elsewhere this phase.
export async function logVehicleMaintenance(payload: {
  vehicleId: string
  serviceDate?: string
  odometerKm: number
  serviceType: string
  cost?: number
  notes?: string
}) {
  try {
    if (payload.odometerKm < 0) return { success: false, error: { code: 'DVM58-004', message: 'Odometer reading cannot be negative.' } }
    const db = getPrisma()
    const vehicle = await db.drivingVehicle.findUnique({ where: { id: payload.vehicleId }, select: { id: true, odometerKm: true } })
    if (!vehicle) return { success: false, error: { code: 'DVM58-001', message: 'Vehicle not found.' } }

    const serviceDate = payload.serviceDate ? new Date(payload.serviceDate) : new Date()
    const [log] = await db.$transaction([
      db.drivingVehicleMaintenanceLog.create({
        data: {
          vehicleId: payload.vehicleId,
          serviceDate,
          odometerKm: payload.odometerKm,
          serviceType: payload.serviceType,
          cost: payload.cost ?? null,
          notes: payload.notes ?? null,
        },
      }),
      db.drivingVehicle.update({
        where: { id: payload.vehicleId },
        data: {
          lastServiceOdometerKm: payload.odometerKm,
          lastServiceDate: serviceDate,
          sessionsSinceService: 0,
          odometerKm: Math.max(payload.odometerKm, vehicle.odometerKm),
        },
      }),
    ])
    await db.auditLog.create({ data: { action: 'CREATE', entityType: 'DrivingVehicleMaintenanceLog', entityId: log.id, newValue: JSON.stringify({ vehicleId: payload.vehicleId, serviceType: payload.serviceType }) } }).catch(() => {})
    return { success: true, data: { ...log, cost: log.cost == null ? null : Number(log.cost) } }
  } catch (err) {
    return { success: false, error: { code: 'DVM58-002', message: err instanceof Error ? err.message : 'Could not log maintenance.' } }
  }
}

export async function listVehicleMaintenanceLogs(vehicleId: string) {
  try {
    const db = getPrisma()
    const logs = await db.drivingVehicleMaintenanceLog.findMany({
      where: { vehicleId },
      orderBy: { serviceDate: 'desc' },
    })
    return { success: true, data: logs.map((l) => ({ ...l, cost: l.cost == null ? null : Number(l.cost) })) }
  } catch (err) {
    return { success: false, error: { code: 'DVM58-003', message: err instanceof Error ? err.message : 'Could not list maintenance logs.' } }
  }
}

export async function deleteDrivingVehicle(id: string) {
  try {
    const db = getPrisma()
    const inUse = await db.drivingSession.count({ where: { vehicleId: id, status: { in: ['SCHEDULED', 'COMPLETED'] } } })
    if (inUse > 0) return { success: false, error: { code: 'DV27-IN-USE', message: 'Vehicle has sessions recorded and cannot be deleted. Mark it as Retired instead.' } }
    await db.drivingVehicle.delete({ where: { id } })
    await db.auditLog.create({ data: { action: 'DELETE', entityType: 'DrivingVehicle', entityId: id } }).catch(() => {})
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'DV27-004', message: err instanceof Error ? err.message : 'Could not delete vehicle.' } }
  }
}

// ── DrivingSession ────────────────────────────────────────────────────────────

export async function listDrivingSessions(filters?: {
  learnerId?: string
  instructorId?: string
  date?: string
  status?: string
}) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.learnerId) where.learnerId = filters.learnerId
    if (filters?.instructorId) where.instructorId = filters.instructorId
    if (filters?.status) where.status = filters.status
    if (filters?.date) {
      const d = new Date(filters.date)
      const next = new Date(d)
      next.setDate(next.getDate() + 1)
      where.sessionDate = { gte: d, lt: next }
    }

    const sessions = await db.drivingSession.findMany({
      where,
      include: {
        learner: { select: { id: true, customerName: true, phone: true } },
        instructor: { select: { id: true, fullName: true } },
        vehicle: { select: { id: true, registrationNumber: true, make: true, model: true } },
      },
      orderBy: [{ sessionDate: 'desc' }, { sessionTime: 'asc' }],
    })
    return { success: true, data: sessions.map(serializeSession) }
  } catch (err) {
    return { success: false, error: { code: 'DS27-001', message: err instanceof Error ? err.message : 'Could not list sessions.' } }
  }
}

export async function createDrivingSession(payload: {
  learnerId: string
  instructorId: string
  vehicleId: string
  sessionDate: string
  sessionTime: string
  durationMinutes?: number
  pickupPoint?: string
  sessionNumber?: number
  sessionFee?: number
  packageEnrollmentId?: string
}) {
  try {
    const db = getPrisma()

    if (payload.sessionFee != null && payload.sessionFee < 0) {
      return { success: false, error: { code: 'DS27-006', message: 'Session fee cannot be negative.' } }
    }

    // Auto-compute session number for this learner. A count()-based scheme
    // reissues an existing number the moment any session for this learner
    // is deleted out of sequence; findFirst + increment on the highest
    // existing number doesn't have that failure mode.
    const lastSession = await db.drivingSession.findFirst({
      where: { learnerId: payload.learnerId },
      orderBy: { sessionNumber: 'desc' },
      select: { sessionNumber: true },
    })

    const session = await db.drivingSession.create({
      data: {
        learnerId: payload.learnerId,
        instructorId: payload.instructorId,
        vehicleId: payload.vehicleId,
        sessionDate: new Date(payload.sessionDate),
        sessionTime: payload.sessionTime,
        durationMinutes: payload.durationMinutes ?? 60,
        pickupPoint: payload.pickupPoint ?? null,
        sessionNumber: payload.sessionNumber ?? (lastSession?.sessionNumber ?? 0) + 1,
        status: 'SCHEDULED',
        sessionFee: payload.sessionFee ?? null,
        packageEnrollmentId: payload.packageEnrollmentId ?? null,
      },
      include: {
        learner: { select: { id: true, customerName: true } },
        instructor: { select: { id: true, fullName: true } },
        vehicle: { select: { id: true, registrationNumber: true } },
      },
    })
    if (session.packageEnrollmentId) {
      await db.drivingPackageEnrollment.update({ where: { id: session.packageEnrollmentId }, data: { sessionsUsed: { increment: 1 } } }).catch(() => {})
    }
    await db.auditLog.create({ data: { action: 'CREATE', entityType: 'DrivingSession', entityId: session.id, newValue: JSON.stringify({ learnerId: session.learnerId, sessionDate: session.sessionDate }) } }).catch(() => {})
    return { success: true, data: serializeSession(session) }
  } catch (err) {
    return { success: false, error: { code: 'DS27-002', message: err instanceof Error ? err.message : 'Could not create session.' } }
  }
}

export async function updateDrivingSession(payload: {
  id: string
  status?: string
  instructorNotes?: string
  sessionDate?: string
  sessionTime?: string
  durationMinutes?: number
  pickupPoint?: string | null
  sessionFee?: number | null
}) {
  try {
    if (payload.sessionFee != null && payload.sessionFee < 0) {
      return { success: false, error: { code: 'DS27-006', message: 'Session fee cannot be negative.' } }
    }
    const db = getPrisma()
    const { id, sessionDate, ...rest } = payload

    // Phase 58 §2 — Driving School: maintenance scheduling is tied to real
    // vehicle usage, so a session only counts once it's actually COMPLETED
    // (not on every edit, and not twice if saved again after completion).
    const existing = payload.status === 'COMPLETED'
      ? await db.drivingSession.findUnique({ where: { id }, select: { status: true, vehicleId: true } })
      : null

    const session = await db.drivingSession.update({
      where: { id },
      data: {
        ...rest,
        ...(sessionDate !== undefined ? { sessionDate: new Date(sessionDate) } : {}),
      },
    })

    if (existing && existing.status !== 'COMPLETED') {
      await db.drivingVehicle.update({ where: { id: existing.vehicleId }, data: { sessionsSinceService: { increment: 1 } } }).catch(() => {})
    }

    await db.auditLog.create({ data: { action: payload.status === 'COMPLETED' ? 'COMPLETED' : payload.status === 'CANCELLED' ? 'CANCELLED' : 'UPDATE', entityType: 'DrivingSession', entityId: session.id } }).catch(() => {})
    return { success: true, data: serializeSession(session) }
  } catch (err) {
    return { success: false, error: { code: 'DS27-003', message: err instanceof Error ? err.message : 'Could not update session.' } }
  }
}

// Phase 41: closes a dormant invoiceId stub with no pricing field at all
// before this phase — DrivingSession had zero financial data. Ad-hoc,
// non-package sessions are billed per-session via sessionFee; sessions
// redeemed against a DrivingPackageEnrollment are blocked here (that
// package purchase is the real revenue event — see generateDrivingPackageInvoice).
const DRIVING_SESSION_CLAIM_SENTINEL = 'PENDING_INVOICE_GENERATION'

export async function generateDrivingSessionInvoice(sessionId: string) {
  const db = getPrisma()
  try {
    const claim = await db.drivingSession.updateMany({
      where: { id: sessionId, invoiceId: null },
      data: { invoiceId: DRIVING_SESSION_CLAIM_SENTINEL },
    })
    if (claim.count === 0) {
      const existing = await db.drivingSession.findUnique({ where: { id: sessionId }, select: { id: true } })
      if (!existing) return { success: false, error: { code: 'DS27-007', message: 'Driving session not found.' } }
      return { success: false, error: { code: 'DS27-008', message: 'Invoice already generated for this session.' } }
    }

    try {
      const session = await db.drivingSession.findUnique({ where: { id: sessionId } })
      if (!session) {
        await db.drivingSession.update({ where: { id: sessionId }, data: { invoiceId: null } })
        return { success: false, error: { code: 'DS27-007', message: 'Driving session not found.' } }
      }
      if (session.packageEnrollmentId) {
        await db.drivingSession.update({ where: { id: sessionId }, data: { invoiceId: null } })
        return { success: false, error: { code: 'DS27-009', message: 'This session was redeemed against a package — invoice the package purchase instead.' } }
      }
      if (session.sessionFee == null || Number(session.sessionFee) <= 0) {
        await db.drivingSession.update({ where: { id: sessionId }, data: { invoiceId: null } })
        return { success: false, error: { code: 'DS27-010', message: 'Set a session fee greater than zero before generating an invoice.' } }
      }

      let product = await db.product.findFirst({ where: { hsnCode: '999293', productName: 'Driving Lesson', isActive: true } })
      if (!product) {
        product = await db.product.create({
          data: { productName: 'Driving Lesson', productType: 'SERVICE', hsnCode: '999293', sellingPrice: 0, taxRate: 18, unit: 'NOS', isActive: true },
        })
      }

      const result = await billingService.createInvoice({
        customerId: session.learnerId,
        paymentMethod: 'CREDIT',
        gstType: 'CGST_SGST',
        items: [{ productId: product.id, quantity: 1, unitPrice: Number(session.sessionFee), taxRate: 18 }],
        notes: `Driving lesson — session #${session.sessionNumber}`,
        referenceNumber: sessionId.slice(0, 12),
      })
      if (!result.success) {
        await db.drivingSession.update({ where: { id: sessionId }, data: { invoiceId: null } })
        return result
      }

      const invoice = result.data as { id: string }
      await db.drivingSession.update({ where: { id: sessionId }, data: { invoiceId: invoice.id } })
      await db.auditLog.create({ data: { action: 'INVOICED', entityType: 'DrivingSession', entityId: sessionId, newValue: JSON.stringify({ invoiceId: invoice.id }) } }).catch(() => {})

      return { success: true, data: { invoiceId: invoice.id } }
    } catch (err) {
      await db.drivingSession.update({ where: { id: sessionId }, data: { invoiceId: null } }).catch(() => {})
      throw err
    }
  } catch (err) {
    return { success: false, error: { code: 'DS27-011', message: err instanceof Error ? err.message : 'Could not generate driving session invoice.' } }
  }
}

// ── DrivingPackage (Phase 41: N-lesson bundle billing) ─────────────────────────

export async function listDrivingPackages(isActive?: boolean) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (isActive !== undefined) where.isActive = isActive
    const packages = await db.drivingPackage.findMany({ where, orderBy: { packageName: 'asc' } })
    return { success: true, data: packages.map(serializePackage) }
  } catch (err) {
    return { success: false, error: { code: 'DP41-001', message: err instanceof Error ? err.message : 'Could not list packages.' } }
  }
}

export async function createDrivingPackage(payload: {
  packageName: string
  totalSessions: number
  price: number
  vehicleClass?: string
  isActive?: boolean
}) {
  try {
    if (payload.price < 0) return { success: false, error: { code: 'DP41-005', message: 'Package price cannot be negative.' } }
    const db = getPrisma()
    const pkg = await db.drivingPackage.create({
      data: {
        packageName: payload.packageName,
        totalSessions: payload.totalSessions,
        price: payload.price,
        vehicleClass: payload.vehicleClass ?? 'LMV',
        isActive: payload.isActive ?? true,
      },
    })
    await db.auditLog.create({ data: { action: 'CREATE', entityType: 'DrivingPackage', entityId: pkg.id, newValue: JSON.stringify({ packageName: pkg.packageName }) } }).catch(() => {})
    return { success: true, data: serializePackage(pkg) }
  } catch (err) {
    return { success: false, error: { code: 'DP41-002', message: err instanceof Error ? err.message : 'Could not create package.' } }
  }
}

export async function updateDrivingPackage(payload: {
  id: string
  packageName?: string
  totalSessions?: number
  price?: number
  vehicleClass?: string
  isActive?: boolean
}) {
  try {
    if (payload.price != null && payload.price < 0) return { success: false, error: { code: 'DP41-005', message: 'Package price cannot be negative.' } }
    const db = getPrisma()
    const { id, ...rest } = payload
    const pkg = await db.drivingPackage.update({ where: { id }, data: rest })
    await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'DrivingPackage', entityId: pkg.id } }).catch(() => {})
    return { success: true, data: serializePackage(pkg) }
  } catch (err) {
    return { success: false, error: { code: 'DP41-003', message: err instanceof Error ? err.message : 'Could not update package.' } }
  }
}

export async function deleteDrivingPackage(id: string) {
  try {
    const db = getPrisma()
    const inUse = await db.drivingPackageEnrollment.count({ where: { packageId: id } })
    if (inUse > 0) return { success: false, error: { code: 'DP41-IN-USE', message: 'Package has enrollments and cannot be deleted. Mark it inactive instead.' } }
    await db.drivingPackage.delete({ where: { id } })
    await db.auditLog.create({ data: { action: 'DELETE', entityType: 'DrivingPackage', entityId: id } }).catch(() => {})
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'DP41-004', message: err instanceof Error ? err.message : 'Could not delete package.' } }
  }
}

// ── DrivingPackageEnrollment ────────────────────────────────────────────────

export async function listDrivingPackageEnrollments(learnerId?: string) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (learnerId) where.learnerId = learnerId
    const enrollments = await db.drivingPackageEnrollment.findMany({
      where,
      include: {
        learner: { select: { id: true, customerName: true, phone: true } },
        package: true,
        _count: { select: { sessions: true } },
      },
      orderBy: { purchaseDate: 'desc' },
    })
    return { success: true, data: enrollments.map((e) => ({ ...e, package: serializePackage(e.package) })) }
  } catch (err) {
    return { success: false, error: { code: 'DPE41-001', message: err instanceof Error ? err.message : 'Could not list enrollments.' } }
  }
}

export async function createDrivingPackageEnrollment(payload: {
  learnerId: string
  packageId: string
  purchaseDate?: string
  notes?: string
}) {
  try {
    const db = getPrisma()
    const enrollment = await db.drivingPackageEnrollment.create({
      data: {
        learnerId: payload.learnerId,
        packageId: payload.packageId,
        purchaseDate: payload.purchaseDate ? new Date(payload.purchaseDate) : new Date(),
        notes: payload.notes ?? null,
      },
      include: { learner: { select: { id: true, customerName: true } }, package: true },
    })
    await db.auditLog.create({ data: { action: 'CREATE', entityType: 'DrivingPackageEnrollment', entityId: enrollment.id, newValue: JSON.stringify({ learnerId: enrollment.learnerId, packageId: enrollment.packageId }) } }).catch(() => {})
    return { success: true, data: { ...enrollment, package: serializePackage(enrollment.package) } }
  } catch (err) {
    return { success: false, error: { code: 'DPE41-002', message: err instanceof Error ? err.message : 'Could not create enrollment.' } }
  }
}

export async function deleteDrivingPackageEnrollment(id: string) {
  try {
    const db = getPrisma()
    const enrollment = await db.drivingPackageEnrollment.findUnique({ where: { id }, select: { invoiceId: true } })
    if (enrollment?.invoiceId) {
      return { success: false, error: { code: 'DPE41-IN-USE', message: 'Cannot delete an enrollment that has an associated invoice.' } }
    }
    await db.drivingPackageEnrollment.delete({ where: { id } })
    await db.auditLog.create({ data: { action: 'DELETE', entityType: 'DrivingPackageEnrollment', entityId: id } }).catch(() => {})
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'DPE41-003', message: err instanceof Error ? err.message : 'Could not delete enrollment.' } }
  }
}

const DRIVING_PACKAGE_CLAIM_SENTINEL = 'PENDING_INVOICE_GENERATION'

export async function generateDrivingPackageInvoice(enrollmentId: string) {
  const db = getPrisma()
  try {
    const claim = await db.drivingPackageEnrollment.updateMany({
      where: { id: enrollmentId, invoiceId: null },
      data: { invoiceId: DRIVING_PACKAGE_CLAIM_SENTINEL },
    })
    if (claim.count === 0) {
      const existing = await db.drivingPackageEnrollment.findUnique({ where: { id: enrollmentId }, select: { id: true } })
      if (!existing) return { success: false, error: { code: 'DPE41-004', message: 'Enrollment not found.' } }
      return { success: false, error: { code: 'DPE41-005', message: 'Invoice already generated for this enrollment.' } }
    }

    try {
      const enrollment = await db.drivingPackageEnrollment.findUnique({
        where: { id: enrollmentId },
        include: { package: true },
      })
      if (!enrollment || Number(enrollment.package.price) <= 0) {
        await db.drivingPackageEnrollment.update({ where: { id: enrollmentId }, data: { invoiceId: null } })
        return { success: false, error: { code: 'DPE41-006', message: 'This package has no price set — set a package price greater than zero before generating an invoice.' } }
      }

      let product = await db.product.findFirst({ where: { hsnCode: '999293', productName: enrollment.package.packageName, isActive: true } })
      if (!product) {
        product = await db.product.create({
          data: { productName: enrollment.package.packageName, productType: 'SERVICE', hsnCode: '999293', sellingPrice: 0, taxRate: 18, unit: 'NOS', isActive: true },
        })
      }

      const result = await billingService.createInvoice({
        customerId: enrollment.learnerId,
        paymentMethod: 'CREDIT',
        gstType: 'CGST_SGST',
        items: [{ productId: product.id, quantity: 1, unitPrice: Number(enrollment.package.price), taxRate: 18 }],
        notes: `Driving package: ${enrollment.package.packageName} (${enrollment.package.totalSessions} sessions)`,
        referenceNumber: enrollmentId.slice(0, 12),
      })
      if (!result.success) {
        await db.drivingPackageEnrollment.update({ where: { id: enrollmentId }, data: { invoiceId: null } })
        return result
      }

      const invoice = result.data as { id: string }
      await db.drivingPackageEnrollment.update({ where: { id: enrollmentId }, data: { invoiceId: invoice.id } })
      await db.auditLog.create({ data: { action: 'INVOICED', entityType: 'DrivingPackageEnrollment', entityId: enrollmentId, newValue: JSON.stringify({ invoiceId: invoice.id }) } }).catch(() => {})

      return { success: true, data: { invoiceId: invoice.id } }
    } catch (err) {
      await db.drivingPackageEnrollment.update({ where: { id: enrollmentId }, data: { invoiceId: null } }).catch(() => {})
      throw err
    }
  } catch (err) {
    return { success: false, error: { code: 'DPE41-007', message: err instanceof Error ? err.message : 'Could not generate package invoice.' } }
  }
}

// ── DrivingTest ────────────────────────────────────────────────────────────────

export async function listDrivingTests(filters?: { learnerId?: string; testType?: string; result?: string; instructorId?: string }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.learnerId) where.learnerId = filters.learnerId
    if (filters?.testType) where.testType = filters.testType
    if (filters?.result) where.result = filters.result
    if (filters?.instructorId) where.instructorId = filters.instructorId

    const tests = await db.drivingTest.findMany({
      where,
      include: {
        learner: { select: { id: true, customerName: true, phone: true } },
        instructor: { select: { id: true, fullName: true } },
      },
      orderBy: { testDate: 'desc' },
    })
    return { success: true, data: tests }
  } catch (err) {
    return { success: false, error: { code: 'DT27-001', message: err instanceof Error ? err.message : 'Could not list tests.' } }
  }
}

// Phase 58 §2 — Driving School: per-instructor pass/fail counts, so
// "pass-rate by instructor" is a real queryable fact once DrivingTest is
// linked to who taught the learner.
export async function getInstructorPassRates() {
  try {
    const db = getPrisma()
    const tests = await db.drivingTest.findMany({
      where: { instructorId: { not: null }, result: { in: ['PASSED', 'FAILED'] } },
      select: { instructorId: true, result: true, instructor: { select: { id: true, fullName: true } } },
    })
    const byInstructor = new Map<string, { instructorId: string; instructorName: string; passed: number; failed: number }>()
    for (const t of tests) {
      if (!t.instructorId || !t.instructor) continue
      const row = byInstructor.get(t.instructorId) ?? { instructorId: t.instructorId, instructorName: t.instructor.fullName, passed: 0, failed: 0 }
      if (t.result === 'PASSED') row.passed++
      else row.failed++
      byInstructor.set(t.instructorId, row)
    }
    const data = Array.from(byInstructor.values())
      .map((r) => ({ ...r, total: r.passed + r.failed, passRate: r.passed + r.failed > 0 ? Math.round((r.passed / (r.passed + r.failed)) * 100) : 0 }))
      .sort((a, b) => b.total - a.total)
    return { success: true, data }
  } catch (err) {
    return { success: false, error: { code: 'DT27-004', message: err instanceof Error ? err.message : 'Could not compute instructor pass rates.' } }
  }
}

export async function createDrivingTest(payload: {
  learnerId: string
  testType: string
  testDate: string
  testCenter: string
  notes?: string
  instructorId?: string
}) {
  try {
    const db = getPrisma()
    const test = await db.drivingTest.create({
      data: {
        learnerId: payload.learnerId,
        testType: payload.testType,
        testDate: new Date(payload.testDate),
        testCenter: payload.testCenter,
        notes: payload.notes ?? null,
        instructorId: payload.instructorId ?? null,
        result: 'PENDING',
      },
      include: { instructor: { select: { id: true, fullName: true } } },
    })
    await db.auditLog.create({ data: { action: 'CREATE', entityType: 'DrivingTest', entityId: test.id, newValue: JSON.stringify({ testType: test.testType }) } }).catch(() => {})
    return { success: true, data: test }
  } catch (err) {
    return { success: false, error: { code: 'DT27-002', message: err instanceof Error ? err.message : 'Could not create test.' } }
  }
}

export async function updateDrivingTest(payload: {
  id: string
  result?: string
  retestDate?: string | null
  notes?: string | null
  instructorId?: string | null
}) {
  try {
    const db = getPrisma()
    const { id, retestDate, ...rest } = payload
    const test = await db.drivingTest.update({
      where: { id },
      data: {
        ...rest,
        ...(retestDate !== undefined ? { retestDate: retestDate ? new Date(retestDate) : null } : {}),
      },
      include: { instructor: { select: { id: true, fullName: true } } },
    })
    await db.auditLog.create({ data: { action: payload.result === 'PASSED' ? 'PASSED' : payload.result === 'FAILED' ? 'FAILED' : 'UPDATE', entityType: 'DrivingTest', entityId: test.id } }).catch(() => {})
    return { success: true, data: test }
  } catch (err) {
    return { success: false, error: { code: 'DT27-003', message: err instanceof Error ? err.message : 'Could not update test.' } }
  }
}
