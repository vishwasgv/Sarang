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
    const payload = raw as { className: string; instructorId?: string; maxCapacity: number; scheduleDays: string; scheduleTime: string; startDate: string; endDate?: string; roomOrLocation?: string }
    return createBatchClass(payload)
  })

  handle('batchClass:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string; className?: string; instructorId?: string | null; maxCapacity?: number; scheduleDays?: string; scheduleTime?: string; startDate?: string; endDate?: string | null; roomOrLocation?: string | null; status?: string }
    return updateBatchClass(payload)
  })

  handle('batchClass:enroll', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { batchClassId: string; memberId: string }
    return enrollMember(payload.batchClassId, payload.memberId)
  })

  handle('batchClass:unenroll', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { batchClassId: string; memberId: string }
    return unenrollMember(payload.batchClassId, payload.memberId)
  })

  handle('batchClass:markAttendance', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { classId: string; memberIds: string[]; sessionDate: string }
    return markBatchClassAttendance(payload.classId, payload.memberIds, payload.sessionDate)
  })

  handle('batchClass:getAttendance', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { classId: string; sessionDate?: string }
    return getBatchClassAttendance(payload.classId, payload.sessionDate)
  })
}
