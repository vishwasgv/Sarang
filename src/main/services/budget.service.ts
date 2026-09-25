import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

// Phase 65 — Budget vs. Actual. A Budget row is a plain planning figure, not
// a financial transaction — no GL posting, no append-only ledger semantics.
// Real deduplication happens here (not a DB constraint — see
// budget.validation.ts's own comment on why): creating a second budget for
// the exact same (costCentreId, accountId, periodYear, periodMonth) scope
// is rejected in favor of updating the existing row, so "how much did I
// budget for X this month" always has exactly one answer.
export const BASE_SCENARIO = 'Base'

/** Scales a budget by a percent change, two decimals, never below one cent. */
export function scaleAmount(amount: number, percent: number): number {
  return Math.max(0.01, Math.round(amount * (100 + percent)) / 100)
}

export const budgetService = {
  async scenarios() {
    const db = getPrisma()
    const rows = await db.budget.groupBy({ by: ['scenario'] })
    const names = rows.map((r) => r.scenario).filter((n) => n !== BASE_SCENARIO).sort()
    return { success: true, data: [BASE_SCENARIO, ...names] }
  },

  /** Copies every budget of one scenario into a new one, raised or lowered by a percent. */
  async copyScenario(p: { from: string; to: string; percent: number }, userId?: string) {
    const db = getPrisma()
    const to = p.to.trim().slice(0, 40)
    if (!to) return { success: false, error: { code: 'BUD-010', message: 'Give the new scenario a name.' } }
    if (to.toLowerCase() === p.from.trim().toLowerCase()) return { success: false, error: { code: 'BUD-011', message: 'Choose a different name for the new scenario.' } }
    if (!(p.percent > -100 && p.percent <= 1000)) return { success: false, error: { code: 'BUD-012', message: 'The change must be between -99% and 1000%.' } }
    if (await db.budget.count({ where: { scenario: to } }) > 0) return { success: false, error: { code: 'BUD-013', message: 'A scenario with that name already exists.' } }
    const source = await db.budget.findMany({ where: { scenario: p.from } })
    if (source.length === 0) return { success: false, error: { code: 'BUD-014', message: 'There are no budgets in the scenario you are copying.' } }
    await db.budget.createMany({
      data: source.map((s) => ({
        costCentreId: s.costCentreId, accountId: s.accountId, periodYear: s.periodYear, periodMonth: s.periodMonth,
        amount: scaleAmount(s.amount, p.percent), notes: s.notes, scenario: to, createdById: userId ?? null
      }))
    })
    await logAction({ userId, action: 'BUDGET_SCENARIO_COPIED', entityType: 'Budget', entityId: to, newValue: { from: p.from, to, percent: p.percent, rows: source.length } })
    return { success: true, data: { copied: source.length } }
  },

  async list(filters?: { periodYear?: number; periodMonth?: number; costCentreId?: string; scenario?: string }) {
    const db = getPrisma()
    const where: Record<string, unknown> = { scenario: filters?.scenario ?? BASE_SCENARIO }
    if (filters?.periodYear !== undefined) where.periodYear = filters.periodYear
    if (filters?.periodMonth !== undefined) where.periodMonth = filters.periodMonth
    if (filters?.costCentreId !== undefined) where.costCentreId = filters.costCentreId
    const budgets = await db.budget.findMany({
      where,
      include: { costCentre: { select: { id: true, name: true } }, account: { select: { id: true, accountCode: true, accountName: true } } },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }]
    })
    return { success: true, data: budgets }
  },

  async create(payload: { costCentreId?: string; accountId?: string; periodYear: number; periodMonth: number; amount: number; notes?: string; scenario?: string }, userId?: string) {
    const db = getPrisma()
    const costCentreId = payload.costCentreId ?? null
    const accountId = payload.accountId ?? null
    const scenario = payload.scenario ?? BASE_SCENARIO
    const existing = await db.budget.findFirst({
      where: { costCentreId, accountId, periodYear: payload.periodYear, periodMonth: payload.periodMonth, scenario }
    })
    if (existing) {
      return { success: false, error: { code: 'BUD-001', message: 'A budget already exists for this exact scope and period — edit it instead of creating a duplicate.' } }
    }
    const created = await db.budget.create({
      data: { costCentreId, accountId, periodYear: payload.periodYear, periodMonth: payload.periodMonth, amount: payload.amount, notes: payload.notes?.trim() || null, scenario, createdById: userId ?? null }
    })
    await logAction({ userId, action: 'BUDGET_CREATE', entityType: 'Budget', entityId: created.id, newValue: created })
    return { success: true, data: created }
  },

  async update(id: string, payload: { amount?: number; notes?: string }, userId?: string) {
    const db = getPrisma()
    const existing = await db.budget.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'BUD-002', message: 'Budget not found.' } }
    const data: Record<string, unknown> = {}
    if (payload.amount !== undefined) data.amount = payload.amount
    if (payload.notes !== undefined) data.notes = payload.notes.trim() || null
    const updated = await db.budget.update({ where: { id }, data })
    await logAction({ userId, action: 'BUDGET_UPDATE', entityType: 'Budget', entityId: id, oldValue: existing, newValue: updated })
    return { success: true, data: updated }
  },

  async delete(id: string, userId?: string) {
    const db = getPrisma()
    const existing = await db.budget.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'BUD-002', message: 'Budget not found.' } }
    await db.budget.delete({ where: { id } })
    await logAction({ userId, action: 'BUDGET_DELETE', entityType: 'Budget', entityId: id, oldValue: existing })
    return { success: true, data: { id } }
  }
}
