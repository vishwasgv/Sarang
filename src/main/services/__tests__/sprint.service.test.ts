import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn().mockResolvedValue(undefined) }))

import { getPrisma } from '../../database/db'
import { getSprintBurndown, getProjectVelocity } from '../sprint.service'

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
