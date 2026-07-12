import { requirePermission } from '../permission-guard'
import { listBatches, createBatch, updateBatch, deleteBatch, getBatchKPIs } from '../../services/coaching-batch.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('coachingBatch:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { status?: string; search?: string }
    return listBatches(payload)
  })

  handle('coachingBatch:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as {
      batchName: string; subjectOrCourse: string; instructorId?: string
      scheduleDays?: string[]; scheduleTime?: string; roomOrLocation?: string
      maxCapacity?: number; startDate: string; endDate?: string; feePerMonth: number; status?: string
    }
    return createBatch(payload)
  })

  handle('coachingBatch:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as {
      id: string; batchName?: string; subjectOrCourse?: string; instructorId?: string | null
      scheduleDays?: string[]; scheduleTime?: string | null; roomOrLocation?: string | null
      maxCapacity?: number; startDate?: string; endDate?: string | null; feePerMonth?: number; status?: string
    }
    return updateBatch(payload)
  })

  handle('coachingBatch:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string }
    return deleteBatch(payload.id)
  })

  handle('coachingBatch:kpis', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getBatchKPIs()
  })
}
