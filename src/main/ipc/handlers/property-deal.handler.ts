import { requirePermission } from '../permission-guard'
import {
  listPropertyDeals,
  createPropertyDeal,
  updatePropertyDeal,
  deletePropertyDeal,
  generateCommissionInvoice,
} from '../../services/property-deal.service'
import { CreatePropertyDealSchema, UpdatePropertyDealSchema, PropertyDealIdSchema } from '../../validation/property-deal.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerPropertyDeal(handle: HandleFn): void {
  handle('propertyDeal:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { status?: string; propertyId?: string }
    return listPropertyDeals(payload)
  })

  handle('propertyDeal:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreatePropertyDealSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createPropertyDeal(parsed.data)
  })

  handle('propertyDeal:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdatePropertyDealSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updatePropertyDeal(parsed.data)
  })

  handle('propertyDeal:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = PropertyDealIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deletePropertyDeal(parsed.data)
  })

  handle('propertyDeal:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = PropertyDealIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return generateCommissionInvoice(parsed.data)
  })
}
