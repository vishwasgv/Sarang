import { invoiceTemplateService } from '../../services/invoice-template.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateInvoiceTemplateSchema, UpdateInvoiceTemplateSchema, SetDefaultTemplateSchema } from '../../validation/invoice-template.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function validateId(id: unknown, label = 'ID'): { success: false; error: { code: string; message: string } } | null {
  if (typeof id !== 'string' || !id.trim()) {
    return { success: false, error: { code: 'VAL-001', message: `Invalid ${label}: must be a non-empty string.` } }
  }
  return null
}

export function register(handle: HandleFn): void {
  handle('invoiceTemplates:list', async () => {
    const deny = await requirePermission('invoiceTemplates.view'); if (deny) return deny
    return invoiceTemplateService.listTemplates()
  })

  handle('invoiceTemplates:create', async (payload) => {
    const deny = await requirePermission('invoiceTemplates.manage'); if (deny) return deny
    const parsed = CreateInvoiceTemplateSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return invoiceTemplateService.createTemplate(parsed.data, getCurrentSession()?.userId)
  })

  handle('invoiceTemplates:update', async (payload) => {
    const deny = await requirePermission('invoiceTemplates.manage'); if (deny) return deny
    const parsed = UpdateInvoiceTemplateSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return invoiceTemplateService.updateTemplate(parsed.data, getCurrentSession()?.userId)
  })

  handle('invoiceTemplates:delete', async (id) => {
    const deny = await requirePermission('invoiceTemplates.manage'); if (deny) return deny
    const bad = validateId(id, 'invoice template ID'); if (bad) return bad
    return invoiceTemplateService.deleteTemplate(id as string, getCurrentSession()?.userId)
  })

  handle('invoiceTemplates:setBusinessDefault', async (payload) => {
    const deny = await requirePermission('invoiceTemplates.manage'); if (deny) return deny
    const parsed = SetDefaultTemplateSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return invoiceTemplateService.setBusinessDefaultTemplate(parsed.data.id, getCurrentSession()?.userId)
  })
}
