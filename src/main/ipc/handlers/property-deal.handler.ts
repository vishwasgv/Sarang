import { requirePermission } from '../permission-guard'
import {
  listPropertyDeals,
  createPropertyDeal,
  updatePropertyDeal,
  deletePropertyDeal,
  generateCommissionInvoice,
} from '../../services/property-deal.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerPropertyDeal(handle: HandleFn): void {
  handle('propertyDeal:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { status?: string; propertyId?: string }
    return listPropertyDeals(payload)
  })

  handle('propertyDeal:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return createPropertyDeal(raw as Parameters<typeof createPropertyDeal>[0])
  })

  handle('propertyDeal:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return updatePropertyDeal(raw as Parameters<typeof updatePropertyDeal>[0])
  })

  handle('propertyDeal:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return deletePropertyDeal(raw as string)
  })

  handle('propertyDeal:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return generateCommissionInvoice(raw as string)
  })
}
