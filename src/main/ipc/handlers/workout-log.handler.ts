import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import {
  createWorkoutLog,
  deleteWorkoutLog,
  listWorkoutLogsForCustomer,
  listRecentWorkoutLogs,
  listKnownExerciseNames,
} from '../../services/workout-log.service'
import { CreateWorkoutLogSchema, CustomerIdQuerySchema, WorkoutLogIdSchema } from '../../validation/workout-log.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('workoutLog:create', async (raw) => {
    const deny = await requirePermission('workoutLog.manage'); if (deny) return deny
    const parsed = CreateWorkoutLogSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createWorkoutLog(parsed.data, getCurrentSession()?.userId)
  })

  handle('workoutLog:delete', async (raw) => {
    const deny = await requirePermission('workoutLog.manage'); if (deny) return deny
    const parsed = WorkoutLogIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteWorkoutLog(parsed.data.id, getCurrentSession()?.userId)
  })

  handle('workoutLog:listForCustomer', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = CustomerIdQuerySchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return listWorkoutLogsForCustomer(parsed.data.customerId, parsed.data.dateFrom, parsed.data.dateTo)
  })

  handle('workoutLog:listRecent', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { limit?: number }
    return listRecentWorkoutLogs(payload.limit)
  })

  handle('workoutLog:knownExerciseNames', async () => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    return listKnownExerciseNames()
  })
}
