import { listMetalExchanges, createMetalExchange, linkMetalExchangeToInvoice, deleteMetalExchange } from '../../services/metal-exchange.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('metalExchange:list', async (payload) => {
    const deny = await requirePermission('jewellery.view'); if (deny) return deny
    return listMetalExchanges(payload as Parameters<typeof listMetalExchanges>[0])
  })

  handle('metalExchange:create', async (payload) => {
    const deny = await requirePermission('jewellery.manageExchanges'); if (deny) return deny
    const session = getCurrentSession()
    return createMetalExchange({ ...(payload as Parameters<typeof createMetalExchange>[0]), createdById: session?.userId })
  })

  handle('metalExchange:linkToInvoice', async (payload) => {
    const deny = await requirePermission('jewellery.manageExchanges'); if (deny) return deny
    const { exchangeId, invoiceId } = payload as { exchangeId: string; invoiceId: string }
    return linkMetalExchangeToInvoice(exchangeId, invoiceId)
  })

  handle('metalExchange:delete', async (payload) => {
    const deny = await requirePermission('jewellery.manageExchanges'); if (deny) return deny
    const { id } = payload as { id: string }
    return deleteMetalExchange(id)
  })
}
