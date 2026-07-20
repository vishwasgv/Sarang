import { requirePermission } from '../permission-guard'
import { listSprints, createSprint, updateSprint, deleteSprint, getSprintBurndown, getProjectVelocity } from '../../services/sprint.service'
import { CreateSprintSchema, UpdateSprintSchema, DeleteSprintSchema, SprintIdSchema, ProjectVelocitySchema } from '../../validation/sprint.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('sprint:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { projectId: string }
    return listSprints(payload.projectId)
  })

  handle('sprint:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateSprintSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createSprint(parsed.data)
  })

  handle('sprint:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateSprintSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateSprint(parsed.data)
  })

  handle('sprint:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = DeleteSprintSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteSprint(parsed.data.id)
  })

  // Phase 58 §2 — Software Agency: burndown/velocity

  handle('sprint:burndown', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = SprintIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return getSprintBurndown(parsed.data.sprintId)
  })

  handle('sprint:velocity', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = ProjectVelocitySchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return getProjectVelocity(parsed.data.projectId, parsed.data.limit)
  })
}
