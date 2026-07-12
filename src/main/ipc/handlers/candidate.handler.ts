import {
  listCandidates, getCandidate, createCandidate, updateCandidate, deleteCandidate
} from '../../services/candidate.service'
import { requirePermission } from '../permission-guard'
import { CandidateIdSchema, CreateCandidateSchema, UpdateCandidateSchema } from '../../validation/candidate.validation'

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
    const parsed = CreateCandidateSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createCandidate(parsed.data)
  })

  handle('candidate:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateCandidateSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateCandidate(parsed.data)
  })

  handle('candidate:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CandidateIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteCandidate(parsed.data)
  })
}
