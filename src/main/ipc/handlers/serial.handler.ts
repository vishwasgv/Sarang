import { listSerials, createSerial, bulkCreateSerials, updateSerialStatus, searchByImei } from '../../services/serial.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('serials:list', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    return listSerials(payload as Parameters<typeof listSerials>[0])
  })

  handle('serials:create', async (payload) => {
    const deny = await requirePermission('inventory.addStock'); if (deny) return deny
    return createSerial(payload as Parameters<typeof createSerial>[0], getCurrentSession()?.userId)
  })

  handle('serials:bulkCreate', async (payload) => {
    const deny = await requirePermission('inventory.addStock'); if (deny) return deny
    return bulkCreateSerials(payload as Parameters<typeof bulkCreateSerials>[0], getCurrentSession()?.userId)
  })

  handle('serials:updateStatus', async (payload) => {
    const deny = await requirePermission('inventory.adjustStock'); if (deny) return deny
    return updateSerialStatus(payload as Parameters<typeof updateSerialStatus>[0], getCurrentSession()?.userId)
  })

  handle('serials:searchByImei', async (payload) => {
    const deny = await requirePermission('inventory.view'); if (deny) return deny
    const p = (payload ?? {}) as { imei: string }
    return searchByImei(p.imei)
  })
}
