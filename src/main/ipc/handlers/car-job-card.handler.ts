import {
  listCarJobCards, getCarJobCard, createCarJobCard, updateCarJobCard,
  deleteCarJobCard, generateCarJobInvoice, getCarJobCardKPIs
} from '../../services/car-job-card.service'
import { requirePermission } from '../permission-guard'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerCarJobCard(handle: HandleFn): void {
  handle('carJobCard:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listCarJobCards(raw as Parameters<typeof listCarJobCards>[0])
  })

  handle('carJobCard:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getCarJobCard(raw as string)
  })

  handle('carJobCard:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return createCarJobCard(raw as Parameters<typeof createCarJobCard>[0])
  })

  handle('carJobCard:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return updateCarJobCard(raw as Parameters<typeof updateCarJobCard>[0])
  })

  handle('carJobCard:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return deleteCarJobCard(raw as string)
  })

  handle('carJobCard:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return generateCarJobInvoice(raw as string)
  })

  handle('carJobCard:kpis', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getCarJobCardKPIs()
  })
}
