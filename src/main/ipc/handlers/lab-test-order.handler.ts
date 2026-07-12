import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import * as svc from '../../services/lab-test-order.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('labTestOrders:list', async (payload) => {
    const deny = await requirePermission('labOrders.view'); if (deny) return deny
    return svc.listLabTestOrders(payload as Parameters<typeof svc.listLabTestOrders>[0])
  })

  handle('labTestOrders:get', async (payload) => {
    const deny = await requirePermission('labOrders.view'); if (deny) return deny
    const { id } = payload as { id: string }
    return svc.getLabTestOrder(id)
  })

  handle('labTestOrders:create', async (payload) => {
    const deny = await requirePermission('labOrders.create'); if (deny) return deny
    const session = getCurrentSession()
    return svc.createLabTestOrder(payload as Parameters<typeof svc.createLabTestOrder>[0], session?.userId)
  })

  handle('labTestOrders:update', async (payload) => {
    const deny = await requirePermission('labOrders.create'); if (deny) return deny
    const session = getCurrentSession()
    return svc.updateLabTestOrder(payload as Parameters<typeof svc.updateLabTestOrder>[0], session?.userId)
  })

  handle('labTestOrders:addItem', async (payload) => {
    const deny = await requirePermission('labOrders.create'); if (deny) return deny
    const session = getCurrentSession()
    return svc.addTestItem(payload as Parameters<typeof svc.addTestItem>[0], session?.userId)
  })

  handle('labTestOrders:removeItem', async (payload) => {
    const deny = await requirePermission('labOrders.create'); if (deny) return deny
    const session = getCurrentSession()
    const { itemId } = payload as { itemId: string }
    return svc.removeTestItem(itemId, session?.userId)
  })

  handle('labTestOrders:markSampleCollected', async (payload) => {
    const deny = await requirePermission('labOrders.manage'); if (deny) return deny
    const session = getCurrentSession()
    return svc.markSampleCollected(payload as Parameters<typeof svc.markSampleCollected>[0], session?.userId)
  })

  handle('labTestOrders:updateResult', async (payload) => {
    const deny = await requirePermission('labOrders.manage'); if (deny) return deny
    const session = getCurrentSession()
    return svc.updateTestResult(payload as Parameters<typeof svc.updateTestResult>[0], session?.userId)
  })

  handle('labTestOrders:finalizeReport', async (payload) => {
    const deny = await requirePermission('labOrders.manage'); if (deny) return deny
    const session = getCurrentSession()
    return svc.finalizeReport(payload as Parameters<typeof svc.finalizeReport>[0], session?.userId)
  })

  handle('labTestOrders:markDelivered', async (payload) => {
    const deny = await requirePermission('labOrders.manage'); if (deny) return deny
    const session = getCurrentSession()
    const { id } = payload as { id: string }
    return svc.markDelivered(id, session?.userId)
  })

  handle('labTestOrders:cancel', async (payload) => {
    const deny = await requirePermission('labOrders.manage'); if (deny) return deny
    const session = getCurrentSession()
    return svc.cancelLabTestOrder(payload as Parameters<typeof svc.cancelLabTestOrder>[0], session?.userId)
  })

  handle('labTestOrders:delete', async (payload) => {
    const deny = await requirePermission('labOrders.manage'); if (deny) return deny
    const session = getCurrentSession()
    const { id } = payload as { id: string }
    return svc.deleteLabTestOrder(id, session?.userId)
  })

  handle('labTestOrders:generateInvoice', async (payload) => {
    // Routine front-desk billing, not lab-technician-level trust — matches
    // appointments:generateInvoice gating on billing.createInvoice (Cashier
    // holds it), not a manage-tier permission. See seed.ts's Cashier grant
    // comment: Cashier can register orders AND hand over/bill a finalized one.
    const deny = await requirePermission('labOrders.create'); if (deny) return deny
    const { id } = payload as { id: string }
    return svc.generateLabTestOrderInvoice(id)
  })
}
