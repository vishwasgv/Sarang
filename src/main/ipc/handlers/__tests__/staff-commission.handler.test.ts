import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../permission-guard', () => ({ requirePermission: vi.fn() }))
vi.mock('../../../services/staff-commission.service', () => ({
  calculateCommission: vi.fn().mockResolvedValue({ success: true, data: {} }),
  listCommissionsByStaff: vi.fn().mockResolvedValue({ success: true, data: [] }),
  listAllCommissions: vi.fn().mockResolvedValue({ success: true, data: [] }),
  markCommissionsPaid: vi.fn().mockResolvedValue({ success: true }),
  getMonthlyCommissionReport: vi.fn().mockResolvedValue({ success: true, data: [] }),
}))

import { requirePermission } from '../../permission-guard'
import { register } from '../staff-commission.handler'

// REAL BUG found+fixed 2026-08-03 (IPC auth-layer audit): listByStaff/
// listAll/monthlyReport/markPaid were gated on billing.createInvoice/
// billing.view — permissions Cashier holds for ordinary point-of-sale work.
// That let a Cashier see every colleague's individual commission/tip data
// and mark any colleague's commission as paid — a payroll-integrity write
// with no HR-level trust check.
describe('staff-commission.handler — HR-tier permission gating', () => {
  function captureHandlers() {
    const handlers = new Map<string, (payload: unknown) => Promise<unknown>>()
    register((channel, handler) => { handlers.set(channel, handler) })
    return handlers
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requirePermission).mockResolvedValue(null) // allow, by default
  })

  it('listByStaff requires hr.view, not billing.view', async () => {
    const handlers = captureHandlers()
    await handlers.get('staffCommission:listByStaff')!({ staffId: 'emp-1' })
    expect(requirePermission).toHaveBeenCalledWith('hr.view')
    expect(requirePermission).not.toHaveBeenCalledWith('billing.view')
  })

  it('listAll requires hr.view, not billing.view', async () => {
    const handlers = captureHandlers()
    await handlers.get('staffCommission:listAll')!(undefined)
    expect(requirePermission).toHaveBeenCalledWith('hr.view')
    expect(requirePermission).not.toHaveBeenCalledWith('billing.view')
  })

  it('monthlyReport requires hr.view, not billing.view', async () => {
    const handlers = captureHandlers()
    await handlers.get('staffCommission:monthlyReport')!(undefined)
    expect(requirePermission).toHaveBeenCalledWith('hr.view')
    expect(requirePermission).not.toHaveBeenCalledWith('billing.view')
  })

  it('markPaid requires hr.manage, not billing.createInvoice', async () => {
    const handlers = captureHandlers()
    await handlers.get('staffCommission:markPaid')!({ ids: ['comm-1'], paidDate: '2026-08-01' })
    expect(requirePermission).toHaveBeenCalledWith('hr.manage')
    expect(requirePermission).not.toHaveBeenCalledWith('billing.createInvoice')
  })

  // calculate deliberately stays on billing.createInvoice — see the handler's
  // own comment. It's auto-triggered by AppointmentsScreen.tsx when a Cashier
  // marks a routine appointment COMPLETED, not called from the HR-tier
  // /commission screen at all. Regressing this to hr.manage would silently
  // stop commission ever being calculated for any appointment a Cashier
  // completes.
  it('calculate stays on billing.createInvoice (routine appointment-completion side effect, not an HR action)', async () => {
    const handlers = captureHandlers()
    await handlers.get('staffCommission:calculate')!({
      appointmentId: 'apt-1', staffId: 'emp-1', serviceRevenue: 500, commissionType: 'PERCENT', commissionRate: 10
    })
    expect(requirePermission).toHaveBeenCalledWith('billing.createInvoice')
    expect(requirePermission).not.toHaveBeenCalledWith('hr.manage')
  })

  it('a denial from requirePermission is returned as-is, blocking the read', async () => {
    const handlers = captureHandlers()
    vi.mocked(requirePermission).mockResolvedValueOnce({ success: false, error: { code: 'PERM-001', message: 'You do not have permission to perform this action.' } })
    const res = await handlers.get('staffCommission:listAll')!(undefined)
    expect(res).toEqual({ success: false, error: { code: 'PERM-001', message: 'You do not have permission to perform this action.' } })
  })
})
