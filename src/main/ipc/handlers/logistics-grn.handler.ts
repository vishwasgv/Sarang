import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { listGRNs, getGRN, createGRN, updateGRN, postGRN, deleteGRN, reverseGRN } from '../../services/logistics-grn.service'
import { CreateGRNSchema, UpdateGRNSchema } from '../../validation/logistics-grn.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerLogisticsGrnHandlers(handle: HandleFn): void {
  handle('logisticsGrn:list', async (raw) => {
    const deny = await requirePermission('logistics.view'); if (deny) return deny
    return listGRNs(raw as { status?: string; supplierId?: string; fromDate?: string; toDate?: string; offset?: number; limit?: number })
  })

  handle('logisticsGrn:get', async (raw) => {
    const deny = await requirePermission('logistics.view'); if (deny) return deny
    return getGRN(raw as string)
  })

  handle('logisticsGrn:create', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    const parsed = CreateGRNSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createGRN(parsed.data, getCurrentSession()?.userId)
  })

  handle('logisticsGrn:update', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    const parsed = UpdateGRNSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateGRN(parsed.data, getCurrentSession()?.userId)
  })

  handle('logisticsGrn:post', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    return postGRN(raw as string, getCurrentSession()?.userId)
  })

  handle('logisticsGrn:reverse', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    return reverseGRN(raw as string, getCurrentSession()?.userId)
  })

  handle('logisticsGrn:delete', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    return deleteGRN(raw as string, getCurrentSession()?.userId)
  })
}
