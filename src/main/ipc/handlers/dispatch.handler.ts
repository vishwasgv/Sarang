import { listDispatch, createDispatch, updateDispatchStatus } from '../../services/dispatch.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('dispatch:list', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    return listDispatch(payload as Parameters<typeof listDispatch>[0])
  })

  handle('dispatch:create', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    return createDispatch(payload as Parameters<typeof createDispatch>[0], getCurrentSession()?.userId)
  })

  handle('dispatch:updateStatus', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    return updateDispatchStatus(payload as Parameters<typeof updateDispatchStatus>[0], getCurrentSession()?.userId)
  })
}
