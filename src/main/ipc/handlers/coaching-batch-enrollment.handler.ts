import { requirePermission } from '../permission-guard'
import {
  listEnrollmentsByBatch,
  listEnrollmentsByStudent,
  createEnrollment,
  updateEnrollment,
  deleteEnrollment,
} from '../../services/coaching-batch-enrollment.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('enrollment:listByBatch', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { batchId: string }
    return listEnrollmentsByBatch(payload.batchId)
  })

  handle('enrollment:listByStudent', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { studentId: string }
    return listEnrollmentsByStudent(payload.studentId)
  })

  handle('enrollment:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as {
      batchId: string; studentId: string; discountType?: string
      discountAmount?: number; effectiveFee: number; enrolledDate?: string; notes?: string
    }
    return createEnrollment(payload)
  })

  handle('enrollment:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as {
      id: string; status?: string; discountType?: string
      discountAmount?: number; effectiveFee?: number; notes?: string | null
    }
    return updateEnrollment(payload)
  })

  handle('enrollment:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string }
    return deleteEnrollment(payload.id)
  })
}
