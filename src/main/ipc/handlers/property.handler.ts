import { requirePermission } from '../permission-guard'
import {
  listProperties,
  getProperty,
  createProperty,
  updateProperty,
  deleteProperty,
  getPropertyKPIs,
} from '../../services/property.service'

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
    return createProperty(raw as Parameters<typeof createProperty>[0])
  })

  handle('property:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return updateProperty(raw as Parameters<typeof updateProperty>[0])
  })

  handle('property:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return deleteProperty(raw as string)
  })

  handle('property:kpis', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getPropertyKPIs()
  })
}
