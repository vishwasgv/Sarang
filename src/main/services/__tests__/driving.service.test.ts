import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))
vi.mock('../notification-queue.service', () => ({ buildWhatsAppLink: vi.fn().mockResolvedValue('https://wa.me/link') }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { parseLocalDateStart } from '../../utils/date.util'
import {
  createDrivingSession,
  updateDrivingSession,
  listDrivingSessions,
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
  getUpcomingTestsAndLowBalanceKPIs,
  getLearnerSkillChecklist,
  upsertLearnerSkillAssessment,
  scheduleTestReminder,
  STANDARD_DRIVING_SKILLS,
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
      // Conflict check (real bug fixed 2026-07-28): defaults to no existing
      // sessions, i.e. no conflict — tests that specifically want to
      // exercise a conflict override this to return an overlapping row.
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeSession({ ...data }))
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  // createDrivingSession/updateDrivingSession now wrap the conflict check +
  // write in a transaction (same race-safety fix as serial.service.ts's
  // markSerialSoldTx) — route the callback through this same mock db so
  // `tx.*` calls hit the same mocked methods as `db.*`.
  db.$transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db))
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

  // Real bug found 2026-07-23: the enrollment's sessionsUsed used to be
  // incremented unconditionally AFTER session creation, with no check that
  // the package still had sessions remaining — unlike the identical
  // capped-balance pattern session-pack.service.ts's deductSession already
  // enforces. Fixed by pre-checking + atomically claiming the increment
  // (conditional on the exact sessionsUsed just read) BEFORE the session is
  // even created.
  it('claims the package enrollment sessionsUsed atomically when a session redeems a package', async () => {
    const db = makeMockDb(null) as any
    db.drivingPackageEnrollment = {
      findUnique: vi.fn().mockResolvedValue({ id: 'enr-1', sessionsUsed: 2, package: { totalSessions: 10 } }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createDrivingSession({ learnerId: 'learner-1', instructorId: 'instr-1', vehicleId: 'veh-1', sessionDate: '2026-07-01', sessionTime: '09:00', packageEnrollmentId: 'enr-1' })

    expect(res.success).toBe(true)
    expect(db.drivingPackageEnrollment.updateMany).toHaveBeenCalledWith({
      where: { id: 'enr-1', sessionsUsed: 2 },
      data: { sessionsUsed: { increment: 1 } },
    })
    expect(db.drivingSession.create).toHaveBeenCalled()
  })

  it('rejects booking a session against a package enrollment that does not exist', async () => {
    const db = makeMockDb(null) as any
    db.drivingPackageEnrollment = { findUnique: vi.fn().mockResolvedValue(null) }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createDrivingSession({ learnerId: 'learner-1', instructorId: 'instr-1', vehicleId: 'veh-1', sessionDate: '2026-07-01', sessionTime: '09:00', packageEnrollmentId: 'enr-missing' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DS27-012')
    expect(db.drivingSession.create).not.toHaveBeenCalled()
  })

  it('rejects booking a session against a fully-used package enrollment', async () => {
    const db = makeMockDb(null) as any
    db.drivingPackageEnrollment = {
      findUnique: vi.fn().mockResolvedValue({ id: 'enr-1', sessionsUsed: 10, package: { totalSessions: 10 } }),
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createDrivingSession({ learnerId: 'learner-1', instructorId: 'instr-1', vehicleId: 'veh-1', sessionDate: '2026-07-01', sessionTime: '09:00', packageEnrollmentId: 'enr-1' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DS27-013')
    expect(db.drivingSession.create).not.toHaveBeenCalled()
  })

  it('rejects booking when a concurrent session already claimed the last remaining slot', async () => {
    const db = makeMockDb(null) as any
    db.drivingPackageEnrollment = {
      findUnique: vi.fn().mockResolvedValue({ id: 'enr-1', sessionsUsed: 9, package: { totalSessions: 10 } }),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createDrivingSession({ learnerId: 'learner-1', instructorId: 'instr-1', vehicleId: 'veh-1', sessionDate: '2026-07-01', sessionTime: '09:00', packageEnrollmentId: 'enr-1' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DS27-014')
    expect(db.drivingSession.create).not.toHaveBeenCalled()
  })
})

// Real bug found live (2026-07-28 service-vertical audit): createDrivingSession
// had zero double-booking protection for either the instructor or the
// vehicle — two front-desk terminals could book the same instructor or
// vehicle for overlapping times and both would succeed silently.
describe('driving.service — instructor/vehicle double-booking prevention', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a new session that overlaps an existing one for the same instructor', async () => {
    const db = makeMockDb(null)
    db.drivingSession.findMany = vi.fn().mockResolvedValue([
      { sessionTime: '09:00', durationMinutes: 60, instructorId: 'instr-1', vehicleId: 'veh-OTHER' },
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // 09:30-10:30 overlaps the existing 09:00-10:00 booking for instr-1.
    const res = await createDrivingSession({ learnerId: 'learner-1', instructorId: 'instr-1', vehicleId: 'veh-1', sessionDate: '2026-07-01', sessionTime: '09:30', durationMinutes: 60 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DS27-015')
    expect(db.drivingSession.create).not.toHaveBeenCalled()
  })

  it('rejects a new session that overlaps an existing one for the same vehicle (different instructor)', async () => {
    const db = makeMockDb(null)
    db.drivingSession.findMany = vi.fn().mockResolvedValue([
      { sessionTime: '09:00', durationMinutes: 60, instructorId: 'instr-OTHER', vehicleId: 'veh-1' },
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createDrivingSession({ learnerId: 'learner-1', instructorId: 'instr-1', vehicleId: 'veh-1', sessionDate: '2026-07-01', sessionTime: '09:30', durationMinutes: 60 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DS27-015')
  })

  it('allows a back-to-back session that does not actually overlap', async () => {
    const db = makeMockDb(null)
    db.drivingSession.findMany = vi.fn().mockResolvedValue([
      { sessionTime: '09:00', durationMinutes: 60, instructorId: 'instr-1', vehicleId: 'veh-1' },
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // Existing session ends exactly at 10:00; this one starts at 10:00 — no overlap.
    const res = await createDrivingSession({ learnerId: 'learner-1', instructorId: 'instr-1', vehicleId: 'veh-1', sessionDate: '2026-07-01', sessionTime: '10:00', durationMinutes: 60 })

    expect(res.success).toBe(true)
  })

  it('ignores CANCELLED sessions when checking for conflicts', async () => {
    const db = makeMockDb(null)
    // A real query would already filter these out via `status: { notIn: [...] }`
    // in the where clause — simulate that by returning no rows.
    db.drivingSession.findMany = vi.fn().mockResolvedValue([])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createDrivingSession({ learnerId: 'learner-1', instructorId: 'instr-1', vehicleId: 'veh-1', sessionDate: '2026-07-01', sessionTime: '09:00', durationMinutes: 60 })

    expect(res.success).toBe(true)
    const findManyCall = db.drivingSession.findMany.mock.calls[0][0] as { where: { status: { notIn: string[] } } }
    expect(findManyCall.where.status.notIn).toEqual(['CANCELLED', 'NO_SHOW'])
  })

  it('rejects rescheduling a session onto a time that now conflicts with another', async () => {
    const db = makeSessionUpdateMockDb({ id: 'session-1', instructorId: 'instr-1', vehicleId: 'veh-1', sessionDate: new Date(2026, 6, 1), sessionTime: '09:00', durationMinutes: 60, status: 'SCHEDULED' })
    db.drivingSession.findMany = vi.fn().mockResolvedValue([
      { sessionTime: '11:00', durationMinutes: 60, instructorId: 'instr-1', vehicleId: 'veh-OTHER' },
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateDrivingSession({ id: 'session-1', sessionTime: '11:30' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('DS27-015')
    expect(db.drivingSession.update).not.toHaveBeenCalled()
  })

  it('excludes the session being rescheduled from its own conflict check', async () => {
    const db = makeSessionUpdateMockDb({ id: 'session-1', instructorId: 'instr-1', vehicleId: 'veh-1', sessionDate: new Date(2026, 6, 1), sessionTime: '09:00', durationMinutes: 60, status: 'SCHEDULED' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    // Only change is a small time shift for the SAME session — findMany
    // returning [] (no OTHER sessions) means this must succeed.
    const res = await updateDrivingSession({ id: 'session-1', sessionTime: '09:15' })

    expect(res.success).toBe(true)
    const findManyCall = db.drivingSession.findMany.mock.calls[0][0] as { where: { id?: { not: string } } }
    expect(findManyCall.where.id).toEqual({ not: 'session-1' })
  })

  it('does not run the conflict check at all when neither date, time, nor duration changes', async () => {
    const db = makeSessionUpdateMockDb({ id: 'session-1', instructorId: 'instr-1', vehicleId: 'veh-1', status: 'SCHEDULED' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateDrivingSession({ id: 'session-1', instructorNotes: 'Good progress' })

    expect(res.success).toBe(true)
    expect(db.drivingSession.findMany).not.toHaveBeenCalled()
  })
})

// Real bug found live (2026-07-28 service-vertical audit, continued): a bare
// `new Date('YYYY-MM-DD')` parses a date-only string as UTC midnight, not
// local midnight — inconsistent with every sibling scheduling write in this
// codebase (appointment.service.ts's scheduledDate, already fixed via
// parseLocalDateStart). createDrivingSession/updateDrivingSession wrote
// sessionDate this broken way while listDrivingSessions' own date filter in
// this SAME file read it back the same broken way too — self-consistent only
// by accident, and diverging from every other scheduling service the moment
// either side is compared against local-midnight semantics (e.g. any report
// or cross-service query that anchors "today" at local midnight). Fixed by
// routing all three through parseLocalDateStart, matching appointment.
// service.ts exactly.
describe('driving.service — sessionDate local-midnight parsing', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createDrivingSession persists sessionDate at local midnight, not UTC midnight', async () => {
    const db = makeMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createDrivingSession({ learnerId: 'learner-1', instructorId: 'instr-1', vehicleId: 'veh-1', sessionDate: '2026-07-01', sessionTime: '09:00' })

    const createCall = db.drivingSession.create.mock.calls[0][0] as { data: { sessionDate: Date } }
    expect(createCall.data.sessionDate.getTime()).toBe(parseLocalDateStart('2026-07-01').getTime())
  })

  it('createDrivingSession scans conflicts using a local-midnight day window', async () => {
    const db = makeMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createDrivingSession({ learnerId: 'learner-1', instructorId: 'instr-1', vehicleId: 'veh-1', sessionDate: '2026-07-01', sessionTime: '09:00' })

    const findManyCall = db.drivingSession.findMany.mock.calls[0][0] as { where: { sessionDate: { gte: Date } } }
    expect(findManyCall.where.sessionDate.gte.getTime()).toBe(parseLocalDateStart('2026-07-01').getTime())
  })

  it('listDrivingSessions filters by a local-midnight day window', async () => {
    const db = { drivingSession: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await listDrivingSessions({ date: '2026-07-01' })

    const findManyCall = db.drivingSession.findMany.mock.calls[0][0] as { where: { sessionDate: { gte: Date; lt: Date } } }
    expect(findManyCall.where.sessionDate.gte.getTime()).toBe(parseLocalDateStart('2026-07-01').getTime())
    expect(findManyCall.where.sessionDate.lt.getTime()).toBe(parseLocalDateStart('2026-07-01').getTime() + 86400000)
  })

  it('updateDrivingSession reschedule persists the new sessionDate at local midnight', async () => {
    const db = makeSessionUpdateMockDb({ id: 'session-1', instructorId: 'instr-1', vehicleId: 'veh-1', sessionDate: new Date(2026, 6, 1), sessionTime: '09:00', durationMinutes: 60, status: 'SCHEDULED' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateDrivingSession({ id: 'session-1', sessionDate: '2026-07-05' })

    const updateCall = db.drivingSession.update.mock.calls[0][0] as { data: { sessionDate: Date } }
    expect(updateCall.data.sessionDate.getTime()).toBe(parseLocalDateStart('2026-07-05').getTime())
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
      items: [expect.objectContaining({ productId: 'product-1', unitPrice: 500 })],
    }))
    expect(db.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ hsnCode: '999293' }) }))
    expect(db.drivingSession.update).toHaveBeenCalledWith({ where: { id: 'session-1' }, data: { invoiceId: 'invoice-1' } })
    // Regression: the invoice item must NOT hardcode a taxRate — it must fall
    // through to the product's own (editable) taxRate, so an owner changing
    // the tax rate on "Driving Lesson" in Settings actually takes effect.
    const call = vi.mocked(billingService.createInvoice).mock.calls[0][0]
    expect(call.items[0]).not.toHaveProperty('taxRate')
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
      items: [expect.objectContaining({ productId: 'product-1', unitPrice: 5000 })],
    }))
    expect(db.drivingPackageEnrollment.update).toHaveBeenCalledWith({ where: { id: 'enr-1' }, data: { invoiceId: 'invoice-1' } })
    const call = vi.mocked(billingService.createInvoice).mock.calls[0][0]
    expect(call.items[0]).not.toHaveProperty('taxRate')
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
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeSession({ ...(existingSession ?? {}), ...data }))
      ),
    },
    drivingVehicle: {
      update: vi.fn().mockResolvedValue({}),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  db.$transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db))
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

  it('stores testDate at LOCAL midnight, not UTC midnight (same bug class as createDrivingSession, found on a later pass)', async () => {
    const db = makeTestMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createDrivingTest({ learnerId: 'learner-1', testType: 'LL_TEST', testDate: '2026-08-15', testCenter: 'RTO' })

    const call = db.drivingTest.create.mock.calls[0][0] as { data: { testDate: Date } }
    expect(call.data.testDate).toEqual(new Date(2026, 7, 15))
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

// Phase 66 — extracted from ai-vertical-templates.service.ts's own
// 'driving.upcomingTestsAndLowBalance' AI template case so the Dashboard
// spotlight card can call the exact same function instead of a duplicated
// inline query.
describe('driving.service — getUpcomingTestsAndLowBalanceKPIs', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns tests scheduled within 14 days and enrollments with 1-2 sessions remaining', async () => {
    const db = {
      drivingTest: {
        findMany: vi.fn().mockResolvedValue([
          { testType: 'LMV', testDate: new Date(), learner: { customerName: 'Learner A' } },
        ]),
      },
      drivingPackageEnrollment: {
        findMany: vi.fn().mockResolvedValue([
          { sessionsUsed: 8, learner: { customerName: 'Learner A' }, package: { totalSessions: 10 } }, // 2 left — low
          { sessionsUsed: 9, learner: { customerName: 'Learner B' }, package: { totalSessions: 10 } }, // 1 left — low
          { sessionsUsed: 5, learner: { customerName: 'Learner C' }, package: { totalSessions: 10 } }, // 5 left — not low
          { sessionsUsed: 10, learner: { customerName: 'Learner D' }, package: { totalSessions: 10 } }, // 0 left — already finished, excluded
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getUpcomingTestsAndLowBalanceKPIs()

    expect(res.success).toBe(true)
    const data = (res as { data: { upcomingTests: unknown[]; lowBalanceCount: number } }).data
    expect(data.upcomingTests).toHaveLength(1)
    expect(data.lowBalanceCount).toBe(2)
  })

  it('returns a graceful error instead of throwing when the query fails', async () => {
    vi.mocked(getPrisma).mockImplementation(() => { throw new Error('DB unavailable') })

    const res = await getUpcomingTestsAndLowBalanceKPIs()

    expect(res.success).toBe(false)
    expect(res.error?.message).toBe('DB unavailable')
  })
})

// Phase 68 §9.1 — Driving School item 3: learner skill-mastery checklist.
describe('driving.service — getLearnerSkillChecklist / upsertLearnerSkillAssessment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('defaults every standard skill to NOT_STARTED for a learner with zero assessment rows', async () => {
    const db = { learnerSkillAssessment: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getLearnerSkillChecklist('learner-1')

    expect(res.success).toBe(true)
    const data = (res as any).data
    expect(data.checklist).toHaveLength(STANDARD_DRIVING_SKILLS.length)
    expect(data.checklist.every((c: any) => c.masteryLevel === 'NOT_STARTED')).toBe(true)
    expect(data.masteredCount).toBe(0)
  })

  it('merges real assessment rows into the standard checklist by skillKey', async () => {
    const db = {
      learnerSkillAssessment: {
        findMany: vi.fn().mockResolvedValue([
          { skillKey: 'PARKING', masteryLevel: 'MASTERED', notes: 'Great parallel parking', updatedAt: new Date(), assessedBy: { fullName: 'Instructor Raj' } },
        ]),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getLearnerSkillChecklist('learner-1')

    const parking = (res as any).data.checklist.find((c: any) => c.key === 'PARKING')
    expect(parking.masteryLevel).toBe('MASTERED')
    expect(parking.assessedByName).toBe('Instructor Raj')
    expect((res as any).data.masteredCount).toBe(1)
  })

  it('rejects an unknown skill key', async () => {
    const db = { learnerProfile: { findUnique: vi.fn() } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertLearnerSkillAssessment({ customerId: 'learner-1', skillKey: 'MADE_UP_SKILL', masteryLevel: 'MASTERED' })

    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('LSA68-002')
  })

  it('rejects assessing a learner with no driving-school profile yet', async () => {
    const db = { learnerProfile: { findUnique: vi.fn().mockResolvedValue(null) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertLearnerSkillAssessment({ customerId: 'learner-1', skillKey: 'PARKING', masteryLevel: 'MASTERED' })

    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('LSA68-003')
  })

  it('upserts a real assessment for a valid learner and skill', async () => {
    const db = {
      learnerProfile: { findUnique: vi.fn().mockResolvedValue({ customerId: 'learner-1' }) },
      learnerSkillAssessment: { upsert: vi.fn().mockResolvedValue({ id: 'lsa-1', masteryLevel: 'LEARNING' }) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await upsertLearnerSkillAssessment({ customerId: 'learner-1', skillKey: 'PARKING', masteryLevel: 'LEARNING' })

    expect(res.success).toBe(true)
    expect(db.learnerSkillAssessment.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { customerId_skillKey: { customerId: 'learner-1', skillKey: 'PARKING' } },
    }))
  })
})

// Phase 68 §9.1 — Driving School item 1: RTO test-slot reminder.
describe('driving.service — scheduleTestReminder', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeTest(overrides: Record<string, unknown> = {}) {
    return {
      id: 'test-1', learnerId: 'learner-1', testType: 'LL_TEST', result: 'PENDING',
      testCenter: 'RTO Office', testDate: new Date(Date.now() + 10 * 86400000),
      learner: { customerName: 'Riya', phone: '9999999999' },
      ...overrides,
    }
  }

  it('returns not-found for a nonexistent test', async () => {
    const db = { drivingTest: { findUnique: vi.fn().mockResolvedValue(null) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await scheduleTestReminder('missing')

    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('DT68-001')
  })

  it('rejects scheduling a reminder for an already-decided test', async () => {
    const db = { drivingTest: { findUnique: vi.fn().mockResolvedValue(makeTest({ result: 'PASSED' })) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await scheduleTestReminder('test-1')

    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('DT68-002')
  })

  it('rejects when the reminder date has already passed', async () => {
    const db = { drivingTest: { findUnique: vi.fn().mockResolvedValue(makeTest({ testDate: new Date(Date.now() + 12 * 3600000) })) } } // 12h away
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await scheduleTestReminder('test-1', 1) // 1 day before a test 12h away = already past

    expect(res.success).toBe(false)
    expect((res as any).error.code).toBe('DT68-003')
  })

  it('schedules a real WhatsApp reminder for a valid upcoming test', async () => {
    const db = {
      drivingTest: { findUnique: vi.fn().mockResolvedValue(makeTest()) },
      notificationQueue: { create: vi.fn().mockResolvedValue({ id: 'nq-1' }) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await scheduleTestReminder('test-1', 1)

    expect(res.success).toBe(true)
    expect(db.notificationQueue.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ notificationType: 'DRIVING_TEST_REMINDER', customerPhone: '9999999999' }),
    }))
  })

  it('returns success with no notification when the learner has no phone on file', async () => {
    const db = { drivingTest: { findUnique: vi.fn().mockResolvedValue(makeTest({ learner: { customerName: 'Riya', phone: null } })) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await scheduleTestReminder('test-1')

    expect(res.success).toBe(true)
    expect((res as any).data).toBeNull()
  })
})
