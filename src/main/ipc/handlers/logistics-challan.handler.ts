import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { listChallans, getChallan, createChallan, updateChallan, updateChallanStatus, recordChallanReturn, deleteChallan } from '../../services/logistics-challan.service'

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
    return createChallan(raw as Parameters<typeof createChallan>[0], getCurrentSession()?.userId)
  })

  handle('logisticsChallan:update', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    return updateChallan(raw as Parameters<typeof updateChallan>[0], getCurrentSession()?.userId)
  })

  handle('logisticsChallan:updateStatus', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    return updateChallanStatus(raw as { id: string; status: string }, getCurrentSession()?.userId)
  })

  handle('logisticsChallan:recordReturn', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    return recordChallanReturn(raw as Parameters<typeof recordChallanReturn>[0], getCurrentSession()?.userId)
  })

  handle('logisticsChallan:delete', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    return deleteChallan(raw as string, getCurrentSession()?.userId)
  })
}
