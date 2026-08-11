import { yearEndCloseService } from '../../services/year-end-close.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CloseFinancialYearSchema } from '../../validation/year-end-close.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('yearEndClose:execute', async (payload) => {
    const deny = await requirePermission('yearEndClose.execute'); if (deny) return deny
    const parsed = CloseFinancialYearSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return yearEndCloseService.closeFinancialYear(parsed.data, getCurrentSession()?.userId)
  })
}
