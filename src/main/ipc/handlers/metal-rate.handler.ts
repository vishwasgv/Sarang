import { listMetalRates, getMetalRate, upsertMetalRate, deleteMetalRate } from '../../services/metal-rate.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('metalRate:list', async () => {
    const deny = await requirePermission('jewellery.view'); if (deny) return deny
    return listMetalRates()
  })

  handle('metalRate:get', async (payload) => {
    const deny = await requirePermission('jewellery.view'); if (deny) return deny
    const { metalType, purity } = payload as { metalType: string; purity: string }
    return getMetalRate(metalType, purity)
  })

  handle('metalRate:upsert', async (payload) => {
    const deny = await requirePermission('jewellery.manageRates'); if (deny) return deny
    const session = getCurrentSession()
    return upsertMetalRate({ ...(payload as Parameters<typeof upsertMetalRate>[0]), updatedById: session?.userId })
  })

  handle('metalRate:delete', async (payload) => {
    const deny = await requirePermission('jewellery.manageRates'); if (deny) return deny
    const { id } = payload as { id: string }
    return deleteMetalRate(id)
  })
}
