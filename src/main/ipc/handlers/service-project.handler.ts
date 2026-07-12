import { requirePermission } from '../permission-guard'
import {
  listServiceProjects, getServiceProject,
  createServiceProject, updateServiceProject, deleteServiceProject,
} from '../../services/service-project.service'
import { CreateServiceProjectSchema, UpdateServiceProjectSchema, ServiceProjectIdSchema } from '../../validation/service-project.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('serviceProject:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { clientId?: string; assignedToId?: string; status?: string }
    return listServiceProjects(payload)
  })

  handle('serviceProject:get', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { id: string }
    return getServiceProject(payload.id)
  })

  handle('serviceProject:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateServiceProjectSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createServiceProject(parsed.data)
  })

  handle('serviceProject:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateServiceProjectSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateServiceProject(parsed.data)
  })

  handle('serviceProject:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = ServiceProjectIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteServiceProject(parsed.data.id)
  })
}
