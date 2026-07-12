import {
  listCandidates, getCandidate, createCandidate, updateCandidate, deleteCandidate
} from '../../services/candidate.service'
import { requirePermission } from '../permission-guard'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerCandidate(handle: HandleFn): void {
  handle('candidate:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listCandidates(raw as Parameters<typeof listCandidates>[0])
  })

  handle('candidate:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getCandidate(raw as string)
  })

  handle('candidate:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return createCandidate(raw as Parameters<typeof createCandidate>[0])
  })

  handle('candidate:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return updateCandidate(raw as Parameters<typeof updateCandidate>[0])
  })

  handle('candidate:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return deleteCandidate(raw as string)
  })
}
