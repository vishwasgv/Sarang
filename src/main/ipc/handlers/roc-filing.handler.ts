import { requirePermission } from '../permission-guard'
import {
  listROCFilings,
  createROCFiling,
  updateROCFiling,
  deleteROCFiling,
} from '../../services/roc-filing.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('rocFiling:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { clientId?: string; staffId?: string; status?: string; formType?: string; financialYear?: string }
    return listROCFilings(payload)
  })

  handle('rocFiling:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { clientId: string; staffId?: string; formType: string; financialYear?: string; purpose?: string; dueDate?: string; govtFee?: number; notes?: string }
    return createROCFiling(payload)
  })

  handle('rocFiling:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string; staffId?: string | null; formType?: string; financialYear?: string | null; purpose?: string | null; dueDate?: string | null; filedOn?: string | null; srn?: string | null; status?: string; govtFee?: number | null; notes?: string | null }
    return updateROCFiling(payload)
  })

  handle('rocFiling:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const { id } = raw as { id: string }
    return deleteROCFiling(id)
  })
}
