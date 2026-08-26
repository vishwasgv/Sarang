import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import {
  listLegalCases,
  getLegalCase,
  createLegalCase,
  updateLegalCase,
  deleteLegalCase,
  checkConflictOfInterest,
  updateCaseStage,
} from '../../services/legal-case.service'
import { listCaseDisbursements, createCaseDisbursement, markDisbursementBilled, deleteCaseDisbursement } from '../../services/case-disbursement.service'
import {
  CreateLegalCaseSchema, UpdateLegalCaseSchema, CheckConflictOfInterestSchema, UpdateCaseStageSchema,
  ListCaseDisbursementsSchema, CreateCaseDisbursementSchema, MarkDisbursementBilledSchema, DeleteCaseDisbursementSchema,
} from '../../validation/legal-case.validation'

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
    const deny = await requirePermission('legalCases.manage'); if (deny) return deny
    const parsed = CreateLegalCaseSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createLegalCase(parsed.data)
  })

  handle('legalCase:update', async (raw) => {
    const deny = await requirePermission('legalCases.manage'); if (deny) return deny
    const parsed = UpdateLegalCaseSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateLegalCase(parsed.data)
  })

  handle('legalCase:delete', async (raw) => {
    const deny = await requirePermission('legalCases.manage'); if (deny) return deny
    const payload = raw as { id: string }
    return deleteLegalCase(payload.id)
  })

  handle('legalCase:checkConflict', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = CheckConflictOfInterestSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return checkConflictOfInterest(parsed.data)
  })

  // Phase 68 §9.1 — Lawyer item 3: case-stage tracker.
  handle('legalCase:updateStage', async (raw) => {
    const deny = await requirePermission('legalCases.manage'); if (deny) return deny
    const parsed = UpdateCaseStageSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateCaseStage(parsed.data)
  })

  // Phase 68 §9.1 — Lawyer item 5: court-fee/disbursement tracking.
  handle('caseDisbursement:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = ListCaseDisbursementsSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return listCaseDisbursements(parsed.data.caseId)
  })

  handle('caseDisbursement:create', async (raw) => {
    const deny = await requirePermission('legalCases.manage'); if (deny) return deny
    const parsed = CreateCaseDisbursementSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return createCaseDisbursement(parsed.data, session?.userId)
  })

  handle('caseDisbursement:markBilled', async (raw) => {
    const deny = await requirePermission('legalCases.manage'); if (deny) return deny
    const parsed = MarkDisbursementBilledSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return markDisbursementBilled(parsed.data.id, parsed.data.isBilledToClient, session?.userId)
  })

  handle('caseDisbursement:delete', async (raw) => {
    const deny = await requirePermission('legalCases.manage'); if (deny) return deny
    const parsed = DeleteCaseDisbursementSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return deleteCaseDisbursement(parsed.data.id, session?.userId)
  })
}
