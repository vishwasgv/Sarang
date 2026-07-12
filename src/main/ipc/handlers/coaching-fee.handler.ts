import { requirePermission } from '../permission-guard'
import { generateMonthlyFees, listFees, getFeeKPIs, updateFeeRecord } from '../../services/coaching-fee.service'
import { GenerateMonthlyFeesSchema, UpdateFeeRecordSchema } from '../../validation/coaching-fee.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('coachingFee:generate', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = GenerateMonthlyFeesSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return generateMonthlyFees(parsed.data.month, parsed.data.taxRate ?? 0)
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
    const parsed = UpdateFeeRecordSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateFeeRecord(parsed.data)
  })
}
