import { requirePermission } from '../permission-guard'
import { getAttendance, saveAttendance, listAttendanceDates } from '../../services/coaching-batch-attendance.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('coachingAttendance:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { batchId: string; date: string }
    return getAttendance(payload.batchId, payload.date)
  })

  handle('coachingAttendance:save', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as {
      batchId: string; attendanceDate: string; presentStudentIds: string[]
      absentStudentIds: string[]; takenById?: string; notes?: string
    }
    return saveAttendance(payload)
  })

  handle('coachingAttendance:listDates', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { batchId: string }
    return listAttendanceDates(payload.batchId)
  })
}
