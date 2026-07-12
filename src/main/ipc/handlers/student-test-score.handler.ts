import { requirePermission } from '../permission-guard'
import {
  listTestScores,
  createTestScore,
  updateTestScore,
  deleteTestScore,
} from '../../services/student-test-score.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('studentTestScore:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { enrollmentId?: string; batchId?: string }
    return listTestScores(payload)
  })

  handle('studentTestScore:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { enrollmentId: string; testName: string; subject?: string; marksObtained: number; maxMarks: number; testDate: string; grade?: string; notes?: string }
    return createTestScore(payload)
  })

  handle('studentTestScore:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string; testName?: string; subject?: string | null; marksObtained?: number; maxMarks?: number; testDate?: string; grade?: string | null; notes?: string | null }
    return updateTestScore(payload)
  })

  handle('studentTestScore:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const { id } = raw as { id: string }
    return deleteTestScore(id)
  })
}
