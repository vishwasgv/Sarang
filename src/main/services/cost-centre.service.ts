import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

// Phase 65 — Reporting Tags / Cost & Profit Centres. A flat list (not a
// hierarchy like ChartOfAccounts) — see schema.prisma's own CostCentre
// comment for why. Every install starts with zero cost centres; the
// picker on Invoice/Bill/Expense/Employee forms only appears once at
// least one exists (hasAny below), so this is fully invisible until an
// owner opts in.
export const costCentreService = {
  async list() {
    const db = getPrisma()
    const costCentres = await db.costCentre.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] })
    return { success: true, data: costCentres }
  },

  async hasAny() {
    const db = getPrisma()
    const count = await db.costCentre.count({ where: { isActive: true } })
    return { success: true, data: count > 0 }
  },

  async create(payload: { name: string; code?: string }, userId?: string) {
    const db = getPrisma()
    const trimmed = payload.name.trim()
    if (!trimmed) return { success: false, error: { code: 'CC-001', message: 'Cost centre name is required.' } }
    const created = await db.costCentre.create({ data: { name: trimmed, code: payload.code?.trim() || null } })
    await logAction({ userId, action: 'COST_CENTRE_CREATE', entityType: 'CostCentre', entityId: created.id, newValue: created })
    return { success: true, data: created }
  },

  async update(id: string, payload: { name?: string; code?: string; isActive?: boolean }, userId?: string) {
    const db = getPrisma()
    const existing = await db.costCentre.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'CC-002', message: 'Cost centre not found.' } }
    const data: Record<string, unknown> = {}
    if (payload.name !== undefined) data.name = payload.name.trim()
    if (payload.code !== undefined) data.code = payload.code.trim() || null
    if (payload.isActive !== undefined) data.isActive = payload.isActive
    const updated = await db.costCentre.update({ where: { id }, data })
    await logAction({ userId, action: 'COST_CENTRE_UPDATE', entityType: 'CostCentre', entityId: id, oldValue: existing, newValue: updated })
    return { success: true, data: updated }
  }
}
