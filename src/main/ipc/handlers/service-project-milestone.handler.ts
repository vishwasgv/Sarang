import { requirePermission } from '../permission-guard'
import { listMilestones, createMilestone, updateMilestone, deleteMilestone, generateMilestoneInvoice } from '../../services/service-project-milestone.service'
import { CreateMilestoneSchema, UpdateMilestoneSchema, MilestoneIdSchema } from '../../validation/service-project-milestone.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('milestone:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { projectId: string }
    return listMilestones(payload.projectId)
  })

  handle('milestone:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateMilestoneSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createMilestone(parsed.data)
  })

  handle('milestone:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateMilestoneSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateMilestone(parsed.data)
  })

  handle('milestone:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = MilestoneIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteMilestone(parsed.data.id)
  })

  handle('milestone:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = MilestoneIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return generateMilestoneInvoice(parsed.data.id)
  })
}
