import { requirePermission } from '../permission-guard'
import {
  listPropertyInquiries,
  createPropertyInquiry,
  updatePropertyInquiry,
  deletePropertyInquiry,
} from '../../services/property-inquiry.service'
import { CreatePropertyInquirySchema, UpdatePropertyInquirySchema, PropertyInquiryIdSchema } from '../../validation/property-inquiry.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerPropertyInquiry(handle: HandleFn): void {
  handle('propertyInquiry:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listPropertyInquiries(raw as string)
  })

  handle('propertyInquiry:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreatePropertyInquirySchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createPropertyInquiry(parsed.data)
  })

  handle('propertyInquiry:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdatePropertyInquirySchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updatePropertyInquiry(parsed.data)
  })

  handle('propertyInquiry:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = PropertyInquiryIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deletePropertyInquiry(parsed.data)
  })
}
