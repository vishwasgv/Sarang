import { requirePermission } from '../permission-guard'
import { listComplianceEvents, setClientAgmDate } from '../../services/compliance-event.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('complianceEvent:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { category?: string; isActive?: boolean }
    return listComplianceEvents(payload)
  })

  handle('complianceEvent:setClientAgmDate', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { clientId: string; agmDate: string | null }
    if (!payload?.clientId) return { success: false, error: { code: 'VAL-001', message: 'Client is required.' } }
    return setClientAgmDate(payload.clientId, payload.agmDate ?? null)
  })
}
