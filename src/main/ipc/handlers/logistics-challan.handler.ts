import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { listChallans, getChallan, createChallan, updateChallan, updateChallanStatus, recordChallanReturn, deleteChallan } from '../../services/logistics-challan.service'
import { CreateChallanSchema, UpdateChallanSchema, UpdateChallanStatusSchema, RecordChallanReturnSchema } from '../../validation/logistics-challan.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerLogisticsChallanHandlers(handle: HandleFn): void {
  handle('logisticsChallan:list', async (raw) => {
    const deny = await requirePermission('logistics.view'); if (deny) return deny
    return listChallans(raw as { status?: string; challanType?: string; customerId?: string })
  })

  handle('logisticsChallan:get', async (raw) => {
    const deny = await requirePermission('logistics.view'); if (deny) return deny
    return getChallan(raw as string)
  })

  handle('logisticsChallan:create', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    const parsed = CreateChallanSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createChallan(parsed.data, getCurrentSession()?.userId)
  })

  handle('logisticsChallan:update', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    const parsed = UpdateChallanSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateChallan(parsed.data, getCurrentSession()?.userId)
  })

  handle('logisticsChallan:updateStatus', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    const parsed = UpdateChallanStatusSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateChallanStatus(parsed.data, getCurrentSession()?.userId)
  })

  handle('logisticsChallan:recordReturn', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    const parsed = RecordChallanReturnSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return recordChallanReturn(parsed.data, getCurrentSession()?.userId)
  })

  handle('logisticsChallan:delete', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    return deleteChallan(raw as string, getCurrentSession()?.userId)
  })
}
