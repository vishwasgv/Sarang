import { requirePermission } from '../permission-guard'
import {
  listEnrollmentsByBatch,
  listEnrollmentsByStudent,
  createEnrollment,
  updateEnrollment,
  deleteEnrollment,
  promoteFromWaitlist,
} from '../../services/coaching-batch-enrollment.service'
import { CreateEnrollmentSchema, UpdateEnrollmentSchema, EnrollmentIdSchema } from '../../validation/coaching-batch-enrollment.validation'

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
    const parsed = CreateEnrollmentSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createEnrollment(parsed.data)
  })

  handle('enrollment:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateEnrollmentSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateEnrollment(parsed.data)
  })

  handle('enrollment:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = EnrollmentIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteEnrollment(parsed.data.id)
  })

  handle('enrollment:promoteFromWaitlist', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = EnrollmentIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return promoteFromWaitlist(parsed.data.id)
  })
}
