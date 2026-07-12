import { requirePermission } from '../permission-guard'
import { listComplianceEvents } from '../../services/compliance-event.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('complianceEvent:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { category?: string; isActive?: boolean }
    return listComplianceEvents(payload)
  })
}
