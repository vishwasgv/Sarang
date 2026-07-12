import { requirePermission } from '../permission-guard'
import { listHearings, createHearing, updateHearing, deleteHearing } from '../../services/hearing.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('hearing:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { caseId?: string; status?: string; fromDate?: string; toDate?: string }
    return listHearings(payload)
  })

  handle('hearing:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { caseId: string; hearingDate: string; hearingTime?: string; courtRoom?: string; purpose?: string; notes?: string }
    return createHearing(payload)
  })

  handle('hearing:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string; hearingDate?: string; hearingTime?: string | null; courtRoom?: string | null; purpose?: string | null; status?: string; outcome?: string | null; nextDate?: string | null; notes?: string | null }
    return updateHearing(payload)
  })

  handle('hearing:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string }
    return deleteHearing(payload.id)
  })
}
