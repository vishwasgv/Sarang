import { requirePermission } from '../permission-guard'
import {
  listEngagements,
  createEngagement,
  updateEngagement,
  deleteEngagement,
  generateEngagementInvoice,
} from '../../services/engagement.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('engagement:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { clientId?: string; staffId?: string; status?: string; engagementType?: string }
    return listEngagements(payload)
  })

  handle('engagement:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { clientId: string; staffId?: string; title: string; engagementType?: string; feeType?: string; feeAmount?: number; billingDay?: number; startDate?: string; endDate?: string; notes?: string }
    return createEngagement(payload)
  })

  handle('engagement:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string; staffId?: string | null; title?: string; engagementType?: string; status?: string; feeType?: string; feeAmount?: number | null; billingDay?: number | null; startDate?: string | null; endDate?: string | null; notes?: string | null }
    return updateEngagement(payload)
  })

  handle('engagement:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const { id } = raw as { id: string }
    return deleteEngagement(id)
  })

  handle('engagement:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const { id, period } = raw as { id: string; period?: string }
    return generateEngagementInvoice(id, period)
  })
}
