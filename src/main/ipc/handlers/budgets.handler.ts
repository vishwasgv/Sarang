import { budgetService } from '../../services/budget.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateBudgetSchema, UpdateBudgetSchema, DeleteBudgetSchema, ListBudgetsSchema } from '../../validation/budget.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

// Phase 65 — Budget vs. Actual. Both view and manage are Manager-tier —
// unlike a Cost Centre (a one-time structural tag, Admin-only), setting or
// adjusting a monthly budget is itself a routine planning task, matching
// inventory.adjustStock's own Manager-tier trust level.
export function register(handle: HandleFn): void {
  handle('budgets:list', async (payload) => {
    const deny = await requirePermission('budgets.view'); if (deny) return deny
    const parsed = ListBudgetsSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return budgetService.list(parsed.data)
  })

  handle('budgets:create', async (payload) => {
    const deny = await requirePermission('budgets.manage'); if (deny) return deny
    const parsed = CreateBudgetSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return budgetService.create(parsed.data, getCurrentSession()?.userId)
  })

  handle('budgets:update', async (payload) => {
    const deny = await requirePermission('budgets.manage'); if (deny) return deny
    const parsed = UpdateBudgetSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const { id, ...rest } = parsed.data
    return budgetService.update(id, rest, getCurrentSession()?.userId)
  })

  handle('budgets:delete', async (payload) => {
    const deny = await requirePermission('budgets.manage'); if (deny) return deny
    const parsed = DeleteBudgetSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return budgetService.delete(parsed.data.id, getCurrentSession()?.userId)
  })
}
