import {
  listPlacements, getPlacement, createPlacement, updatePlacement,
  deletePlacement, generatePlacementInvoice, getPlacementKPIs
} from '../../services/placement.service'
import { requirePermission } from '../permission-guard'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerPlacement(handle: HandleFn): void {
  handle('placement:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listPlacements(raw as Parameters<typeof listPlacements>[0])
  })

  handle('placement:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getPlacement(raw as string)
  })

  handle('placement:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return createPlacement(raw as Parameters<typeof createPlacement>[0])
  })

  handle('placement:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return updatePlacement(raw as Parameters<typeof updatePlacement>[0])
  })

  handle('placement:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return deletePlacement(raw as string)
  })

  handle('placement:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    return generatePlacementInvoice(raw as string)
  })

  handle('placement:kpis', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return getPlacementKPIs()
  })
}
