import { driverDutyLogService } from '../../services/driver-duty-log.service'
import { requirePermission } from '../permission-guard'
import { StartDutySchema, CloseDutySchema } from '../../validation/driver-duty-log.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

// 2026-09 §12 — Tours & Travels: driver duty log & excess-km/hour settlement.
export function register(handle: HandleFn): void {
  handle('driverDutyLog:list', async (payload) => {
    const deny = await requirePermission('driverDutyLog.view'); if (deny) return deny
    return driverDutyLogService.listDutyLogs(payload as Parameters<typeof driverDutyLogService.listDutyLogs>[0])
  })

  handle('driverDutyLog:start', async (payload) => {
    const deny = await requirePermission('driverDutyLog.manage'); if (deny) return deny
    const parsed = StartDutySchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return driverDutyLogService.startDuty(parsed.data)
  })

  handle('driverDutyLog:close', async (payload) => {
    const deny = await requirePermission('driverDutyLog.manage'); if (deny) return deny
    const parsed = CloseDutySchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return driverDutyLogService.closeDuty(parsed.data)
  })
}
