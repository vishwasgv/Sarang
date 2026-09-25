import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { budgetService, scaleAmount } from '../budget.service'

const src = [
  { costCentreId: null, accountId: 'a1', periodYear: 2026, periodMonth: 9, amount: 1000, notes: null },
  { costCentreId: 'c1', accountId: null, periodYear: 2026, periodMonth: 10, amount: 333.33, notes: 'x' }
]

function makeDb(existingCopies = 0) {
  return {
    budget: {
      findMany: vi.fn().mockResolvedValue(src),
      count: vi.fn().mockResolvedValue(existingCopies),
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'b1' }),
      groupBy: vi.fn().mockResolvedValue([{ scenario: 'Base' }, { scenario: 'Optimistic' }])
    }
  }
}

describe('budget scenarios', () => {
  beforeEach(() => vi.clearAllMocks())

  it('scales to two decimals and never below a cent', () => {
    expect(scaleAmount(1000, 10)).toBe(1100)
    expect(scaleAmount(333.33, -10)).toBe(300)
    expect(scaleAmount(0.01, -50)).toBe(0.01)
  })

  it('copies a scenario with the percent change', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const r = await budgetService.copyScenario({ from: 'Base', to: 'Optimistic', percent: 10 })
    expect(r.success).toBe(true)
    const rows = db.budget.createMany.mock.calls[0][0].data
    expect(rows.map((x: { amount: number }) => x.amount)).toEqual([1100, 366.66])
    expect(rows.every((x: { scenario: string }) => x.scenario === 'Optimistic')).toBe(true)
  })

  it('refuses copying onto a scenario that already has budgets, or onto itself', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb(3) as never)
    expect((await budgetService.copyScenario({ from: 'Base', to: 'Optimistic', percent: 0 })).success).toBe(false)
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)
    expect((await budgetService.copyScenario({ from: 'Base', to: 'base', percent: 0 })).success).toBe(false)
  })

  it('duplicate check is per scenario', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    await budgetService.create({ periodYear: 2026, periodMonth: 9, amount: 5, scenario: 'Pessimistic' })
    expect(db.budget.findFirst.mock.calls[0][0].where.scenario).toBe('Pessimistic')
  })

  it('lists scenario names with Base first', async () => {
    vi.mocked(getPrisma).mockReturnValue(makeDb() as never)
    const r = await budgetService.scenarios()
    expect((r as { data: string[] }).data).toEqual(['Base', 'Optimistic'])
  })
})
