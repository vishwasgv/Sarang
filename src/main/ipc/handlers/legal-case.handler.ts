import { requirePermission } from '../permission-guard'
import {
  listLegalCases,
  getLegalCase,
  createLegalCase,
  updateLegalCase,
  deleteLegalCase,
} from '../../services/legal-case.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('legalCase:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { status?: string; clientId?: string; advocateId?: string; search?: string }
    return listLegalCases(payload)
  })

  handle('legalCase:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { id: string }
    return getLegalCase(payload.id)
  })

  handle('legalCase:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { caseNumber: string; caseTitle: string; caseType?: string; courtName: string; courtDistrict?: string; courtState?: string; eCourtId?: string; clientId: string; advocateId?: string; filingDate?: string; feeAgreed?: number; notes?: string }
    return createLegalCase(payload)
  })

  handle('legalCase:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string; caseNumber?: string; caseTitle?: string; caseType?: string; courtName?: string; courtDistrict?: string | null; courtState?: string | null; eCourtId?: string | null; advocateId?: string | null; status?: string; filingDate?: string | null; nextHearingDate?: string | null; feeAgreed?: number | null; feeCollected?: number; notes?: string | null }
    return updateLegalCase(payload)
  })

  handle('legalCase:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string }
    return deleteLegalCase(payload.id)
  })
}
