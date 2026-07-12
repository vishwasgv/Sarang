import { requirePermission } from '../permission-guard'
import { listBatches, createBatch, updateBatch, deleteBatch, getBatchKPIs } from '../../services/coaching-batch.service'
import { CreateCoachingBatchSchema, UpdateCoachingBatchSchema, CoachingBatchIdSchema } from '../../validation/coaching-batch.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('coachingBatch:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { status?: string; search?: string }
    return listBatches(payload)
  })

  handle('coachingBatch:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateCoachingBatchSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createBatch(parsed.data)
  })

  handle('coachingBatch:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateCoachingBatchSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateBatch(parsed.data)
  })

  handle('coachingBatch:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CoachingBatchIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteBatch(parsed.data.id)
  })

  handle('coachingBatch:kpis', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getBatchKPIs()
  })
}
