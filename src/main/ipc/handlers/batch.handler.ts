import { listBatches, createBatch, updateBatch, deleteBatch, getExpiryAlerts } from '../../services/batch.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateBatchSchema, UpdateBatchSchema, DeleteBatchSchema } from '../../validation/batch.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('batches:list', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    return listBatches(payload as Parameters<typeof listBatches>[0])
  })

  handle('batches:create', async (payload) => {
    const deny = await requirePermission('inventory.addStock'); if (deny) return deny
    const parsed = CreateBatchSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createBatch(parsed.data, getCurrentSession()?.userId)
  })

  handle('batches:update', async (payload) => {
    const deny = await requirePermission('inventory.adjustStock'); if (deny) return deny
    const parsed = UpdateBatchSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateBatch(parsed.data, getCurrentSession()?.userId)
  })

  handle('batches:delete', async (payload) => {
    const deny = await requirePermission('inventory.adjustStock'); if (deny) return deny
    const parsed = DeleteBatchSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteBatch(parsed.data.id, getCurrentSession()?.userId)
  })

  handle('batches:expiryAlerts', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    const p = (payload ?? {}) as { withinDays?: number }
    return getExpiryAlerts(p.withinDays ?? 30)
  })
}
