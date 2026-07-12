import * as returnsService from '../../services/returns.service'
import { cashCloseService } from '../../services/cash-close.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateReturnSchema, CashCloseCreateSchema } from '../../validation/operations.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('returns:create', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateReturnSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return returnsService.createReturn(parsed.data.originalInvoiceId, parsed.data.items, parsed.data.reason, getCurrentSession()?.userId)
  })

  handle('returns:list', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const p = (payload ?? {}) as { originalInvoiceId?: string }
    return returnsService.listReturns(p.originalInvoiceId)
  })

  handle('returns:todaySummary', async () => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return returnsService.getTodayReturnsSummary()
  })

  handle('cashClose:getSummary', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const p = (payload ?? {}) as { date?: string }
    return cashCloseService.getDrawerSummary(p.date)
  })

  handle('cashClose:create', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CashCloseCreateSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return cashCloseService.create(parsed.data, getCurrentSession()?.userId)
  })

  handle('cashClose:list', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const p = (payload ?? {}) as { dateFrom?: string; dateTo?: string; page?: number; limit?: number }
    return cashCloseService.list(p)
  })
}
