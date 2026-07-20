import { requirePermission } from '../permission-guard'
import {
  listLegalCases,
  getLegalCase,
  createLegalCase,
  updateLegalCase,
  deleteLegalCase,
  checkConflictOfInterest,
} from '../../services/legal-case.service'
import { CreateLegalCaseSchema, UpdateLegalCaseSchema, CheckConflictOfInterestSchema } from '../../validation/legal-case.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('legalCase:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { status?: string; clientId?: string; advocateId?: string; search?: string }
    return listLegalCases(payload)
  })

  handle('legalCase:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { id: string }
    return getLegalCase(payload.id)
  })

  handle('legalCase:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateLegalCaseSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createLegalCase(parsed.data)
  })

  handle('legalCase:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateLegalCaseSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateLegalCase(parsed.data)
  })

  handle('legalCase:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string }
    return deleteLegalCase(payload.id)
  })

  handle('legalCase:checkConflict', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = CheckConflictOfInterestSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return checkConflictOfInterest(parsed.data)
  })
}
