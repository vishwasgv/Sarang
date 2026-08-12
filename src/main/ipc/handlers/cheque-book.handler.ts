import { chequeBookService } from '../../services/cheque-book.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateChequeBookSchema } from '../../validation/cheque-book.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

// Same trust tier as postDatedCheques — a cheque book is part of the same PDC
// feature, not a separate structural ledger action.
export function register(handle: HandleFn): void {
  handle('chequeBooks:create', async (payload) => {
    const deny = await requirePermission('postDatedCheques.manage'); if (deny) return deny
    const parsed = CreateChequeBookSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return chequeBookService.createChequeBook(parsed.data, getCurrentSession()?.userId)
  })

  handle('chequeBooks:list', async (payload) => {
    const deny = await requirePermission('postDatedCheques.view'); if (deny) return deny
    return chequeBookService.listChequeBooks(payload as string | undefined)
  })

  handle('chequeBooks:getNextNumber', async (payload) => {
    const deny = await requirePermission('postDatedCheques.view'); if (deny) return deny
    return chequeBookService.getNextChequeNumber(payload as string)
  })

  handle('chequeBooks:setActive', async (payload) => {
    const deny = await requirePermission('postDatedCheques.manage'); if (deny) return deny
    const p = payload as { id: string; isActive: boolean }
    return chequeBookService.setActive(p.id, p.isActive, getCurrentSession()?.userId)
  })
}
