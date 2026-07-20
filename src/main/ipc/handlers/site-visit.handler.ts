import {
  listSiteVisits, createSiteVisit, updateSiteVisit, deleteSiteVisit,
  listMaterialTestResults, addMaterialTestResult, updateMaterialTestResult, deleteMaterialTestResult,
} from '../../services/site-visit.service'
import { requirePermission } from '../permission-guard'
import {
  CreateSiteVisitSchema, UpdateSiteVisitSchema, DeleteSiteVisitSchema,
  AddMaterialTestResultSchema, UpdateMaterialTestResultSchema, DeleteMaterialTestResultSchema, ListMaterialTestResultsSchema,
} from '../../validation/site-visit.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('siteVisit:list', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const { projectId } = payload as { projectId: string }
    return listSiteVisits(projectId)
  })

  handle('siteVisit:create', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateSiteVisitSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createSiteVisit(parsed.data)
  })

  handle('siteVisit:update', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateSiteVisitSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateSiteVisit(parsed.data)
  })

  handle('siteVisit:delete', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = DeleteSiteVisitSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteSiteVisit(parsed.data.id)
  })

  handle('materialTestResult:list', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = ListMaterialTestResultsSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return listMaterialTestResults(parsed.data.siteVisitId)
  })

  handle('materialTestResult:add', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = AddMaterialTestResultSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return addMaterialTestResult(parsed.data)
  })

  handle('materialTestResult:update', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateMaterialTestResultSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateMaterialTestResult(parsed.data)
  })

  handle('materialTestResult:delete', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = DeleteMaterialTestResultSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteMaterialTestResult(parsed.data.id)
  })
}
