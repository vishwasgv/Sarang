import { getPrisma } from '../database/db'
import { parseLocalDateStart, parseLocalDateEnd } from '../utils/date.util'
import { logAction } from './audit.service'

// 2026-09 — Gym/Studio: machine-based workout progress tracking. One row per
// logged set, so the same exercise/machine can be trended over time for a
// member (weight/reps/sets progression) — see prisma/schema.prisma's
// WorkoutLog model comment for why this is a new model rather than reusing
// ExerciseProgram (a static prescribed-exercise sheet, not a growing log) or
// SessionLog (a session-pack deduction record with no set-level numbers).

// WorkoutLog.weight is a Prisma Decimal — Electron's IPC (structured clone)
// cannot serialize a Decimal instance and throws "An object could not be
// cloned" on every response that includes one. Same pattern as
// membership.service.ts's serializePlan.
function serializeWorkoutLog<T extends { weight: unknown }>(row: T): T {
  return { ...row, weight: row.weight == null ? null : Number(row.weight) }
}

export interface CreateWorkoutLogInput {
  customerId: string
  trainerId?: string | null
  exerciseName: string
  machineName?: string | null
  weight?: number | null
  reps?: number | null
  sets?: number | null
  notes?: string | null
  loggedAt?: string
}

export async function createWorkoutLog(input: CreateWorkoutLogInput, userId?: string) {
  try {
    const db = getPrisma()

    const customer = await db.customer.findUnique({ where: { id: input.customerId }, select: { id: true } })
    if (!customer) return { success: false, error: { code: 'WL-001', message: 'Customer not found.' } }

    if (input.trainerId) {
      const trainer = await db.employee.findUnique({ where: { id: input.trainerId }, select: { id: true } })
      if (!trainer) return { success: false, error: { code: 'WL-002', message: 'Trainer not found.' } }
    }

    const row = await db.workoutLog.create({
      data: {
        customerId: input.customerId,
        trainerId: input.trainerId || null,
        exerciseName: input.exerciseName,
        machineName: input.machineName || null,
        weight: input.weight ?? null,
        reps: input.reps ?? null,
        sets: input.sets ?? null,
        notes: input.notes || null,
        loggedAt: input.loggedAt ? parseLocalDateStart(input.loggedAt) : new Date(),
      },
    })

    await logAction({ userId, action: 'WORKOUT_LOG_CREATED', entityType: 'WorkoutLog', entityId: row.id, newValue: { customerId: input.customerId, exerciseName: input.exerciseName } })

    return { success: true, data: serializeWorkoutLog(row) }
  } catch (err) {
    return { success: false, error: { code: 'WL-003', message: err instanceof Error ? err.message : 'Could not log workout.' } }
  }
}

export async function deleteWorkoutLog(id: string, userId?: string) {
  try {
    const db = getPrisma()
    const row = await db.workoutLog.findUnique({ where: { id } })
    if (!row) return { success: false, error: { code: 'WL-001', message: 'Workout log not found.' } }
    await db.workoutLog.delete({ where: { id } })
    await logAction({ userId, action: 'WORKOUT_LOG_DELETED', entityType: 'WorkoutLog', entityId: id })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'WL-004', message: err instanceof Error ? err.message : 'Could not delete workout log.' } }
  }
}

// Full history for one member — used by the progress view (a per-exercise
// weight/reps trend over time), and by ProgressChart's own client-side
// grouping (grouping by exerciseName happens in the renderer, not here, to
// keep this a plain flat list callers can filter/aggregate however they need).
export async function listWorkoutLogsForCustomer(customerId: string, dateFrom?: string, dateTo?: string) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = { customerId }
    if (dateFrom || dateTo) {
      where.loggedAt = {
        ...(dateFrom ? { gte: parseLocalDateStart(dateFrom) } : {}),
        ...(dateTo ? { lte: parseLocalDateEnd(dateTo) } : {}),
      }
    }
    const rows = await db.workoutLog.findMany({
      where,
      include: { trainer: { select: { id: true, fullName: true } } },
      orderBy: { loggedAt: 'desc' },
    })
    return { success: true, data: rows.map(serializeWorkoutLog) }
  } catch (err) {
    return { success: false, error: { code: 'WL-005', message: err instanceof Error ? err.message : 'Could not load workout logs.' } }
  }
}

// Recent logs across every member — the Workout Log screen's default landing
// list (mirrors listAll()'s shape in session-pack.service.ts).
export async function listRecentWorkoutLogs(limit = 100) {
  try {
    const db = getPrisma()
    const rows = await db.workoutLog.findMany({
      include: {
        customer: { select: { id: true, customerName: true, phone: true } },
        trainer: { select: { id: true, fullName: true } },
      },
      orderBy: { loggedAt: 'desc' },
      take: limit,
    })
    return { success: true, data: rows.map(serializeWorkoutLog) }
  } catch (err) {
    return { success: false, error: { code: 'WL-006', message: err instanceof Error ? err.message : 'Could not load workout logs.' } }
  }
}

// Distinct exercise/machine names already logged for this business — powers
// an autocomplete so a trainer picks from what's already in use rather than
// retyping (and accidentally fragmenting) the same exercise name every time.
export async function listKnownExerciseNames() {
  try {
    const db = getPrisma()
    const rows = await db.workoutLog.findMany({ select: { exerciseName: true }, distinct: ['exerciseName'], orderBy: { exerciseName: 'asc' } })
    return { success: true, data: rows.map((r) => r.exerciseName) }
  } catch (err) {
    return { success: false, error: { code: 'WL-007', message: err instanceof Error ? err.message : 'Could not load exercise names.' } }
  }
}
