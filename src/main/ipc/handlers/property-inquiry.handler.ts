import { requirePermission } from '../permission-guard'
import {
  listPropertyInquiries,
  createPropertyInquiry,
  updatePropertyInquiry,
  deletePropertyInquiry,
} from '../../services/property-inquiry.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerPropertyInquiry(handle: HandleFn): void {
  handle('propertyInquiry:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listPropertyInquiries(raw as string)
  })

  handle('propertyInquiry:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return createPropertyInquiry(raw as Parameters<typeof createPropertyInquiry>[0])
  })

  handle('propertyInquiry:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return updatePropertyInquiry(raw as Parameters<typeof updatePropertyInquiry>[0])
  })

  handle('propertyInquiry:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return deletePropertyInquiry(raw as string)
  })
}
