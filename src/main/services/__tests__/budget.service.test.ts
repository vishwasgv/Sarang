import { describe, it, expect, vi } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { budgetService } from '../budget.service'

function makeBudget(overrides: Record<string, unknown> = {}) {
  return {
    id: 'bud-1', costCentreId: 'cc-1', accountId: null, periodYear: 2026, periodMonth: 8,
    amount: 50000, notes: null, createdById: 'user-1',
    costCentre: { id: 'cc-1', name: 'Marketing' }, account: null,
    ...overrides
  }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  const db = {
    budget: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(makeBudget()),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    ...overrides
  } as Record<string, any>
  vi.mocked(getPrisma).mockReturnValue(db as never)
  return db
}

describe('budgetService.create', () => {
  it('creates a new budget for a fresh scope+period', async () => {
    const db = makeDb()
    const result = await budgetService.create({ costCentreId: 'cc-1', periodYear: 2026, periodMonth: 8, amount: 50000 }, 'user-1')
    expect(result.success).toBe(true)
    expect(db.budget.create).toHaveBeenCalledWith({
      data: { costCentreId: 'cc-1', accountId: null, periodYear: 2026, periodMonth: 8, amount: 50000, notes: null, createdById: 'user-1' }
    })
  })

  it('rejects a duplicate budget for the exact same scope and period (BUD-001)', async () => {
    const db = makeDb({ budget: { findFirst: vi.fn().mockResolvedValue(makeBudget()), create: vi.fn() } })
    const result = await budgetService.create({ costCentreId: 'cc-1', periodYear: 2026, periodMonth: 8, amount: 60000 })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('BUD-001')
    expect(db.budget.create).not.toHaveBeenCalled()
  })

  it('allows two budgets in the same period with different scopes (different cost centres)', async () => {
    const db = makeDb({
      budget: {
        findFirst: vi.fn().mockImplementation(({ where }: { where: { costCentreId: string | null } }) =>
          Promise.resolve(where.costCentreId === 'cc-1' ? makeBudget() : null)
        ),
        create: vi.fn().mockResolvedValue(makeBudget({ id: 'bud-2', costCentreId: 'cc-2' }))
      }
    })
    const result = await budgetService.create({ costCentreId: 'cc-2', periodYear: 2026, periodMonth: 8, amount: 30000 })
    expect(result.success).toBe(true)
    expect(db.budget.create).toHaveBeenCalledOnce()
  })

  it('treats a company-wide budget (no costCentreId/accountId) as its own valid scope', async () => {
    const db = makeDb({ budget: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(makeBudget({ costCentreId: null })) } })
    const result = await budgetService.create({ periodYear: 2026, periodMonth: 8, amount: 100000 })
    expect(result.success).toBe(true)
    const createCall = db.budget.create.mock.calls[0][0]
    expect(createCall.data.costCentreId).toBeNull()
    expect(createCall.data.accountId).toBeNull()
  })
})

describe('budgetService.update', () => {
  it('updates the amount and notes of an existing budget', async () => {
    const db = makeDb({
      budget: {
        findUnique: vi.fn().mockResolvedValue(makeBudget()),
        update: vi.fn().mockResolvedValue(makeBudget({ amount: 55000, notes: 'Revised up' }))
      }
    })
    const result = await budgetService.update('bud-1', { amount: 55000, notes: 'Revised up' })
    expect(result.success).toBe(true)
    expect(db.budget.update).toHaveBeenCalledWith({ where: { id: 'bud-1' }, data: { amount: 55000, notes: 'Revised up' } })
  })

  it('returns a not-found error for an unknown budget id', async () => {
    makeDb({ budget: { findUnique: vi.fn().mockResolvedValue(null) } })
    const result = await budgetService.update('missing', { amount: 1000 })
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('BUD-002')
  })
})

describe('budgetService.delete', () => {
  it('deletes an existing budget', async () => {
    const db = makeDb({ budget: { findUnique: vi.fn().mockResolvedValue(makeBudget()), delete: vi.fn().mockResolvedValue({}) } })
    const result = await budgetService.delete('bud-1')
    expect(result.success).toBe(true)
    expect(db.budget.delete).toHaveBeenCalledWith({ where: { id: 'bud-1' } })
  })

  it('returns a not-found error for an unknown budget id', async () => {
    makeDb({ budget: { findUnique: vi.fn().mockResolvedValue(null) } })
    const result = await budgetService.delete('missing')
    expect(result.success).toBe(false)
    expect((result as { error: { code: string } }).error.code).toBe('BUD-002')
  })
})

describe('budgetService.list', () => {
  it('filters by period and cost centre when given', async () => {
    const db = makeDb({ budget: { findMany: vi.fn().mockResolvedValue([makeBudget()]) } })
    const result = await budgetService.list({ periodYear: 2026, periodMonth: 8, costCentreId: 'cc-1' })
    expect(result.success).toBe(true)
    expect(db.budget.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { periodYear: 2026, periodMonth: 8, costCentreId: 'cc-1' }
    }))
  })
})
