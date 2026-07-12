import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { listFreightLedger, createFreightEntry, updateFreightEntry, markFreightPaid, deleteFreightEntry, getFreightSummary } from '../../services/logistics-freight.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerLogisticsFreightHandlers(handle: HandleFn): void {
  handle('logisticsFreight:list', async (raw) => {
    const deny = await requirePermission('logistics.view'); if (deny) return deny
    return listFreightLedger(raw as Parameters<typeof listFreightLedger>[0])
  })

  handle('logisticsFreight:create', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    return createFreightEntry(raw as Parameters<typeof createFreightEntry>[0], getCurrentSession()?.userId)
  })

  handle('logisticsFreight:update', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    return updateFreightEntry(raw as Parameters<typeof updateFreightEntry>[0], getCurrentSession()?.userId)
  })

  handle('logisticsFreight:markPaid', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    return markFreightPaid(raw as Parameters<typeof markFreightPaid>[0], getCurrentSession()?.userId)
  })

  handle('logisticsFreight:delete', async (raw) => {
    const deny = await requirePermission('logistics.manage'); if (deny) return deny
    return deleteFreightEntry(raw as string, getCurrentSession()?.userId)
  })

  handle('logisticsFreight:summary', async (raw) => {
    const deny = await requirePermission('logistics.view'); if (deny) return deny
    return getFreightSummary(raw as Parameters<typeof getFreightSummary>[0])
  })
}
