import {
  listJobOrders, getJobOrder, createJobOrder, updateJobOrder, deleteJobOrder
} from '../../services/job-order.service'
import { requirePermission } from '../permission-guard'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerJobOrder(handle: HandleFn): void {
  handle('jobOrder:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listJobOrders(raw as Parameters<typeof listJobOrders>[0])
  })

  handle('jobOrder:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getJobOrder(raw as string)
  })

  handle('jobOrder:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return createJobOrder(raw as Parameters<typeof createJobOrder>[0])
  })

  handle('jobOrder:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return updateJobOrder(raw as Parameters<typeof updateJobOrder>[0])
  })

  handle('jobOrder:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return deleteJobOrder(raw as string)
  })
}
