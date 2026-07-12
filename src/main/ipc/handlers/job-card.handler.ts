import { listJobCards, createJobCard, updateJobCard, deleteJobCard } from '../../services/job-card.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('jobCards:list', async (payload) => {
    const deny = await requirePermission('sales.view'); if (deny) return deny
    return listJobCards(payload as Parameters<typeof listJobCards>[0])
  })

  handle('jobCards:create', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    return createJobCard(payload as Parameters<typeof createJobCard>[0], getCurrentSession()?.userId)
  })

  handle('jobCards:update', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    return updateJobCard(payload as Parameters<typeof updateJobCard>[0], getCurrentSession()?.userId)
  })

  handle('jobCards:delete', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    const p = payload as { id: string }
    return deleteJobCard(p.id, getCurrentSession()?.userId)
  })
}
