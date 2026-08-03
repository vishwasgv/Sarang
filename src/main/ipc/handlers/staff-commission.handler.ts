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

// REAL BUG found+fixed 2026-08-03 (IPC auth-layer audit): listByStaff/
// listAll/monthlyReport/markPaid were gated on billing.createInvoice/
// billing.view — permissions Cashier holds for ordinary point-of-sale work,
// not a dedicated HR-tier permission. That let a Cashier open /commission
// and see every colleague's individual service revenue, commission rate/
// amount, and tips for any month, and call markPaid to flip any colleague's
// commission records to "Paid" with an arbitrary paid date — a payroll-
// integrity write with no HR-level trust check. Regated to hr.view (reads) /
// hr.manage (writes), matching hr.handler.ts's own read/write split for this
// exact class of data — Cashier and Staff hold neither (see seed.ts).
//
// `calculate` deliberately stays on billing.createInvoice — it's not called
// from the /commission screen at all, but auto-triggered as a routine,
// fire-and-forget side effect of AppointmentsScreen.tsx marking an
// appointment COMPLETED (appointments:updateStatus itself requires
// billing.createInvoice), which every Cashier does many times a day. Gating
// it behind hr.manage would silently stop commission from ever being
// calculated for any appointment a Cashier completes.
export function register(handle: HandleFn): void {
  handle('staffCommission:calculate', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CalculateCommissionSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return calculateCommission(parsed.data)
  })

  handle('staffCommission:listByStaff', async (raw) => {
    const deny = await requirePermission('hr.view'); if (deny) return deny
    const payload = raw as { staffId: string; period?: string }
    return listCommissionsByStaff(payload.staffId, payload.period)
  })

  handle('staffCommission:listAll', async (raw) => {
    const deny = await requirePermission('hr.view'); if (deny) return deny
    const payload = (raw ?? {}) as { period?: string; isPaid?: boolean; staffId?: string }
    return listAllCommissions(payload)
  })

  handle('staffCommission:markPaid', async (raw) => {
    const deny = await requirePermission('hr.manage'); if (deny) return deny
    const parsed = MarkCommissionsPaidSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return markCommissionsPaid(parsed.data.ids, parsed.data.paidDate)
  })

  handle('staffCommission:monthlyReport', async (raw) => {
    const deny = await requirePermission('hr.view'); if (deny) return deny
    const payload = (raw ?? {}) as { period?: string }
    return getMonthlyCommissionReport(payload.period)
  })
}
