import { listSiteVisits, createSiteVisit, updateSiteVisit, deleteSiteVisit } from '../../services/site-visit.service'
import { requirePermission } from '../permission-guard'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('siteVisit:list', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const { projectId } = payload as { projectId: string }
    return listSiteVisits(projectId)
  })

  handle('siteVisit:create', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return createSiteVisit(payload as Parameters<typeof createSiteVisit>[0])
  })

  handle('siteVisit:update', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return updateSiteVisit(payload as Parameters<typeof updateSiteVisit>[0])
  })

  handle('siteVisit:delete', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const { id } = payload as { id: string }
    return deleteSiteVisit(id)
  })
}
