import { listWorkLogs, createWorkLog, deleteWorkLog } from '../../services/work-log.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('workLogs:list', async (payload) => {
    const deny = await requirePermission('sales.view'); if (deny) return deny
    return listWorkLogs(payload as Parameters<typeof listWorkLogs>[0])
  })

  handle('workLogs:create', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    return createWorkLog(payload as Parameters<typeof createWorkLog>[0], getCurrentSession()?.userId)
  })

  handle('workLogs:delete', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    const p = payload as { id: string }
    return deleteWorkLog(p.id, getCurrentSession()?.userId)
  })
}
