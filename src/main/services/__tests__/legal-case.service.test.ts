import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../notification-queue.service', () => ({ buildWhatsAppLink: vi.fn().mockResolvedValue('https://wa.me/test') }))

import { getPrisma } from '../../database/db'
import { listLegalCases, getLegalCase, createLegalCase, updateLegalCase, checkConflictOfInterest } from '../legal-case.service'

// Regression coverage for the Phase 28 re-audit finding: LegalCase.feeAgreed/
// feeCollected are Prisma Decimal fields — Electron's IPC can't serialize a
// Decimal instance and throws "An object could not be cloned" on every
// response that includes one. Live-verified: legalCase.create() with a real
// fee crashed (row silently written to the DB anyway), and legalCase.list()
// then also crashed with that real row present — the Cases tab was stuck on
// "Loading…" forever. A FakeDecimal test double (toString/valueOf only, like
// a real Decimal.js instance) proves serializeCase actually converts every
// field to a plain number, including the nested TimeEntry rows returned by
// getLegalCase (which have their own Decimal fields, serialized via the
// shared serializeTimeEntry from time-entry.service.ts).

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeCase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'case-1', caseNumber: 'CASE-2026-001', caseTitle: 'Test vs State', caseType: 'CIVIL',
    courtName: 'District Court', courtDistrict: null, courtState: null, eCourtId: null,
    clientId: 'cust-1', advocateId: null, status: 'ACTIVE', filingDate: null, nextHearingDate: null,
    feeAgreed: new FakeDecimal(50000) as unknown as number,
    feeCollected: new FakeDecimal(0) as unknown as number,
    notes: null, createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeTimeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1', employeeId: null, caseId: 'case-1', projectId: null,
    date: new Date(), description: 'Drafting petition',
    hours: new FakeDecimal(3) as unknown as number,
    ratePerHour: new FakeDecimal(2000) as unknown as number,
    amount: new FakeDecimal(6000) as unknown as number,
    isBilled: false, invoiceId: null, createdAt: new Date(), updatedAt: new Date(),
    employee: null,
    ...overrides,
  }
}

function makeMockDb(cases: ReturnType<typeof makeCase>[] = [makeCase()]) {
  const db: Record<string, any> = {
    legalCase: {
      findMany: vi.fn().mockResolvedValue(cases),
      findUnique: vi.fn().mockImplementation(({ where: { id } }: { where: { id: string } }) => {
        const c = cases.find((x) => x.id === id)
        if (!c) return Promise.resolve(null)
        return Promise.resolve({ ...c, hearings: [], timeEntries: [makeTimeEntry()], client: { id: c.clientId, customerName: 'Ramesh Sharma', phone: '9812340000' } })
      }),
      // Reuses the seeded case's own id (rather than a fresh 'case-new' id)
      // so scheduleLimitationReminder's own follow-up findUnique(caseId) can
      // find it via the same `cases` array the mock is closed over.
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeCase({ id: cases[0]?.id ?? 'case-new', ...data, client: { id: data.clientId, customerName: 'Ramesh Sharma', phone: '9812340000' } }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeCase({ ...cases[0], ...data }))
      ),
    },
    customer: {
      findUnique: vi.fn().mockResolvedValue({ customerName: 'Ramesh Sharma' }),
    },
    businessProfile: {
      findFirst: vi.fn().mockResolvedValue({ businessName: 'Sharma & Associates' }),
    },
    notificationQueue: {
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('legal-case.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listLegalCases returns feeAgreed/feeCollected as plain numbers', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listLegalCases({})

    expect(res.success).toBe(true)
    const data = (res as { data: Array<Record<string, unknown>> }).data
    expect(typeof data[0].feeAgreed).toBe('number')
    expect(typeof data[0].feeCollected).toBe('number')
  })

  it('getLegalCase returns feeAgreed as null (not a Decimal) when unset, and serializes nested timeEntries', async () => {
    const db = makeMockDb([makeCase({ feeAgreed: null })])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getLegalCase('case-1')

    expect(res.success).toBe(true)
    const data = (res as { data: { feeAgreed: unknown; timeEntries: Array<{ amount: unknown }> } }).data
    expect(data.feeAgreed).toBeNull()
    expect(typeof data.timeEntries[0].amount).toBe('number')
  })

  it('createLegalCase returns feeAgreed/feeCollected as plain numbers', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createLegalCase({ caseNumber: 'CASE-2026-002', caseTitle: 'New Case', courtName: 'District Court', clientId: 'cust-1', feeAgreed: 25000 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { feeAgreed: unknown } }).data.feeAgreed).toBe('number')
  })

  it('updateLegalCase returns feeAgreed/feeCollected as plain numbers', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateLegalCase({ id: 'case-1', status: 'CLOSED' })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { feeCollected: unknown } }).data.feeCollected).toBe('number')
  })
})

// Phase 58 §2 — Lawyer: statute-of-limitations/deadline reminder, reusing
// the exact same notificationQueue/buildWhatsAppLink mechanism
// hearing.service.ts's scheduleHearingReminder already established.

describe('legal-case.service — limitation-date reminder scheduling', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createLegalCase with a far-future limitationDate schedules BOTH the 30d and 7d reminders', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const farFuture = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const res = await createLegalCase({ caseNumber: 'CASE-2026-003', caseTitle: 'New Case', courtName: 'District Court', clientId: 'cust-1', limitationDate: farFuture })

    expect(res.success).toBe(true)
    expect(db.notificationQueue.create).toHaveBeenCalledTimes(2)
    const types = db.notificationQueue.create.mock.calls.map((c: any) => c[0].data.notificationType)
    expect(types).toEqual(expect.arrayContaining(['LIMITATION_DUE_30D', 'LIMITATION_DUE_7D']))
  })

  it('createLegalCase WITHOUT a limitationDate schedules no reminder at all', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createLegalCase({ caseNumber: 'CASE-2026-004', caseTitle: 'New Case', courtName: 'District Court', clientId: 'cust-1' })

    expect(res.success).toBe(true)
    expect(db.notificationQueue.create).not.toHaveBeenCalled()
  })

  it('updateLegalCase changing limitationDate cancels the old reminder and schedules a fresh one', async () => {
    const oldDate = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
    const db = makeMockDb([makeCase({ limitationDate: oldDate })])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const newFuture = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const res = await updateLegalCase({ id: 'case-1', limitationDate: newFuture })

    expect(res.success).toBe(true)
    expect(db.notificationQueue.deleteMany).toHaveBeenCalledTimes(1)
    expect(db.notificationQueue.create).toHaveBeenCalledTimes(2)
  })

  it('updateLegalCase re-saving the SAME limitationDate does not re-trigger cancel/reschedule', async () => {
    // Stored as midnight UTC, same as how both createLegalCase and
    // updateLegalCase always parse a date-only string (new Date(dateStr)) —
    // matches what a real re-save via the UI's date-only <input> produces.
    const sameDateStr = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const db = makeMockDb([makeCase({ limitationDate: new Date(sameDateStr) })])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateLegalCase({ id: 'case-1', limitationDate: sameDateStr, notes: 'edited' })

    expect(res.success).toBe(true)
    expect(db.notificationQueue.deleteMany).not.toHaveBeenCalled()
    expect(db.notificationQueue.create).not.toHaveBeenCalled()
  })

  it('updateLegalCase NOT touching limitationDate at all does not schedule/cancel anything', async () => {
    const db = makeMockDb([makeCase({ limitationDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000) })])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateLegalCase({ id: 'case-1', status: 'CLOSED' })

    expect(res.success).toBe(true)
    expect(db.legalCase.findUnique).not.toHaveBeenCalled()
    expect(db.notificationQueue.deleteMany).not.toHaveBeenCalled()
  })
})

// Phase 58 §2 — Lawyer: basic conflict-of-interest check (advisory).

describe('legal-case.service.checkConflictOfInterest', () => {
  beforeEach(() => vi.clearAllMocks())

  it('flags a conflict when the proposed opposing party matches an existing client', async () => {
    const db = makeMockDb([makeCase({ clientId: 'cust-1' })])
    db.legalCase.findMany = vi.fn().mockResolvedValue([
      { id: 'case-1', caseNumber: 'CASE-2026-001', caseTitle: 'Test vs State', client: { customerName: 'State of Maharashtra' } },
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await checkConflictOfInterest({ opposingPartyName: 'State of Maharashtra' })

    expect(res.success).toBe(true)
    const conflicts = (res as { data: { conflicts: unknown[] } }).data.conflicts
    expect(conflicts).toHaveLength(1)
  })

  it('flags a conflict when the proposed client was previously recorded as an opposing party', async () => {
    const db = makeMockDb()
    db.customer.findUnique = vi.fn().mockResolvedValue({ customerName: 'Suresh Iyer' })
    db.legalCase.findMany = vi.fn().mockResolvedValue([
      { id: 'case-2', caseNumber: 'CASE-2026-002', caseTitle: 'Ramesh vs Suresh Iyer', opposingPartyName: 'Suresh Iyer' },
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await checkConflictOfInterest({ clientId: 'cust-suresh' })

    expect(res.success).toBe(true)
    const conflicts = (res as { data: { conflicts: unknown[] } }).data.conflicts
    expect(conflicts).toHaveLength(1)
  })

  it('returns an empty conflicts array when nothing matches', async () => {
    const db = makeMockDb()
    db.legalCase.findMany = vi.fn().mockResolvedValue([])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await checkConflictOfInterest({ clientId: 'cust-1', opposingPartyName: 'Nobody Special' })

    expect(res.success).toBe(true)
    expect((res as { data: { conflicts: unknown[] } }).data.conflicts).toHaveLength(0)
  })

  it('excludeCaseId is passed through to the query (excludes self when editing)', async () => {
    const db = makeMockDb()
    db.legalCase.findMany = vi.fn().mockResolvedValue([])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await checkConflictOfInterest({ opposingPartyName: 'Someone', excludeCaseId: 'case-1' })

    expect(db.legalCase.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { not: 'case-1' } }),
    }))
  })

  it('returns no conflicts when neither clientId nor opposingPartyName is provided', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await checkConflictOfInterest({})

    expect(res.success).toBe(true)
    expect((res as { data: { conflicts: unknown[] } }).data.conflicts).toHaveLength(0)
    expect(db.legalCase.findMany).not.toHaveBeenCalled()
  })
})
