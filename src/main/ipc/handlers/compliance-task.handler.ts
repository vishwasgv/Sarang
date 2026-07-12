import { requirePermission } from '../permission-guard'
import {
  listComplianceTasks,
  createComplianceTask,
  updateComplianceTask,
  deleteComplianceTask,
} from '../../services/compliance-task.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('complianceTask:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { clientId?: string; staffId?: string; status?: string; category?: string; fromDate?: string; toDate?: string }
    return listComplianceTasks(payload)
  })

  handle('complianceTask:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { complianceEventId?: string; clientId: string; staffId?: string; title: string; category: string; dueDate: string; priority?: string; notes?: string }
    return createComplianceTask(payload)
  })

  handle('complianceTask:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string; staffId?: string | null; title?: string; category?: string; dueDate?: string; status?: string; priority?: string; notes?: string | null; filedOn?: string | null; acknowledgmentNo?: string | null }
    return updateComplianceTask(payload)
  })

  handle('complianceTask:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const { id } = raw as { id: string }
    return deleteComplianceTask(id)
  })
}
