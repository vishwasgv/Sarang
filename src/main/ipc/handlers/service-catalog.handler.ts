import { requirePermission } from '../permission-guard'
import * as svc from '../../services/service-catalog.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('serviceCatalog:list', async (payload) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    return svc.listServices(payload as Parameters<typeof svc.listServices>[0])
  })

  handle('serviceCatalog:get', async (payload) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const { id } = payload as { id: string }
    return svc.getService(id)
  })

  handle('serviceCatalog:create', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    return svc.createService(payload as Parameters<typeof svc.createService>[0])
  })

  handle('serviceCatalog:update', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    return svc.updateService(payload as Parameters<typeof svc.updateService>[0])
  })

  handle('serviceCatalog:delete', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const { id } = payload as { id: string }
    return svc.deleteService(id)
  })

  handle('serviceCatalog:listCategories', async () => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    return svc.listCategories()
  })
}
