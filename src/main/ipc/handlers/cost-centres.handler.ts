import { costCentreService } from '../../services/cost-centre.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateCostCentreSchema, UpdateCostCentreSchema } from '../../validation/cost-centre.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

// Phase 65 — Reporting Tags / Cost & Profit Centres. costCentres.manage
// (create/update) is Admin-only, costCentres.view is Manager-tier —
// mirrors locations.handler.ts's own established split exactly (a
// structural setup action vs. everyday viewing).
export function register(handle: HandleFn): void {
  handle('costCentres:list', async () => {
    const deny = await requirePermission('costCentres.view'); if (deny) return deny
    return costCentreService.list()
  })

  handle('costCentres:hasAny', async () => {
    const deny = await requirePermission('costCentres.view'); if (deny) return deny
    return costCentreService.hasAny()
  })

  handle('costCentres:create', async (payload) => {
    const deny = await requirePermission('costCentres.manage'); if (deny) return deny
    const parsed = CreateCostCentreSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return costCentreService.create(parsed.data, getCurrentSession()?.userId)
  })

  handle('costCentres:update', async (payload) => {
    const deny = await requirePermission('costCentres.manage'); if (deny) return deny
    const parsed = UpdateCostCentreSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const { id, ...rest } = parsed.data
    return costCentreService.update(id, rest, getCurrentSession()?.userId)
  })
}
