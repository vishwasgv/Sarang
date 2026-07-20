import { requirePermission } from '../permission-guard'
import {
  listCampaignPerformanceEntries, addCampaignPerformanceEntry, updateCampaignPerformanceEntry, deleteCampaignPerformanceEntry,
  getCampaignPerformanceSummary,
  listContentCalendarItems, createContentCalendarItem, updateContentCalendarItem, deleteContentCalendarItem,
} from '../../services/marketing-campaign.service'
import {
  AddCampaignPerformanceEntrySchema, UpdateCampaignPerformanceEntrySchema,
  CreateContentCalendarItemSchema, UpdateContentCalendarItemSchema,
  ProjectIdSchema, EntityIdSchema,
} from '../../validation/marketing-campaign.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('campaignPerformance:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = ProjectIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return listCampaignPerformanceEntries(parsed.data.projectId)
  })

  handle('campaignPerformance:add', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = AddCampaignPerformanceEntrySchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return addCampaignPerformanceEntry(parsed.data)
  })

  handle('campaignPerformance:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateCampaignPerformanceEntrySchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateCampaignPerformanceEntry(parsed.data)
  })

  handle('campaignPerformance:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = EntityIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteCampaignPerformanceEntry(parsed.data.id)
  })

  handle('campaignPerformance:summary', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = ProjectIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return getCampaignPerformanceSummary(parsed.data.projectId)
  })

  handle('contentCalendar:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = ProjectIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return listContentCalendarItems(parsed.data.projectId)
  })

  handle('contentCalendar:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateContentCalendarItemSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createContentCalendarItem(parsed.data)
  })

  handle('contentCalendar:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateContentCalendarItemSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateContentCalendarItem(parsed.data)
  })

  handle('contentCalendar:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = EntityIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteContentCalendarItem(parsed.data.id)
  })
}
