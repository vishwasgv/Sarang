import { requirePermission } from '../permission-guard'
import {
  listSyllabusTopics,
  createSyllabusTopic,
  updateSyllabusTopic,
  deleteSyllabusTopic,
  getSyllabusProgress,
} from '../../services/coaching-syllabus.service'
import {
  ListSyllabusTopicsSchema,
  CreateSyllabusTopicSchema,
  UpdateSyllabusTopicSchema,
  SyllabusTopicIdSchema,
} from '../../validation/coaching-syllabus.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('syllabusTopic:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = ListSyllabusTopicsSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return listSyllabusTopics(parsed.data.batchId)
  })

  handle('syllabusTopic:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateSyllabusTopicSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createSyllabusTopic(parsed.data)
  })

  handle('syllabusTopic:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateSyllabusTopicSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateSyllabusTopic(parsed.data)
  })

  handle('syllabusTopic:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = SyllabusTopicIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteSyllabusTopic(parsed.data.id)
  })

  handle('syllabusTopic:progress', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = ListSyllabusTopicsSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return getSyllabusProgress(parsed.data.batchId)
  })
}
