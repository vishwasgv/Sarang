import { requirePermission } from '../permission-guard'
import { listMilestones, createMilestone, updateMilestone, deleteMilestone, generateMilestoneInvoice } from '../../services/service-project-milestone.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('milestone:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { projectId: string }
    return listMilestones(payload.projectId)
  })

  handle('milestone:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { projectId: string; milestoneName: string; milestoneAmount?: number; status?: string; dueDate?: string; notes?: string }
    return createMilestone(payload)
  })

  handle('milestone:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string; milestoneName?: string; milestoneAmount?: number | null; status?: string; dueDate?: string | null; completedDate?: string | null; notes?: string | null }
    return updateMilestone(payload)
  })

  handle('milestone:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string }
    return deleteMilestone(payload.id)
  })

  handle('milestone:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string }
    return generateMilestoneInvoice(payload.id)
  })
}
