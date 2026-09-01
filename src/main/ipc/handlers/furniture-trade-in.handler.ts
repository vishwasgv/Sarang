import { listFurnitureTradeIns, createFurnitureTradeIn, linkFurnitureTradeInToInvoice, deleteFurnitureTradeIn } from '../../services/furniture-trade-in.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateFurnitureTradeInSchema, LinkFurnitureTradeInToInvoiceSchema } from '../../validation/furniture-trade-in.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('furnitureTradeIn:list', async (payload) => {
    const deny = await requirePermission('furnitureTradeIn.view'); if (deny) return deny
    return listFurnitureTradeIns(payload as Parameters<typeof listFurnitureTradeIns>[0])
  })

  handle('furnitureTradeIn:create', async (payload) => {
    const deny = await requirePermission('furnitureTradeIn.manage'); if (deny) return deny
    const parsed = CreateFurnitureTradeInSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    const session = getCurrentSession()
    return createFurnitureTradeIn({ ...parsed.data, createdById: session?.userId })
  })

  handle('furnitureTradeIn:linkToInvoice', async (payload) => {
    const deny = await requirePermission('furnitureTradeIn.manage'); if (deny) return deny
    const parsed = LinkFurnitureTradeInToInvoiceSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return linkFurnitureTradeInToInvoice(parsed.data.tradeInId, parsed.data.invoiceId)
  })

  handle('furnitureTradeIn:delete', async (payload) => {
    const deny = await requirePermission('furnitureTradeIn.manage'); if (deny) return deny
    const { id } = payload as { id: string }
    return deleteFurnitureTradeIn(id)
  })
}
