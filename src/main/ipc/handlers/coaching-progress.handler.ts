import { requirePermission } from '../permission-guard'
import { getStudentProgressReport, sendProgressReportWhatsApp } from '../../services/coaching-progress.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('coachingProgress:getReport', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const { studentId } = raw as { studentId: string }
    return getStudentProgressReport(studentId)
  })

  handle('coachingProgress:sendWhatsApp', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const { enrollmentId } = raw as { enrollmentId: string }
    if (!enrollmentId) return { success: false, error: { code: 'VAL-001', message: 'Enrollment ID is required.' } }
    return sendProgressReportWhatsApp(enrollmentId)
  })
}
