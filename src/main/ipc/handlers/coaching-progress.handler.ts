import { requirePermission } from '../permission-guard'
import { getStudentProgressReport } from '../../services/coaching-progress.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('coachingProgress:getReport', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const { studentId } = raw as { studentId: string }
    return getStudentProgressReport(studentId)
  })
}
