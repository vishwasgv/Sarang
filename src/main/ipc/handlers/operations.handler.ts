import * as returnsService from '../../services/returns.service'
import { cashCloseService } from '../../services/cash-close.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('returns:create', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const { originalInvoiceId, items, reason } = payload as { originalInvoiceId: string; items: Array<{ productId: string; quantity: number }>; reason: string }
    if (!originalInvoiceId) return { success: false, error: { code: 'VAL-001', message: 'originalInvoiceId is required.' } }
    if (!Array.isArray(items) || !items.length) return { success: false, error: { code: 'VAL-001', message: 'items are required.' } }
    return returnsService.createReturn(originalInvoiceId, items, reason, getCurrentSession()?.userId)
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
    const p = payload as { date: string; actualCash: number; notes?: string }
    if (!p?.date || typeof p.actualCash !== 'number') {
      return { success: false, error: { code: 'VAL-001', message: 'date and actualCash are required.' } }
    }
    return cashCloseService.create(p, getCurrentSession()?.userId)
  })

  handle('cashClose:list', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const p = (payload ?? {}) as { dateFrom?: string; dateTo?: string; page?: number; limit?: number }
    return cashCloseService.list(p)
  })
}
