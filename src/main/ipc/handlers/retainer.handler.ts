import { requirePermission } from '../permission-guard'
import { listRetainers, createRetainer, updateRetainer, deleteRetainer, generateInvoiceForRetainer } from '../../services/retainer.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('retainer:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { clientId?: string; assignedToId?: string; status?: string }
    return listRetainers(payload)
  })

  handle('retainer:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { clientId: string; assignedToId?: string; title: string; retainerType?: string; status?: string; monthlyAmount: number; billingDay?: number; hoursPerMonth?: number; deliverables?: string; startDate: string; endDate?: string; notes?: string }
    return createRetainer(payload)
  })

  handle('retainer:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string; assignedToId?: string | null; title?: string; retainerType?: string; monthlyAmount?: number; billingDay?: number | null; hoursPerMonth?: number | null; deliverables?: string | null; status?: string; startDate?: string; endDate?: string | null; notes?: string | null }
    return updateRetainer(payload)
  })

  handle('retainer:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string }
    return deleteRetainer(payload.id)
  })

  handle('retainer:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string; period?: string }
    if (!payload?.id) return { success: false, error: { code: 'VAL-001', message: 'Retainer id is required.' } }
    return generateInvoiceForRetainer(payload.id, payload.period)
  })
}
