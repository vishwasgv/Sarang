import { requirePermission } from '../permission-guard'
import {
  listProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
  getPropertyKPIs,
} from '../../services/property.service'
import { CreatePropertySchema, UpdatePropertySchema, PropertyIdSchema } from '../../validation/property.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerProperty(handle: HandleFn): void {
  handle('property:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { status?: string; listingType?: string; search?: string }
    return listProperties(payload)
  })

  handle('property:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getProperty(raw as string)
  })

  handle('property:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreatePropertySchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createProperty(parsed.data)
  })

  handle('property:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdatePropertySchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateProperty(parsed.data)
  })

  handle('property:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = PropertyIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteProperty(parsed.data)
  })

  handle('property:kpis', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getPropertyKPIs()
  })
}
