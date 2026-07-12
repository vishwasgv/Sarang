import { requirePermission } from '../permission-guard'
import { generateMonthlyFees, listFees, getFeeKPIs, updateFeeRecord } from '../../services/coaching-fee.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('coachingFee:generate', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { month: string; taxRate?: number }
    return generateMonthlyFees(payload.month, payload.taxRate ?? 0)
  })

  handle('coachingFee:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { month?: string; status?: string; batchId?: string; studentId?: string }
    return listFees(payload)
  })

  handle('coachingFee:kpis', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { month: string }
    return getFeeKPIs(payload.month)
  })

  handle('coachingFee:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as {
      id: string; amountReceived?: number; status?: string; paidDate?: string | null; notes?: string | null
    }
    return updateFeeRecord(payload)
  })
}
