import { requirePermission } from '../permission-guard'
import {
  calculateCommission,
  listCommissionsByStaff,
  listAllCommissions,
  markCommissionsPaid,
  getMonthlyCommissionReport,
} from '../../services/staff-commission.service'
import { CalculateCommissionSchema, MarkCommissionsPaidSchema } from '../../validation/staff-commission.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('staffCommission:calculate', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CalculateCommissionSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return calculateCommission(parsed.data)
  })

  handle('staffCommission:listByStaff', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { staffId: string; period?: string }
    return listCommissionsByStaff(payload.staffId, payload.period)
  })

  handle('staffCommission:listAll', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { period?: string; isPaid?: boolean; staffId?: string }
    return listAllCommissions(payload)
  })

  handle('staffCommission:markPaid', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = MarkCommissionsPaidSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return markCommissionsPaid(parsed.data.ids, parsed.data.paidDate)
  })

  handle('staffCommission:monthlyReport', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { period?: string }
    return getMonthlyCommissionReport(payload.period)
  })
}
