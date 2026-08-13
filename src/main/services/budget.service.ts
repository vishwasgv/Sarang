import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

// Phase 65 — Budget vs. Actual. A Budget row is a plain planning figure, not
// a financial transaction — no GL posting, no append-only ledger semantics.
// Real deduplication happens here (not a DB constraint — see
// budget.validation.ts's own comment on why): creating a second budget for
// the exact same (costCentreId, accountId, periodYear, periodMonth) scope
// is rejected in favor of updating the existing row, so "how much did I
// budget for X this month" always has exactly one answer.
export const budgetService = {
  async list(filters?: { periodYear?: number; periodMonth?: number; costCentreId?: string }) {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
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

  async create(payload: { costCentreId?: string; accountId?: string; periodYear: number; periodMonth: number; amount: number; notes?: string }, userId?: string) {
    const db = getPrisma()
    const costCentreId = payload.costCentreId ?? null
    const accountId = payload.accountId ?? null
    const existing = await db.budget.findFirst({
      where: { costCentreId, accountId, periodYear: payload.periodYear, periodMonth: payload.periodMonth }
    })
    if (existing) {
      return { success: false, error: { code: 'BUD-001', message: 'A budget already exists for this exact scope and period — edit it instead of creating a duplicate.' } }
    }
    const created = await db.budget.create({
      data: { costCentreId, accountId, periodYear: payload.periodYear, periodMonth: payload.periodMonth, amount: payload.amount, notes: payload.notes?.trim() || null, createdById: userId ?? null }
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
