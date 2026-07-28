import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { getSprintBurndown, getProjectVelocity, createSprint, listSprints, updateSprint } from '../sprint.service'

// Real bug found live (2026-07-28 service-vertical audit), two-part:
// (1) createSprint/updateSprint wrote startDate/endDate via a bare
//     `new Date('YYYY-MM-DD')`, which parses as UTC midnight — inconsistent
//     with the parseLocalDateStart fix already applied to every other
//     date-only write in this service family.
// (2) Sprint.startDate/endDate are DateTime fields, which structured clone
//     (Electron's IPC boundary) preserves as real Date instances without
//     throwing (unlike a Prisma Decimal, caught immediately in dev) — so
//     this half was never caught by a clone error; it shipped as a live
//     renderer crash instead. ProjectsScreen.tsx's sprint edit-form
//     populator (openEditSprint) calls `s.startDate.slice(0, 10)` /
//     `s.endDate.slice(0, 10)` directly, assuming an ISO string — since both
//     fields are non-nullable, this crashed on EVERY sprint edit.
describe('sprint.service — date-field writes and IPC serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeMockDb() {
    const db: Record<string, any> = {
      sprint: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'sprint-new', status: 'PLANNING', ...data, issues: [] })
        ),
        update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'sprint-1', projectId: 'proj-1', sprintNumber: 1, status: 'PLANNING', startDate: new Date(2026, 0, 1), endDate: new Date(2026, 0, 15), ...data, issues: [] })
        ),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    return db
  }

  it('createSprint stores startDate/endDate via parseLocalDateStart, not a bare UTC-midnight parse', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createSprint({ projectId: 'proj-1', startDate: '2026-03-10', endDate: '2026-03-24' })

    const call = db.sprint.create.mock.calls[0][0]
    const storedStart: Date = call.data.startDate
    const storedEnd: Date = call.data.endDate
    expect(storedStart.getFullYear()).toBe(2026)
    expect(storedStart.getMonth()).toBe(2)
    expect(storedStart.getDate()).toBe(10)
    expect(storedStart.getHours()).toBe(0) // local midnight, not shifted by a UTC parse
    expect(storedEnd.getDate()).toBe(24)
    expect(storedEnd.getHours()).toBe(0)
  })

  it('createSprint returns startDate/endDate as ISO strings, not raw Date instances', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createSprint({ projectId: 'proj-1', startDate: '2026-03-10', endDate: '2026-03-24' })

    expect(res.success).toBe(true)
    const data = (res as { data: { startDate: unknown; endDate: unknown } }).data
    expect(typeof data.startDate).toBe('string')
    expect((data.startDate as string).slice(0, 10)).toBe('2026-03-10')
    expect(typeof data.endDate).toBe('string')
    expect((data.endDate as string).slice(0, 10)).toBe('2026-03-24')
  })

  it('listSprints returns startDate/endDate as ISO strings, not raw Date instances', async () => {
    const db = makeMockDb()
    db.sprint.findMany = vi.fn().mockResolvedValue([
      { id: 'sprint-1', projectId: 'proj-1', sprintNumber: 1, name: null, goal: null, status: 'ACTIVE', startDate: new Date(2026, 2, 10), endDate: new Date(2026, 2, 24), issues: [] },
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listSprints('proj-1')

    expect(res.success).toBe(true)
    const sprint = (res as { data: Array<{ startDate: unknown; endDate: unknown }> }).data[0]
    expect(typeof sprint.startDate).toBe('string')
    expect(sprint.startDate).not.toBeInstanceOf(Date)
    expect(typeof sprint.endDate).toBe('string')
  })

  it('updateSprint stores a changed startDate via parseLocalDateStart and returns it serialized', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateSprint({ id: 'sprint-1', startDate: '2026-03-15' })

    expect(res.success).toBe(true)
    const call = db.sprint.update.mock.calls[0][0]
    const stored: Date = call.data.startDate
    expect(stored.getDate()).toBe(15)
    expect(stored.getHours()).toBe(0)
    const data = (res as { data: { startDate: unknown } }).data
    expect(typeof data.startDate).toBe('string')
  })
})

describe('sprint.service.getSprintBurndown', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns an error when the sprint does not exist', async () => {
    const db = { sprint: { findUnique: vi.fn().mockResolvedValue(null) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await getSprintBurndown('missing')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SR30-005')
  })

  it('computes a points-weighted burndown with the ideal line reaching zero on the last day, and remaining dropping only after the real resolvedDate', async () => {
    // 5-day sprint: Jan 1 – Jan 5, 2026. Issue A (5pts) resolved Jan 3; Issue B (3pts) never resolved.
    const sprint = {
      id: 'sprint-1', sprintNumber: 1, name: 'Sprint 1', status: 'COMPLETED',
      startDate: new Date(2026, 0, 1), endDate: new Date(2026, 0, 5),
      issues: [
        { id: 'i1', storyPoints: 5, status: 'RESOLVED', resolvedDate: new Date(2026, 0, 3, 10, 0, 0) },
        { id: 'i2', storyPoints: 3, status: 'OPEN', resolvedDate: null },
      ],
    }
    const db = { sprint: { findUnique: vi.fn().mockResolvedValue(sprint) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSprintBurndown('sprint-1')
    expect(res.success).toBe(true)
    const data = (res as { data: any }).data
    expect(data.pointsMode).toBe(true)
    expect(data.totalPoints).toBe(8)
    expect(data.days).toHaveLength(5) // Jan1..Jan5 inclusive

    expect(data.days[0].remainingPoints).toBe(8) // Jan 1 — nothing resolved yet
    expect(data.days[1].remainingPoints).toBe(8) // Jan 2 — still nothing resolved
    expect(data.days[2].remainingPoints).toBe(3) // Jan 3 — issue A resolved during this day
    expect(data.days[3].remainingPoints).toBe(3) // Jan 4
    expect(data.days[4].remainingPoints).toBe(3) // Jan 5 — issue B never resolves

    // Ideal line: linear from totalPoints (day0) to 0 (last day)
    expect(data.days[0].idealRemainingPoints).toBe(8)
    expect(data.days[4].idealRemainingPoints).toBe(0)
    expect(data.days[2].idealRemainingPoints).toBe(4) // midpoint of a 4-day span
  })

  it('falls back to counting issues (1 each) when nobody set story points, and never guesses a point value', async () => {
    const sprint = {
      id: 'sprint-2', sprintNumber: 2, name: null, status: 'ACTIVE',
      startDate: new Date(2026, 1, 1), endDate: new Date(2026, 1, 2),
      issues: [
        { id: 'i1', storyPoints: null, status: 'CLOSED', resolvedDate: new Date(2026, 1, 1, 12, 0, 0) },
        { id: 'i2', storyPoints: null, status: 'OPEN', resolvedDate: null },
      ],
    }
    const db = { sprint: { findUnique: vi.fn().mockResolvedValue(sprint) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSprintBurndown('sprint-2')
    const data = (res as { data: any }).data
    expect(data.pointsMode).toBe(false)
    expect(data.totalPoints).toBe(2) // 1 per issue, not 0
    expect(data.days[0].remainingPoints).toBe(1) // one closed same-day
    expect(data.days[1].remainingPoints).toBe(1) // the other never closes
  })

  it('treats an unestimated issue as 0 points once ANY issue in the sprint has real story points set (never guesses a value for it)', async () => {
    const sprint = {
      id: 'sprint-3', sprintNumber: 3, name: null, status: 'ACTIVE',
      startDate: new Date(2026, 2, 1), endDate: new Date(2026, 2, 1),
      issues: [
        { id: 'i1', storyPoints: 5, status: 'OPEN', resolvedDate: null },
        { id: 'i2', storyPoints: null, status: 'OPEN', resolvedDate: null },
      ],
    }
    const db = { sprint: { findUnique: vi.fn().mockResolvedValue(sprint) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSprintBurndown('sprint-3')
    const data = (res as { data: any }).data
    expect(data.pointsMode).toBe(true)
    expect(data.totalPoints).toBe(5) // unestimated issue contributes 0, not 1
    // A single-day sprint (start === end) must not produce a phantom extra
    // day beyond the sprint's actual range, and the ideal line must not
    // divide by zero — it stays flat at totalPoints for the only day.
    expect(data.days).toHaveLength(1)
    expect(data.days[0].idealRemainingPoints).toBe(5)
  })

  it('handles an empty sprint (no issues assigned) without dividing by zero', async () => {
    const sprint = {
      id: 'sprint-4', sprintNumber: 4, name: null, status: 'PLANNING',
      startDate: new Date(2026, 3, 1), endDate: new Date(2026, 3, 3),
      issues: [],
    }
    const db = { sprint: { findUnique: vi.fn().mockResolvedValue(sprint) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSprintBurndown('sprint-4')
    const data = (res as { data: any }).data
    expect(data.issueCount).toBe(0)
    expect(data.totalPoints).toBe(0)
    expect(data.days.every((d: { remainingPoints: number }) => d.remainingPoints === 0)).toBe(true)
  })
})

describe('sprint.service.getProjectVelocity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('only counts COMPLETED sprints, sums completedPoints from RESOLVED/CLOSED issues only, and computes a correct average', async () => {
    const sprints = [
      {
        id: 's2', sprintNumber: 2, name: null,
        issues: [
          { storyPoints: 5, status: 'RESOLVED' },
          { storyPoints: 3, status: 'OPEN' }, // not completed — excluded from completedPoints but counted in totalPoints
        ],
      },
      {
        id: 's1', sprintNumber: 1, name: 'Kickoff',
        issues: [
          { storyPoints: 8, status: 'CLOSED' },
        ],
      },
    ]
    const db = { sprint: { findMany: vi.fn().mockResolvedValue(sprints) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getProjectVelocity('proj-1')
    expect(res.success).toBe(true)
    const data = (res as { data: any }).data
    expect(db.sprint.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { projectId: 'proj-1', status: 'COMPLETED' } }))
    expect(data.pointsMode).toBe(true)

    // Sorted ascending by sprintNumber for a natural trend line
    expect(data.sprints.map((s: any) => s.sprintNumber)).toEqual([1, 2])
    expect(data.sprints[0]).toMatchObject({ totalPoints: 8, completedPoints: 8 })
    expect(data.sprints[1]).toMatchObject({ totalPoints: 8, completedPoints: 5 })

    // avg velocity = (8 + 5) / 2 = 6.5
    expect(data.avgVelocity).toBe(6.5)
  })

  it('falls back to issue-count velocity when no sprint has any story points set', async () => {
    const sprints = [
      { id: 's1', sprintNumber: 1, name: null, issues: [{ storyPoints: null, status: 'CLOSED' }, { storyPoints: null, status: 'CLOSED' }] },
    ]
    const db = { sprint: { findMany: vi.fn().mockResolvedValue(sprints) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getProjectVelocity('proj-1')
    const data = (res as { data: any }).data
    expect(data.pointsMode).toBe(false)
    expect(data.sprints[0].completedPoints).toBe(2)
  })

  it('returns an empty, zero-average result for a project with no completed sprints yet', async () => {
    const db = { sprint: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getProjectVelocity('proj-1')
    const data = (res as { data: any }).data
    expect(data.sprints).toEqual([])
    expect(data.avgVelocity).toBe(0)
  })

  it('respects a custom limit and passes it through to the query', async () => {
    const db = { sprint: { findMany: vi.fn().mockResolvedValue([]) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await getProjectVelocity('proj-1', 3)
    expect(db.sprint.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }))
  })
})
