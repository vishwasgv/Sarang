import { requirePermission } from '../permission-guard'
import { listLeads, createLead, updateLead, deleteLead } from '../../services/lead.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('lead:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { status?: string; assignedToId?: string }
    return listLeads(payload)
  })

  handle('lead:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { fullName: string; email?: string; phone?: string; companyName?: string; source?: string; status?: string; estimatedValue?: number; assignedToId?: string; notes?: string }
    return createLead(payload)
  })

  handle('lead:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string; fullName?: string; email?: string | null; phone?: string | null; companyName?: string | null; source?: string; status?: string; estimatedValue?: number | null; assignedToId?: string | null; convertedClientId?: string | null; notes?: string | null }
    return updateLead(payload)
  })

  handle('lead:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string }
    return deleteLead(payload.id)
  })
}
