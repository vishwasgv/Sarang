import { listDispatch, createDispatch, updateDispatchStatus } from '../../services/dispatch.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateDispatchSchema, UpdateDispatchStatusSchema } from '../../validation/dispatch.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('dispatch:list', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    return listDispatch(payload as Parameters<typeof listDispatch>[0])
  })

  handle('dispatch:create', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    const parsed = CreateDispatchSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createDispatch(parsed.data, getCurrentSession()?.userId)
  })

  handle('dispatch:updateStatus', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    const parsed = UpdateDispatchStatusSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateDispatchStatus(parsed.data, getCurrentSession()?.userId)
  })
}
