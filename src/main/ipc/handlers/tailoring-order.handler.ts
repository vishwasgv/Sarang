import {
  listTailoringOrders, getTailoringOrder, createTailoringOrder, updateTailoringOrder,
  deleteTailoringOrder, generateTailoringInvoice, getTailoringKPIs
} from '../../services/tailoring-order.service'
import { requirePermission } from '../permission-guard'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerTailoringOrder(handle: HandleFn): void {
  handle('tailoringOrder:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listTailoringOrders(raw as Parameters<typeof listTailoringOrders>[0])
  })

  handle('tailoringOrder:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getTailoringOrder(raw as string)
  })

  handle('tailoringOrder:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return createTailoringOrder(raw as Parameters<typeof createTailoringOrder>[0])
  })

  handle('tailoringOrder:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return updateTailoringOrder(raw as Parameters<typeof updateTailoringOrder>[0])
  })

  handle('tailoringOrder:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return deleteTailoringOrder(raw as string)
  })

  handle('tailoringOrder:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return generateTailoringInvoice(raw as string)
  })

  handle('tailoringOrder:kpis', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getTailoringKPIs()
  })
}
