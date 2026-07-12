import { requirePermission } from '../permission-guard'
import {
  calculateCommission,
  listCommissionsByStaff,
  listAllCommissions,
  markCommissionsPaid,
  getMonthlyCommissionReport,
} from '../../services/staff-commission.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('staffCommission:calculate', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { appointmentId: string; staffId: string; serviceRevenue: number; commissionType: 'PERCENT' | 'FLAT'; commissionRate: number; tipAmount?: number; period?: string }
    return calculateCommission(payload)
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
    const payload = raw as { ids: string[]; paidDate?: string }
    return markCommissionsPaid(payload.ids, payload.paidDate)
  })

  handle('staffCommission:monthlyReport', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { period?: string }
    return getMonthlyCommissionReport(payload.period)
  })
}
