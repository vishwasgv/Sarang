import { listMetalExchanges, createMetalExchange, linkMetalExchangeToInvoice, deleteMetalExchange } from '../../services/metal-exchange.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateMetalExchangeSchema, LinkMetalExchangeToInvoiceSchema } from '../../validation/metal-exchange.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('metalExchange:list', async (payload) => {
    const deny = await requirePermission('jewellery.view'); if (deny) return deny
    return listMetalExchanges(payload as Parameters<typeof listMetalExchanges>[0])
  })

  handle('metalExchange:create', async (payload) => {
    const deny = await requirePermission('jewellery.manageExchanges'); if (deny) return deny
    const parsed = CreateMetalExchangeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return createMetalExchange({ ...parsed.data, createdById: session?.userId })
  })

  handle('metalExchange:linkToInvoice', async (payload) => {
    const deny = await requirePermission('jewellery.manageExchanges'); if (deny) return deny
    const parsed = LinkMetalExchangeToInvoiceSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return linkMetalExchangeToInvoice(parsed.data.exchangeId, parsed.data.invoiceId)
  })

  handle('metalExchange:delete', async (payload) => {
    const deny = await requirePermission('jewellery.manageExchanges'); if (deny) return deny
    const { id } = payload as { id: string }
    return deleteMetalExchange(id)
  })
}
