import { requirePermission } from '../permission-guard'
import { getPatientRecall, upsertRecall, listRecalls } from '../../services/recall-record.service'
import { UpsertRecallSchema } from '../../validation/recall-record.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('recall:get', async (payload) => {
    const deny = await requirePermission('clinicalNotes.view'); if (deny) return deny
    const { patientId } = payload as { patientId: string }
    return getPatientRecall(patientId)
  })

  handle('recall:list', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listRecalls(payload as Parameters<typeof listRecalls>[0])
  })

  handle('recall:upsert', async (payload) => {
    const deny = await requirePermission('clinicalNotes.write'); if (deny) return deny
    const parsed = UpsertRecallSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return upsertRecall(parsed.data)
  })
}
