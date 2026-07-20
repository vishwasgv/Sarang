import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import {
  createDrivingSession,
  updateDrivingSession,
  generateDrivingSessionInvoice,
  createDrivingPackage,
  updateDrivingPackage,
  deleteDrivingPackage,
  deleteDrivingPackageEnrollment,
  generateDrivingPackageInvoice,
  listDrivingVehicles,
  logVehicleMaintenance,
  createDrivingTest,
  getInstructorPassRates,
} from '../driving.service'

// Regression coverage for the Phase 27 re-audit finding: createDrivingSession
// computed sessionNumber via db.drivingSession.count() — the same
// numbering-collision pattern already fixed elsewhere in this project (a
// count()-based scheme reissues an existing number the moment any session
// for that learner is deleted out of sequence). Fixed with the established
// findFirst({orderBy: desc}) + increment pattern instead.

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1', learnerId: 'learner-1', instructorId: 'instr-1', vehicleId: 'veh-1',
    sessionDate: new Date(), sessionTime: '09:00', durationMinutes: 60, pickupPoint: null,
    sessionNumber: 1, status: 'SCHEDULED', instructorNotes: null, invoiceId: null,
    createdAt: new Date(), updatedAt: new Date(),
    learner: { id: 'learner-1', customerName: 'Test Learner' },
    instructor: { id: 'instr-1', fullName: 'Test Instructor' },
    vehicle: { id: 'veh-1', registrationNumber: 'KA01AB1234' },
    ...overrides,
  }
}

function makeMockDb(lastSessionNumber: number | null) {
  const db: Record<string, any> = {
    drivingSession: {
      findFirst: vi.fn().mockResolvedValue(lastSessionNumber != null ? { sessionNumber: lastSessionNumber } : null),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeSession({ ...data }))
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('driving.service — session numbering', () => {
  beforeEach(() => vi.clearAllMocks())

  it('assigns session number 1 for a learner with no prior sessions', async () => {
    const db = makeMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createDrivingSession({ learnerId: 'learner-1', instructorId: 'instr-1', vehicleId: 'veh-1', sessionDate: '2026-07-01', sessionTime: '09:00' })

    expect(res.success).toBe(true)
    expect((res as { data: { sessionNumber: number } }).data.sessionNumber).toBe(1)
  })

  it('increments from the highest existing session number, not a row count', async () => {
    // A learner with sessions numbered up to 5, even if some were deleted
    // out of sequence (so a count() would undercount) — findFirst-by-max
    // still assigns 6, never reissuing an existing number.
    const db = makeMockDb(5)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createDrivingSession({ learnerId: 'learner-1', instructorId: 'instr-1', vehicleId: 'veh-1', sessionDate: '2026-07-01', sessionTime: '09:00' })

    expect(res.success).toBe(true)
    expect((res as { data: { sessionNumber: number } }).data.sessionNumber).toBe(6)
    expect(db.drivingSession.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { sessionNumber: 'desc' } })
    )
  })

  it('respects an explicitly supplied sessionNumber instead of auto-computing', async () => {
    const db = makeMockDb(5)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createDrivingSession({ learnerId: 'learner-1', instructorId: 'instr-1', vehicleId: 'veh-1', sessionDate: '2026-07-01', sessionTime: '09:00', sessionNumber: 99 })

    expect(res.success).toBe(true)
    expect((res as { data: { sessionNumber: number } }).data.sessionNumber).toBe(99)
  })

  it('rejects a negative sessionFee', async () => {
    const db = makeMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createDrivingSession({ learnerId: 'learner-1', instructorId: 'instr-1', vehicleId: 'veh-1', sessionDate: '2026-07-01', sessionTime: '09:00', sessionFee: -100 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DS27-006')
    expect(db.drivingSession.create).not.toHaveBeenCalled()
  })

  it('increments the package enrollment sessionsUsed when a session redeems a package', async () => {
    const db = makeMockDb(null) as any
    db.drivingPackageEnrollment = { update: vi.fn().mockResolvedValue({}) }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createDrivingSession({ learnerId: 'learner-1', instructorId: 'instr-1', vehicleId: 'veh-1', sessionDate: '2026-07-01', sessionTime: '09:00', packageEnrollmentId: 'enr-1' })

    expect(res.success).toBe(true)
    expect(db.drivingPackageEnrollment.update).toHaveBeenCalledWith({ where: { id: 'enr-1' }, data: { sessionsUsed: { increment: 1 } } })
  })
})

// Phase 41 — generateDrivingSessionInvoice

function makeSessionForInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'session-1', learnerId: 'learner-1', sessionNumber: 3,
    sessionFee: 500, packageEnrollmentId: null, invoiceId: null,
    ...overrides,
  }
}

function makeSessionInvoiceMockDb(session: ReturnType<typeof makeSessionForInvoice> | null) {
  const canClaim = !!session && !session.invoiceId
  return {
    drivingSession: {
      updateMany: vi.fn().mockResolvedValue({ count: canClaim ? 1 : 0 }),
      findUnique: vi.fn().mockResolvedValue(session),
      update: vi.fn().mockResolvedValue({}),
    },
    product: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'product-1', hsnCode: '999293' }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
}

describe('driving.service — generateDrivingSessionInvoice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing session', async () => {
    const db = makeSessionInvoiceMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateDrivingSessionInvoice('session-missing')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DS27-007')
  })

  it('rejects a session that already has an invoice', async () => {
    const db = makeSessionInvoiceMockDb(makeSessionForInvoice({ invoiceId: 'invoice-existing' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateDrivingSessionInvoice('session-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DS27-008')
  })

  it('rejects a session redeemed against a package', async () => {
    const db = makeSessionInvoiceMockDb(makeSessionForInvoice({ packageEnrollmentId: 'enr-1' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateDrivingSessionInvoice('session-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DS27-009')
  })

  it('rejects a session with no fee set', async () => {
    const db = makeSessionInvoiceMockDb(makeSessionForInvoice({ sessionFee: null }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateDrivingSessionInvoice('session-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DS27-010')
  })

  it('generates an invoice using the correct SAC code (999293, not a fabricated one)', async () => {
    const db = makeSessionInvoiceMockDb(makeSessionForInvoice())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-1' } } as never)

    const res = await generateDrivingSessionInvoice('session-1')

    expect(res.success).toBe(true)
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'learner-1',
      items: [expect.objectContaining({ productId: 'product-1', unitPrice: 500, taxRate: 18 })],
    }))
    expect(db.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ hsnCode: '999293' }) }))
    expect(db.drivingSession.update).toHaveBeenCalledWith({ where: { id: 'session-1' }, data: { invoiceId: 'invoice-1' } })
  })

  it('propagates a billing failure without linking an invoice, and releases the claim', async () => {
    const db = makeSessionInvoiceMockDb(makeSessionForInvoice())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'BILL-001', message: 'failed' } } as never)

    const res = await generateDrivingSessionInvoice('session-1')

    expect(res.success).toBe(false)
    expect(db.drivingSession.update).toHaveBeenCalledWith({ where: { id: 'session-1' }, data: { invoiceId: null } })
  })
})

// Phase 41 — DrivingPackage / DrivingPackageEnrollment

describe('driving.service — DrivingPackage CRUD', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a negative package price on create', async () => {
    const db = { drivingPackage: { create: vi.fn() }, auditLog: { create: vi.fn() } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createDrivingPackage({ packageName: 'Test', totalSessions: 5, price: -100 })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DP41-005')
    expect(db.drivingPackage.create).not.toHaveBeenCalled()
  })

  it('rejects a negative package price on update', async () => {
    const db = { drivingPackage: { update: vi.fn() }, auditLog: { create: vi.fn() } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateDrivingPackage({ id: 'pkg-1', price: -50 })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DP41-005')
    expect(db.drivingPackage.update).not.toHaveBeenCalled()
  })

  it('blocks deleting a package with existing enrollments', async () => {
    const db = { drivingPackageEnrollment: { count: vi.fn().mockResolvedValue(2) }, drivingPackage: { delete: vi.fn() } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deleteDrivingPackage('pkg-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DP41-IN-USE')
    expect(db.drivingPackage.delete).not.toHaveBeenCalled()
  })

  it('allows deleting a package with no enrollments', async () => {
    const db = { drivingPackageEnrollment: { count: vi.fn().mockResolvedValue(0) }, drivingPackage: { delete: vi.fn().mockResolvedValue({}) }, auditLog: { create: vi.fn().mockResolvedValue({}) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deleteDrivingPackage('pkg-1')
    expect(res.success).toBe(true)
    expect(db.drivingPackage.delete).toHaveBeenCalledWith({ where: { id: 'pkg-1' } })
  })
})

describe('driving.service — deleteDrivingPackageEnrollment invoice guard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('blocks deleting an enrollment that already has an invoice', async () => {
    const db = { drivingPackageEnrollment: { findUnique: vi.fn().mockResolvedValue({ invoiceId: 'invoice-1' }), delete: vi.fn() } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deleteDrivingPackageEnrollment('enr-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DPE41-IN-USE')
    expect(db.drivingPackageEnrollment.delete).not.toHaveBeenCalled()
  })

  it('allows deleting an enrollment with no invoice', async () => {
    const db = { drivingPackageEnrollment: { findUnique: vi.fn().mockResolvedValue({ invoiceId: null }), delete: vi.fn().mockResolvedValue({}) }, auditLog: { create: vi.fn().mockResolvedValue({}) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deleteDrivingPackageEnrollment('enr-1')
    expect(res.success).toBe(true)
  })
})

function makeEnrollmentForInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'enr-1', learnerId: 'learner-1', invoiceId: null,
    package: { id: 'pkg-1', packageName: '10-Lesson Package', totalSessions: 10, price: 5000 },
    ...overrides,
  }
}

function makeEnrollmentInvoiceMockDb(enrollment: ReturnType<typeof makeEnrollmentForInvoice> | null) {
  const canClaim = !!enrollment && !enrollment.invoiceId
  return {
    drivingPackageEnrollment: {
      updateMany: vi.fn().mockResolvedValue({ count: canClaim ? 1 : 0 }),
      findUnique: vi.fn().mockResolvedValue(enrollment),
      update: vi.fn().mockResolvedValue({}),
    },
    product: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'product-1', hsnCode: '999293' }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
}

describe('driving.service — generateDrivingPackageInvoice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing enrollment', async () => {
    const db = makeEnrollmentInvoiceMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateDrivingPackageInvoice('enr-missing')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DPE41-004')
  })

  it('rejects an enrollment that already has an invoice', async () => {
    const db = makeEnrollmentInvoiceMockDb(makeEnrollmentForInvoice({ invoiceId: 'invoice-existing' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateDrivingPackageInvoice('enr-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DPE41-005')
  })

  it('rejects a package with no price set', async () => {
    const db = makeEnrollmentInvoiceMockDb(makeEnrollmentForInvoice({ package: { id: 'pkg-1', packageName: 'Free', totalSessions: 5, price: 0 } }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateDrivingPackageInvoice('enr-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DPE41-006')
  })

  it('generates an invoice for the full package price', async () => {
    const db = makeEnrollmentInvoiceMockDb(makeEnrollmentForInvoice())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-1' } } as never)

    const res = await generateDrivingPackageInvoice('enr-1')

    expect(res.success).toBe(true)
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'learner-1',
      items: [expect.objectContaining({ productId: 'product-1', unitPrice: 5000, taxRate: 18 })],
    }))
    expect(db.drivingPackageEnrollment.update).toHaveBeenCalledWith({ where: { id: 'enr-1' }, data: { invoiceId: 'invoice-1' } })
  })

  it('propagates a billing failure without linking an invoice, and releases the claim', async () => {
    const db = makeEnrollmentInvoiceMockDb(makeEnrollmentForInvoice())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'BILL-001', message: 'failed' } } as never)

    const res = await generateDrivingPackageInvoice('enr-1')

    expect(res.success).toBe(false)
    expect(db.drivingPackageEnrollment.update).toHaveBeenCalledWith({ where: { id: 'enr-1' }, data: { invoiceId: null } })
  })

  it('rejects and releases the claim when a concurrent call wins the race', async () => {
    const db = makeEnrollmentInvoiceMockDb(makeEnrollmentForInvoice())
    db.drivingPackageEnrollment.updateMany = vi.fn().mockResolvedValueOnce({ count: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateDrivingPackageInvoice('enr-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DPE41-005')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })
})

// Phase 58 §2 — Driving School: vehicle maintenance scheduling tied to real
// usage (session count + odometer), and DrivingTest.instructorId

function makeVehicle(overrides: Record<string, unknown> = {}) {
  return {
    id: 'veh-1', registrationNumber: 'KA01AB1234', make: 'Maruti', model: 'Alto', vehicleClass: 'LMV',
    instructorId: null, status: 'ACTIVE',
    odometerKm: 0, serviceIntervalKm: 5000, serviceIntervalSessions: 30,
    lastServiceOdometerKm: 0, lastServiceDate: null, sessionsSinceService: 0,
    createdAt: new Date(), updatedAt: new Date(), instructor: null,
    ...overrides,
  }
}

function makeSessionUpdateMockDb(existingSession: Record<string, unknown> | null) {
  const db: Record<string, any> = {
    drivingSession: {
      findUnique: vi.fn().mockResolvedValue(existingSession),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeSession({ ...(existingSession ?? {}), ...data }))
      ),
    },
    drivingVehicle: {
      update: vi.fn().mockResolvedValue({}),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('driving.service — sessionsSinceService counter', () => {
  beforeEach(() => vi.clearAllMocks())

  it('increments the vehicle counter when a session transitions into COMPLETED', async () => {
    const db = makeSessionUpdateMockDb({ status: 'SCHEDULED', vehicleId: 'veh-1' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateDrivingSession({ id: 'session-1', status: 'COMPLETED' })

    expect(db.drivingVehicle.update).toHaveBeenCalledWith({ where: { id: 'veh-1' }, data: { sessionsSinceService: { increment: 1 } } })
  })

  it('does not increment again if the session was already COMPLETED', async () => {
    const db = makeSessionUpdateMockDb({ status: 'COMPLETED', vehicleId: 'veh-1' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateDrivingSession({ id: 'session-1', status: 'COMPLETED' })

    expect(db.drivingVehicle.update).not.toHaveBeenCalled()
  })

  it('does not touch the vehicle counter for a non-completion update', async () => {
    const db = makeSessionUpdateMockDb({ status: 'SCHEDULED', vehicleId: 'veh-1' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateDrivingSession({ id: 'session-1', instructorNotes: 'Good progress' })

    expect(db.drivingSession.findUnique).not.toHaveBeenCalled()
    expect(db.drivingVehicle.update).not.toHaveBeenCalled()
  })
})

describe('driving.service — dueForService derivation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('flags a vehicle due for service once sessionsSinceService reaches the interval', async () => {
    const db = { drivingVehicle: { findMany: vi.fn().mockResolvedValue([makeVehicle({ sessionsSinceService: 30, serviceIntervalSessions: 30 })]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listDrivingVehicles()

    expect(res.success).toBe(true)
    expect((res as { data: Array<{ dueForService: boolean }> }).data[0].dueForService).toBe(true)
  })

  it('flags a vehicle due for service once the km driven since last service reaches the interval', async () => {
    const db = { drivingVehicle: { findMany: vi.fn().mockResolvedValue([makeVehicle({ odometerKm: 15000, lastServiceOdometerKm: 9500, serviceIntervalKm: 5000 })]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listDrivingVehicles()

    expect((res as { data: Array<{ dueForService: boolean }> }).data[0].dueForService).toBe(true)
  })

  it('does not flag a freshly-serviced vehicle', async () => {
    const db = { drivingVehicle: { findMany: vi.fn().mockResolvedValue([makeVehicle({ sessionsSinceService: 2, odometerKm: 100, lastServiceOdometerKm: 0 })]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listDrivingVehicles()

    expect((res as { data: Array<{ dueForService: boolean }> }).data[0].dueForService).toBe(false)
  })
})

function makeMaintenanceMockDb(vehicle: Record<string, unknown> | null) {
  const db: Record<string, any> = {
    drivingVehicle: {
      findUnique: vi.fn().mockResolvedValue(vehicle),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ ...(vehicle ?? {}), ...data })),
    },
    drivingVehicleMaintenanceLog: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'log-1', createdAt: new Date(), ...data })),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  db.$transaction = vi.fn((ops: Promise<unknown>[]) => Promise.all(ops))
  return db
}

describe('driving.service — logVehicleMaintenance', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing vehicle', async () => {
    const db = makeMaintenanceMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await logVehicleMaintenance({ vehicleId: 'missing', odometerKm: 5000, serviceType: 'General Service' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DVM58-001')
  })

  it('rejects a negative odometer reading', async () => {
    const db = makeMaintenanceMockDb(makeVehicle())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await logVehicleMaintenance({ vehicleId: 'veh-1', odometerKm: -5, serviceType: 'General Service' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DVM58-004')
  })

  it('creates a log row and resets the vehicle aggregate fields', async () => {
    const db = makeMaintenanceMockDb(makeVehicle({ odometerKm: 4000 }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await logVehicleMaintenance({ vehicleId: 'veh-1', odometerKm: 5000, serviceType: 'Oil Change', cost: 1200 })

    expect(res.success).toBe(true)
    expect(db.drivingVehicle.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'veh-1' },
      data: expect.objectContaining({ lastServiceOdometerKm: 5000, sessionsSinceService: 0, odometerKm: 5000 }),
    }))
  })

  it('never lets a service log move the vehicle odometer backwards', async () => {
    // Staff enters a service odometer reading lower than the vehicle's
    // already-known current odometer (e.g. a late/out-of-order log entry) —
    // odometerKm must stay at the higher, already-known value.
    const db = makeMaintenanceMockDb(makeVehicle({ odometerKm: 9000 }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await logVehicleMaintenance({ vehicleId: 'veh-1', odometerKm: 5000, serviceType: 'Oil Change' })

    expect(db.drivingVehicle.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ odometerKm: 9000, lastServiceOdometerKm: 5000 }),
    }))
  })
})

function makeTestMockDb() {
  const db: Record<string, any> = {
    drivingTest: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'test-1', result: 'PENDING', createdAt: new Date(), updatedAt: new Date(), instructor: data.instructorId ? { id: data.instructorId, fullName: 'Test Instructor' } : null, ...data })
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('driving.service — DrivingTest.instructorId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('persists the instructor who taught the learner', async () => {
    const db = makeTestMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createDrivingTest({ learnerId: 'learner-1', testType: 'LL_TEST', testDate: '2026-07-01', testCenter: 'RTO', instructorId: 'instr-1' })

    expect(res.success).toBe(true)
    expect((res as { data: { instructorId: string } }).data.instructorId).toBe('instr-1')
    expect(db.drivingTest.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ instructorId: 'instr-1' }) }))
  })

  it('allows scheduling a test with no instructor on record', async () => {
    const db = makeTestMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createDrivingTest({ learnerId: 'learner-1', testType: 'LL_TEST', testDate: '2026-07-01', testCenter: 'RTO' })

    expect(res.success).toBe(true)
    expect((res as { data: { instructorId: string | null } }).data.instructorId).toBeNull()
  })
})

describe('driving.service — getInstructorPassRates', () => {
  beforeEach(() => vi.clearAllMocks())

  it('computes pass/fail counts and pass rate per instructor, ignoring PENDING and unassigned tests', async () => {
    const db = {
      drivingTest: {
        findMany: vi.fn().mockResolvedValue([
          { instructorId: 'instr-1', result: 'PASSED', instructor: { id: 'instr-1', fullName: 'Instructor A' } },
          { instructorId: 'instr-1', result: 'PASSED', instructor: { id: 'instr-1', fullName: 'Instructor A' } },
          { instructorId: 'instr-1', result: 'FAILED', instructor: { id: 'instr-1', fullName: 'Instructor A' } },
          { instructorId: 'instr-2', result: 'FAILED', instructor: { id: 'instr-2', fullName: 'Instructor B' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getInstructorPassRates()

    expect(res.success).toBe(true)
    const data = (res as { data: Array<{ instructorId: string; passed: number; failed: number; total: number; passRate: number }> }).data
    const a = data.find((r) => r.instructorId === 'instr-1')!
    const b = data.find((r) => r.instructorId === 'instr-2')!
    expect(a).toMatchObject({ passed: 2, failed: 1, total: 3, passRate: 67 })
    expect(b).toMatchObject({ passed: 0, failed: 1, total: 1, passRate: 0 })
    // query itself excludes PENDING/null-instructor rows — verified via the where clause
    expect(db.drivingTest.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { instructorId: { not: null }, result: { in: ['PASSED', 'FAILED'] } },
    }))
  })
})
