import { postDatedChequeService } from '../../services/post-dated-cheque.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreatePDCSchema, UpdatePDCStatusSchema } from '../../validation/post-dated-cheque.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('postDatedCheques:create', async (payload) => {
    const deny = await requirePermission('postDatedCheques.manage'); if (deny) return deny
    const parsed = CreatePDCSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return postDatedChequeService.createPDC(parsed.data, getCurrentSession()?.userId)
  })

  handle('postDatedCheques:list', async (payload) => {
    const deny = await requirePermission('postDatedCheques.view'); if (deny) return deny
    return postDatedChequeService.listPDCs(payload as { bankAccountId?: string; status?: string; direction?: string; page?: number; limit?: number } | undefined)
  })

  handle('postDatedCheques:updateStatus', async (payload) => {
    const deny = await requirePermission('postDatedCheques.manage'); if (deny) return deny
    const parsed = UpdatePDCStatusSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return postDatedChequeService.updateStatus(parsed.data, getCurrentSession()?.userId)
  })
}
