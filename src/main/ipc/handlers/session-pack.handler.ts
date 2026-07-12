import { requirePermission } from '../permission-guard'
import { getActivePack, listPacks, listAllActivePacks, createPack, deductSession, listSessionLogs, generateSessionPackInvoice } from '../../services/session-pack.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('sessionPack:getActive', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const { customerId } = payload as { customerId: string }
    return getActivePack(customerId)
  })

  handle('sessionPack:list', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const { customerId } = payload as { customerId: string }
    return listPacks(customerId)
  })

  handle('sessionPack:listAll', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listAllActivePacks()
  })

  handle('sessionPack:create', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const p = payload as Parameters<typeof createPack>[0]
    return createPack(p)
  })

  handle('sessionPack:deduct', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const p = payload as Parameters<typeof deductSession>[0]
    return deductSession(p)
  })

  handle('sessionPack:logs', async (payload) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const { clientSessionPackId } = payload as { clientSessionPackId: string }
    return listSessionLogs(clientSessionPackId)
  })

  handle('sessionPack:generateInvoice', async (payload) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const { id } = payload as { id: string }
    return generateSessionPackInvoice(id)
  })
}
