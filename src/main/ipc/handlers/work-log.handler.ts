import { listWorkLogs, createWorkLog, deleteWorkLog } from '../../services/work-log.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateWorkLogSchema, DeleteWorkLogSchema } from '../../validation/work-log.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('workLogs:list', async (payload) => {
    const deny = await requirePermission('sales.view'); if (deny) return deny
    return listWorkLogs(payload as Parameters<typeof listWorkLogs>[0])
  })

  handle('workLogs:create', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    const parsed = CreateWorkLogSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createWorkLog(parsed.data, getCurrentSession()?.userId)
  })

  handle('workLogs:delete', async (payload) => {
    const deny = await requirePermission('sales.manage'); if (deny) return deny
    const parsed = DeleteWorkLogSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteWorkLog(parsed.data.id, getCurrentSession()?.userId)
  })
}
