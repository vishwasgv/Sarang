import { requirePermission } from '../permission-guard'
import {
  listROCFilings,
  createROCFiling,
  updateROCFiling,
  deleteROCFiling,
  getComplianceRollup,
  generateFilingsFromAGM,
  getComplianceCompletionSummary,
} from '../../services/roc-filing.service'
import { CreateROCFilingSchema, UpdateROCFilingSchema, ROCFilingIdSchema, GenerateFilingsFromAGMSchema } from '../../validation/roc-filing.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('rocFiling:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { clientId?: string; staffId?: string; status?: string; formType?: string; financialYear?: string }
    return listROCFilings(payload)
  })

  handle('rocFiling:create', async (raw) => {
    const deny = await requirePermission('rocFilings.manage'); if (deny) return deny
    const parsed = CreateROCFilingSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createROCFiling(parsed.data)
  })

  handle('rocFiling:update', async (raw) => {
    const deny = await requirePermission('rocFilings.manage'); if (deny) return deny
    const parsed = UpdateROCFilingSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateROCFiling(parsed.data)
  })

  handle('rocFiling:delete', async (raw) => {
    const deny = await requirePermission('rocFilings.manage'); if (deny) return deny
    const parsed = ROCFilingIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteROCFiling(parsed.data.id)
  })

  handle('rocFiling:complianceRollup', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { financialYear: string }
    if (!payload?.financialYear) return { success: false, error: { code: 'VAL-001', message: 'Financial year is required.' } }
    return getComplianceRollup(payload.financialYear)
  })

  handle('rocFiling:generateFromAGM', async (raw) => {
    const deny = await requirePermission('rocFilings.manage'); if (deny) return deny
    const parsed = GenerateFilingsFromAGMSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return generateFilingsFromAGM(parsed.data)
  })

  handle('rocFiling:completionSummary', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { financialYear: string }
    if (!payload?.financialYear) return { success: false, error: { code: 'VAL-001', message: 'Financial year is required.' } }
    return getComplianceCompletionSummary(payload.financialYear)
  })
}
