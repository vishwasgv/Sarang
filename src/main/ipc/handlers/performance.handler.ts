import { requirePermission } from '../permission-guard'
import { listPerformances, createPerformance, updatePerformance, deletePerformance } from '../../services/performance.service'
import { CreatePerformanceSchema, UpdatePerformanceSchema } from '../../validation/performance.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('performance:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { batchId?: string }
    return listPerformances(payload)
  })

  handle('performance:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreatePerformanceSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createPerformance(parsed.data)
  })

  handle('performance:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdatePerformanceSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updatePerformance(parsed.data)
  })

  handle('performance:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string }
    return deletePerformance(payload.id)
  })
}
