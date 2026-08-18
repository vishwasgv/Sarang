import { requirePermission } from '../permission-guard'
import {
  listChronicConditions,
  upsertChronicCondition,
  deactivateChronicCondition,
  getChronicRecallDashboardCounts,
  generateChronicRecallComplianceReport,
} from '../../services/chronic-condition-record.service'
import { UpsertChronicConditionSchema } from '../../validation/chronic-condition-record.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('chronicRecall:list', async (payload) => {
    const deny = await requirePermission('clinicalNotes.view'); if (deny) return deny
    return listChronicConditions(payload as Parameters<typeof listChronicConditions>[0])
  })

  handle('chronicRecall:upsert', async (payload) => {
    const deny = await requirePermission('clinicalNotes.write'); if (deny) return deny
    const parsed = UpsertChronicConditionSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return upsertChronicCondition(parsed.data)
  })

  handle('chronicRecall:deactivate', async (payload) => {
    const deny = await requirePermission('clinicalNotes.write'); if (deny) return deny
    const { id } = payload as { id: string }
    return deactivateChronicCondition(id)
  })

  handle('chronicRecall:dashboardCounts', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getChronicRecallDashboardCounts()
  })

  handle('chronicRecall:complianceReport', async (payload) => {
    const deny = await requirePermission('clinicalNotes.view'); if (deny) return deny
    return generateChronicRecallComplianceReport(payload as Parameters<typeof generateChronicRecallComplianceReport>[0])
  })
}
