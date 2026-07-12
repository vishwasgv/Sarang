import { listBatches, createBatch, updateBatch, deleteBatch, getExpiryAlerts } from '../../services/batch.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('batches:list', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    return listBatches(payload as Parameters<typeof listBatches>[0])
  })

  handle('batches:create', async (payload) => {
    const deny = await requirePermission('inventory.addStock'); if (deny) return deny
    return createBatch(payload as Parameters<typeof createBatch>[0], getCurrentSession()?.userId)
  })

  handle('batches:update', async (payload) => {
    const deny = await requirePermission('inventory.adjustStock'); if (deny) return deny
    return updateBatch(payload as Parameters<typeof updateBatch>[0], getCurrentSession()?.userId)
  })

  handle('batches:delete', async (payload) => {
    const deny = await requirePermission('inventory.adjustStock'); if (deny) return deny
    const p = (payload ?? {}) as { id: string }
    return deleteBatch(p.id, getCurrentSession()?.userId)
  })

  handle('batches:expiryAlerts', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    const p = (payload ?? {}) as { withinDays?: number }
    return getExpiryAlerts(p.withinDays ?? 30)
  })
}
