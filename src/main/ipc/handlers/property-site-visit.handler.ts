import { requirePermission } from '../permission-guard'
import {
  listPropertySiteVisits,
  schedulePropertySiteVisit,
  updatePropertySiteVisit,
  deletePropertySiteVisit,
} from '../../services/property-site-visit.service'
import {
  SchedulePropertySiteVisitSchema, UpdatePropertySiteVisitSchema,
  PropertySiteVisitIdSchema, ListPropertySiteVisitsSchema,
} from '../../validation/property-site-visit.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerPropertySiteVisit(handle: HandleFn): void {
  handle('propertySiteVisit:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = ListPropertySiteVisitsSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return listPropertySiteVisits(parsed.data.inquiryId)
  })

  handle('propertySiteVisit:schedule', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = SchedulePropertySiteVisitSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return schedulePropertySiteVisit(parsed.data)
  })

  handle('propertySiteVisit:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdatePropertySiteVisitSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updatePropertySiteVisit(parsed.data)
  })

  handle('propertySiteVisit:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = PropertySiteVisitIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deletePropertySiteVisit(parsed.data.id)
  })
}
