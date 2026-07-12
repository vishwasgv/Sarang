import { listBoms, getBom, upsertBom, deleteBom } from '../../services/bom.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { UpsertBomSchema, DeleteBomSchema } from '../../validation/bom.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('bom:list', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    return listBoms(payload as Parameters<typeof listBoms>[0])
  })

  handle('bom:get', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    const p = (payload ?? {}) as { productId: string }
    return getBom(p.productId)
  })

  handle('bom:upsert', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    const parsed = UpsertBomSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return upsertBom(parsed.data, getCurrentSession()?.userId)
  })

  handle('bom:delete', async (payload) => {
    const deny = await requirePermission('inventory.manage'); if (deny) return deny
    const parsed = DeleteBomSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteBom(parsed.data.productId, getCurrentSession()?.userId)
  })
}
