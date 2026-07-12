import { requirePermission } from '../permission-guard'
import {
  listBatchClasses,
  getBatchClass,
  createBatchClass,
  updateBatchClass,
  enrollMember,
  unenrollMember,
  markBatchClassAttendance,
  getBatchClassAttendance,
} from '../../services/batch-class.service'
import {
  CreateBatchClassSchema,
  UpdateBatchClassSchema,
  EnrollMemberSchema,
  UnenrollMemberSchema,
  MarkAttendanceSchema,
} from '../../validation/batch-class.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('batchClass:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { status?: string; instructorId?: string }
    return listBatchClasses(payload)
  })

  handle('batchClass:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { id: string }
    return getBatchClass(payload.id)
  })

  handle('batchClass:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateBatchClassSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createBatchClass(parsed.data)
  })

  handle('batchClass:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateBatchClassSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateBatchClass(parsed.data)
  })

  handle('batchClass:enroll', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = EnrollMemberSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return enrollMember(parsed.data.batchClassId, parsed.data.memberId)
  })

  handle('batchClass:unenroll', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UnenrollMemberSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return unenrollMember(parsed.data.batchClassId, parsed.data.memberId)
  })

  handle('batchClass:markAttendance', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = MarkAttendanceSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return markBatchClassAttendance(parsed.data.classId, parsed.data.memberIds, parsed.data.sessionDate)
  })

  handle('batchClass:getAttendance', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { classId: string; sessionDate?: string }
    return getBatchClassAttendance(payload.classId, payload.sessionDate)
  })
}
