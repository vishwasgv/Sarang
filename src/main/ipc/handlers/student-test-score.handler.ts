import { requirePermission } from '../permission-guard'
import {
  listTestScores,
  createTestScore,
  updateTestScore,
  deleteTestScore,
} from '../../services/student-test-score.service'
import { CreateTestScoreSchema, UpdateTestScoreSchema, DeleteTestScoreSchema } from '../../validation/student-test-score.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('studentTestScore:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { enrollmentId?: string; batchId?: string }
    return listTestScores(payload)
  })

  handle('studentTestScore:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateTestScoreSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createTestScore(parsed.data)
  })

  handle('studentTestScore:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateTestScoreSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateTestScore(parsed.data)
  })

  handle('studentTestScore:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = DeleteTestScoreSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteTestScore(parsed.data.id)
  })
}
