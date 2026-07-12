import { requirePermission } from '../permission-guard'
import { getAttendance, saveAttendance, listAttendanceDates } from '../../services/coaching-batch-attendance.service'
import { SaveCoachingAttendanceSchema } from '../../validation/coaching-batch-attendance.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('coachingAttendance:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { batchId: string; date: string }
    return getAttendance(payload.batchId, payload.date)
  })

  handle('coachingAttendance:save', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = SaveCoachingAttendanceSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return saveAttendance(parsed.data)
  })

  handle('coachingAttendance:listDates', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { batchId: string }
    return listAttendanceDates(payload.batchId)
  })
}
