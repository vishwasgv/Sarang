import { requirePermission } from '../permission-guard'
import * as svc from '../../services/service-catalog.service'
import { CreateServiceSchema, UpdateServiceSchema, ServiceIdSchema } from '../../validation/service-catalog.validation'

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
    const parsed = CreateServiceSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return svc.createService(parsed.data)
  })

  handle('serviceCatalog:update', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = UpdateServiceSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return svc.updateService(parsed.data)
  })

  handle('serviceCatalog:delete', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = ServiceIdSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return svc.deleteService(parsed.data.id)
  })

  handle('serviceCatalog:listCategories', async () => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    return svc.listCategories()
  })
}
