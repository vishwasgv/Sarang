import { requirePermission } from '../permission-guard'
import {
  listServiceProjects, getServiceProject,
  createServiceProject, updateServiceProject, deleteServiceProject,
} from '../../services/service-project.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('serviceProject:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { clientId?: string; assignedToId?: string; status?: string }
    return listServiceProjects(payload)
  })

  handle('serviceProject:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { id: string }
    return getServiceProject(payload.id)
  })

  handle('serviceProject:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { clientId: string; projectName: string; projectType?: string; stage?: string; status?: string; totalContractValue?: number; startDate?: string; expectedEndDate?: string; assignedToId?: string; notes?: string; targetChannel?: string; deliverableType?: string; adSpendBudget?: number }
    return createServiceProject(payload)
  })

  handle('serviceProject:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string; projectName?: string; projectType?: string; stage?: string | null; status?: string; totalContractValue?: number | null; startDate?: string | null; expectedEndDate?: string | null; completedDate?: string | null; assignedToId?: string | null; notes?: string | null; targetChannel?: string | null; deliverableType?: string | null; adSpendBudget?: number | null }
    return updateServiceProject(payload)
  })

  handle('serviceProject:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string }
    return deleteServiceProject(payload.id)
  })
}
