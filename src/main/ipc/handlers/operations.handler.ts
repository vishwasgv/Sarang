import * as returnsService from '../../services/returns.service'
import { createExchange } from '../../services/exchange.service'
import { cashCloseService } from '../../services/cash-close.service'
import { recordTrialSession, getTrialConversionSummary } from '../../services/trial-session.service'
import {
  listSeasonalCycles, createSeasonalCycle, updateSeasonalCycle, deleteSeasonalCycle, getSeasonalReorderCalendar
} from '../../services/seasonal-cycle.service'
import {
  listCropSeasons, createCropSeason, updateCropSeason, deleteCropSeason, resolveCropSeasonDueDate
} from '../../services/crop-season.service'
import { listDistinctCrops, getProductsForCrop } from '../../services/crop-advisory.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import {
  CreateReturnSchema, CreateExchangeSchema, CashCloseCreateSchema, RecordTrialSessionSchema,
  SeasonalCycleSchema, UpdateSeasonalCycleSchema, CropSeasonSchema, UpdateCropSeasonSchema
} from '../../validation/operations.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('returns:create', async (payload) => {
    const deny = await requirePermission('billing.manageReturns'); if (deny) return deny
    const parsed = CreateReturnSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return returnsService.createReturn(parsed.data.originalInvoiceId, parsed.data.items, parsed.data.reason, getCurrentSession()?.userId)
  })

  handle('exchange:create', async (payload) => {
    const deny = await requirePermission('billing.manageReturns'); if (deny) return deny
    const parsed = CreateExchangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createExchange(parsed.data, getCurrentSession()?.userId)
  })

  handle('trialSession:record', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = RecordTrialSessionSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return recordTrialSession(parsed.data, getCurrentSession()?.userId)
  })

  handle('trialSession:conversionSummary', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const p = (payload ?? {}) as { dateFrom?: string; dateTo?: string }
    return getTrialConversionSummary(p.dateFrom, p.dateTo)
  })

  // Phase 67 §9.1 — Footwear item 5: seasonal reorder calendar.
  handle('seasonalCycle:list', async () => {
    const deny = await requirePermission('products.view'); if (deny) return deny
    return listSeasonalCycles()
  })

  handle('seasonalCycle:create', async (payload) => {
    const deny = await requirePermission('products.update'); if (deny) return deny
    const parsed = SeasonalCycleSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createSeasonalCycle(parsed.data, getCurrentSession()?.userId)
  })

  handle('seasonalCycle:update', async (payload) => {
    const deny = await requirePermission('products.update'); if (deny) return deny
    const parsed = UpdateSeasonalCycleSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateSeasonalCycle(parsed.data, getCurrentSession()?.userId)
  })

  handle('seasonalCycle:delete', async (payload) => {
    const deny = await requirePermission('products.update'); if (deny) return deny
    const p = (payload ?? {}) as { id?: string }
    if (!p.id) return { success: false, error: { code: 'VAL-001', message: 'ID is required.' } }
    return deleteSeasonalCycle(p.id, getCurrentSession()?.userId)
  })

  handle('seasonalCycle:calendar', async (payload) => {
    const deny = await requirePermission('reports.inventory'); if (deny) return deny
    const p = (payload ?? {}) as { lowStockThreshold?: number }
    return getSeasonalReorderCalendar(p.lowStockThreshold)
  })

  // Phase 67 §9.1 — Agri Inputs item 1: crop-season-aligned credit terms.
  handle('cropSeason:list', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listCropSeasons()
  })

  handle('cropSeason:create', async (payload) => {
    const deny = await requirePermission('billing.create'); if (deny) return deny
    const parsed = CropSeasonSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createCropSeason(parsed.data, getCurrentSession()?.userId)
  })

  handle('cropSeason:update', async (payload) => {
    const deny = await requirePermission('billing.create'); if (deny) return deny
    const parsed = UpdateCropSeasonSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateCropSeason(parsed.data, getCurrentSession()?.userId)
  })

  handle('cropSeason:delete', async (payload) => {
    const deny = await requirePermission('billing.create'); if (deny) return deny
    const p = (payload ?? {}) as { id?: string }
    if (!p.id) return { success: false, error: { code: 'VAL-001', message: 'ID is required.' } }
    return deleteCropSeason(p.id, getCurrentSession()?.userId)
  })

  handle('cropSeason:resolveDueDate', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const p = (payload ?? {}) as { cropSeasonId?: string }
    if (!p.cropSeasonId) return { success: false, error: { code: 'VAL-001', message: 'Crop season ID is required.' } }
    return resolveCropSeasonDueDate(p.cropSeasonId)
  })

  // Phase 67 §9.1 — Agri Inputs item 3: crop-linked product advisory.
  handle('cropAdvisory:listCrops', async () => {
    const deny = await requirePermission('products.view'); if (deny) return deny
    return listDistinctCrops()
  })

  handle('cropAdvisory:productsForCrop', async (payload) => {
    const deny = await requirePermission('products.view'); if (deny) return deny
    const p = (payload ?? {}) as { cropName?: string }
    if (!p.cropName) return { success: false, error: { code: 'VAL-001', message: 'Crop name is required.' } }
    return getProductsForCrop(p.cropName)
  })

  handle('returns:list', async (payload) => {
    const deny = await requirePermission('billing.manageReturns'); if (deny) return deny
    const p = (payload ?? {}) as { originalInvoiceId?: string }
    return returnsService.listReturns(p.originalInvoiceId)
  })

  handle('returns:todaySummary', async () => {
    const deny = await requirePermission('billing.manageReturns'); if (deny) return deny
    return returnsService.getTodayReturnsSummary()
  })

  handle('cashClose:getSummary', async (payload) => {
    const deny = await requirePermission('billing.cashClose'); if (deny) return deny
    const p = (payload ?? {}) as { date?: string }
    return cashCloseService.getDrawerSummary(p.date)
  })

  handle('cashClose:create', async (payload) => {
    const deny = await requirePermission('billing.cashClose'); if (deny) return deny
    const parsed = CashCloseCreateSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return cashCloseService.create(parsed.data, getCurrentSession()?.userId)
  })

  handle('cashClose:list', async (payload) => {
    const deny = await requirePermission('billing.cashClose'); if (deny) return deny
    const p = (payload ?? {}) as { dateFrom?: string; dateTo?: string; page?: number; limit?: number }
    return cashCloseService.list(p)
  })
}
