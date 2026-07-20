import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { generateComplianceTasksForAllClients, seedComplianceEvents, setClientAgmDate } from '../compliance-event.service'

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ce-1', title: 'GSTR-3B Filing (Monthly)', category: 'GST',
    frequency: 'MONTHLY', applicableTo: 'ALL', dueMonth: null, dueDay: 20, agmOffsetDays: null,
    isActive: true,
    ...overrides,
  }
}

// Args-aware: routes on the `where` clause the real generateComplianceTasksForAllClients
// sends, exactly like real Prisma would filter — needed because this function now
// makes TWO separate complianceEvent.findMany / customer.findMany calls (fixed-date
// events, then AGM-relative events) and a naive mockResolvedValue would return the
// same result for both, corrupting every existing test's created-count assertion.
function makeDb(overrides: {
  fixedDateEvents?: unknown[]
  agmEvents?: unknown[]
  clients?: unknown[]
  agmClients?: unknown[]
  complianceEvent?: Record<string, unknown>
  customer?: Record<string, unknown>
  complianceTask?: Record<string, unknown>
} = {}) {
  const fixedDateEvents = overrides.fixedDateEvents ?? [makeEvent()]
  const agmEvents = overrides.agmEvents ?? []
  const clients = overrides.clients ?? [{ id: 'cust-1' }, { id: 'cust-2' }]
  const agmClients = overrides.agmClients ?? []

  return {
    complianceEvent: {
      findMany: vi.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(where?.agmOffsetDays ? agmEvents : fixedDateEvents)
      ),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      ...overrides.complianceEvent,
    },
    customer: {
      findMany: vi.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(where?.lastAgmDate ? agmClients : clients)
      ),
      findUnique: vi.fn().mockResolvedValue({ id: 'cust-1' }),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'cust-1', ...data })),
      ...overrides.customer,
    },
    complianceTask: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      ...overrides.complianceTask,
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
}

beforeEach(() => vi.clearAllMocks())

describe('generateComplianceTasksForAllClients', () => {
  it('creates one task per active client for each event with a computable due date', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateComplianceTasksForAllClients()

    expect(res.created).toBe(2) // 1 event x 2 clients
    expect(db.complianceTask.create).toHaveBeenCalledTimes(2)
  })

  it('is idempotent — does not recreate a task that already exists for the same (event, client, dueDate)', async () => {
    const db = makeDb({
      complianceTask: {
        findFirst: vi.fn().mockResolvedValue({ id: 'existing-task' }),
        create: vi.fn(),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateComplianceTasksForAllClients()

    expect(res.created).toBe(0)
    expect(db.complianceTask.create).not.toHaveBeenCalled()
  })

  it('skips events with no computable due date (dueDay null — AGM-relative ROC/MCA events)', async () => {
    const db = makeDb({
      complianceEvent: { findMany: vi.fn().mockResolvedValue([]) }, // the where clause itself excludes dueDay:null; simulate the empty result
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateComplianceTasksForAllClients()

    expect(res.created).toBe(0)
    expect(db.complianceEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ dueDay: { not: null } }) })
    )
  })

  it('computes the next occurrence of a fixed annual date (dueMonth set), rolling to next year if this year already passed', async () => {
    const pastDateThisYear = makeEvent({ id: 'ce-annual', title: 'ITR Filing', dueMonth: 1, dueDay: 1 }) // Jan 1 — almost certainly already past "now" in a real run
    const db = makeDb({ complianceEvent: { findMany: vi.fn().mockResolvedValue([pastDateThisYear]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await generateComplianceTasksForAllClients()

    const dueDates = db.complianceTask.create.mock.calls.map((c: any[]) => (c[0] as { data: { dueDate: Date } }).data.dueDate)
    for (const d of dueDates) {
      expect(d.getTime()).toBeGreaterThanOrEqual(Date.now() - 1000)
      expect(d.getMonth()).toBe(0) // January
      expect(d.getDate()).toBe(1)
    }
  })

  it('does nothing when there are no active clients', async () => {
    const db = makeDb({ customer: { findMany: vi.fn().mockResolvedValue([]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateComplianceTasksForAllClients()

    expect(res.created).toBe(0)
  })
})

describe('seedComplianceEvents — backfill for already-installed databases', () => {
  it('backfills dueMonth/dueDay onto a pre-existing row that predates this field', async () => {
    const db = makeDb({
      complianceEvent: {
        // Simulates a row seeded before dueMonth/dueDay existed — findFirst
        // must be called once per seeded title; return a "legacy" row (nulls)
        // for all of them so every one triggers the backfill update path.
        findFirst: vi.fn().mockResolvedValue({ id: 'legacy-row', dueMonth: null, dueDay: null }),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await seedComplianceEvents()

    expect(db.complianceEvent.create).not.toHaveBeenCalled()
    expect(db.complianceEvent.update).toHaveBeenCalled()
    // At least one call should be the GSTR-3B monthly backfill (dueMonth null, dueDay 20)
    expect(db.complianceEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { dueMonth: null, dueDay: 20 } })
    )
  })

  it('does not touch a row whose dueMonth/dueDay already match the seed data', async () => {
    const db = makeDb({
      complianceEvent: {
        findFirst: vi.fn().mockImplementation(({ where }: { where: { title: string } }) =>
          Promise.resolve(where.title === 'GSTR-3B Filing (Monthly)' ? { id: 'up-to-date-row', dueMonth: null, dueDay: 20 } : { id: 'x', dueMonth: 1, dueDay: 1 })
        ),
        create: vi.fn(),
        update: vi.fn(),
      },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await seedComplianceEvents()

    // The GSTR-3B row specifically must not be updated since it already matches.
    const gstr3bUpdates = db.complianceEvent.update.mock.calls.filter(
      (c: any[]) => (c[0] as { where: { id: string } }).where.id === 'up-to-date-row'
    )
    expect(gstr3bUpdates).toHaveLength(0)
  })
})

// Phase 58 §2 — CA Firm: AGM-relative ROC events (MGT-7/AOC-4/ADT-1), now
// generate-able once a client's lastAgmDate is captured — reuses the exact
// same idempotent auto-generation pass as the fixed-date events, just with a
// second, separately-filtered event/client query.

function makeAgmEvent(overrides: Record<string, unknown> = {}) {
  return { id: 'ce-mgt7', title: 'MGT-7 Annual Return', category: 'ROC', frequency: 'ANNUAL', applicableTo: 'COMPANY', dueMonth: null, dueDay: null, agmOffsetDays: 60, isActive: true, ...overrides }
}

describe('generateComplianceTasksForAllClients — AGM-relative events', () => {
  it('creates a task offset exactly agmOffsetDays after the client lastAgmDate', async () => {
    const lastAgmDate = new Date('2026-08-15T00:00:00Z')
    const db = makeDb({
      fixedDateEvents: [], // isolate to just the AGM branch for this test
      agmEvents: [makeAgmEvent()],
      agmClients: [{ id: 'cust-co-1', lastAgmDate }],
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateComplianceTasksForAllClients()

    expect(res.created).toBe(1)
    const createCall = db.complianceTask.create.mock.calls[0][0] as { data: { dueDate: Date; clientId: string; title: string } }
    expect(createCall.data.clientId).toBe('cust-co-1')
    expect(createCall.data.title).toBe('MGT-7 Annual Return')
    expect(createCall.data.dueDate.toISOString()).toBe('2026-10-14T00:00:00.000Z') // +60 days
  })

  it('skips clients with no lastAgmDate captured — never guesses', async () => {
    const db = makeDb({
      fixedDateEvents: [],
      agmEvents: [makeAgmEvent()],
      agmClients: [], // the where:{lastAgmDate:{not:null}} filter already excludes these
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateComplianceTasksForAllClients()

    expect(res.created).toBe(0)
    expect(db.complianceTask.create).not.toHaveBeenCalled()
  })

  it('generates all 3 AGM-relative events (MGT-7/AOC-4/ADT-1) for one client with different offsets', async () => {
    const lastAgmDate = new Date('2026-08-15T00:00:00Z')
    const db = makeDb({
      fixedDateEvents: [],
      agmEvents: [
        makeAgmEvent({ id: 'ce-mgt7', title: 'MGT-7 Annual Return', agmOffsetDays: 60 }),
        makeAgmEvent({ id: 'ce-aoc4', title: 'AOC-4 Financial Statements', agmOffsetDays: 30 }),
        makeAgmEvent({ id: 'ce-adt1', title: 'ADT-1 Auditor Appointment', agmOffsetDays: 15 }),
      ],
      agmClients: [{ id: 'cust-co-1', lastAgmDate }],
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateComplianceTasksForAllClients()

    expect(res.created).toBe(3)
    const titles = db.complianceTask.create.mock.calls.map((c: any) => c[0].data.title)
    expect(titles).toEqual(expect.arrayContaining(['MGT-7 Annual Return', 'AOC-4 Financial Statements', 'ADT-1 Auditor Appointment']))
  })

  it('is idempotent for AGM-relative events too — same (event, client, dueDate) is not recreated', async () => {
    const lastAgmDate = new Date('2026-08-15T00:00:00Z')
    const db = makeDb({
      fixedDateEvents: [],
      agmEvents: [makeAgmEvent()],
      agmClients: [{ id: 'cust-co-1', lastAgmDate }],
      complianceTask: { findFirst: vi.fn().mockResolvedValue({ id: 'existing' }), create: vi.fn() },
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateComplianceTasksForAllClients()

    expect(res.created).toBe(0)
    expect(db.complianceTask.create).not.toHaveBeenCalled()
  })
})

describe('setClientAgmDate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing client', async () => {
    const db = makeDb({ customer: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await setClientAgmDate('missing', '2026-08-15')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('CE29-002')
  })

  it('sets a real lastAgmDate on the client', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await setClientAgmDate('cust-1', '2026-08-15')

    expect(res.success).toBe(true)
    expect(db.customer.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'cust-1' }, data: { lastAgmDate: new Date('2026-08-15') },
    }))
  })

  it('clears lastAgmDate when passed null', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await setClientAgmDate('cust-1', null)

    expect(res.success).toBe(true)
    expect(db.customer.update).toHaveBeenCalledWith(expect.objectContaining({ data: { lastAgmDate: null } }))
  })
})
