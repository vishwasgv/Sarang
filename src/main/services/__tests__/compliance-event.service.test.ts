import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { generateComplianceTasksForAllClients, seedComplianceEvents } from '../compliance-event.service'

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ce-1', title: 'GSTR-3B Filing (Monthly)', category: 'GST',
    frequency: 'MONTHLY', applicableTo: 'ALL', dueMonth: null, dueDay: 20,
    isActive: true,
    ...overrides,
  }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  return {
    complianceEvent: {
      findMany: vi.fn().mockResolvedValue([makeEvent()]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    customer: {
      findMany: vi.fn().mockResolvedValue([{ id: 'cust-1' }, { id: 'cust-2' }]),
    },
    complianceTask: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
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
