import { getPrisma } from '../database/db'
import { serializeBatch } from './coaching-batch.service'

// CoachingBatchEnrollment.discountAmount/effectiveFee are Prisma Decimal
// fields — Electron's IPC (structured clone) cannot serialize a Decimal
// instance and throws "An object could not be cloned" on every response
// that includes one. listEnrollmentsByStudent also nests `batch` (its own
// Decimal field, feePerMonth), serialized via the shared helper from
// coaching-batch.service.ts so the fix stays in one place. Exported so
// coaching-fee.service.ts can apply it to the nested `enrollment` object
// returned by listFees/updateFeeRecord's `include: { enrollment }`.
export function serializeEnrollment<T extends { discountAmount: unknown; effectiveFee: unknown; batch?: unknown }>(e: T): T {
  // Only some callers' `include: { batch }` actually selects feePerMonth
  // (e.g. listEnrollmentsByStudent does; coaching-fee.service.ts's nested
  // enrollment.batch doesn't). Guard on real property presence rather than
  // truthiness of `batch` — calling serializeBatch on an object that never
  // had feePerMonth selected would inject a spurious `feePerMonth: NaN`.
  const batch = e.batch as { feePerMonth?: unknown } | undefined
  return {
    ...e,
    discountAmount: Number(e.discountAmount),
    effectiveFee: Number(e.effectiveFee),
    ...(batch && 'feePerMonth' in batch ? { batch: serializeBatch(batch as Parameters<typeof serializeBatch>[0]) } : {}),
  }
}

export async function listEnrollmentsByBatch(batchId: string) {
  const db = getPrisma()
  const enrollments = await db.coachingBatchEnrollment.findMany({
    where: { batchId },
    include: {
      student: { select: { id: true, customerName: true, phone: true } },
    },
    orderBy: [{ status: 'asc' }, { student: { customerName: 'asc' } }],
  })
  return { success: true, data: enrollments.map(serializeEnrollment) }
}

export async function listEnrollmentsByStudent(studentId: string) {
  const db = getPrisma()
  const enrollments = await db.coachingBatchEnrollment.findMany({
    where: { studentId },
    include: {
      batch: { select: { id: true, batchName: true, subjectOrCourse: true, feePerMonth: true } },
    },
    orderBy: { enrolledDate: 'desc' },
  })
  return { success: true, data: enrollments.map(serializeEnrollment) }
}

export async function createEnrollment(payload: {
  batchId: string
  studentId: string
  discountType?: string
  discountAmount?: number
  effectiveFee: number
  enrolledDate?: string
  notes?: string
}) {
  const db = getPrisma()
  const existing = await db.coachingBatchEnrollment.findUnique({
    where: { batchId_studentId: { batchId: payload.batchId, studentId: payload.studentId } },
  })
  if (existing) {
    return { success: false, error: { code: 'ENR-001', message: 'Student is already enrolled in this batch.' } }
  }

  const batch = await db.coachingBatch.findUnique({ where: { id: payload.batchId } })
  if (!batch) return { success: false, error: { code: 'ENR-002', message: 'Batch not found.' } }

  const activeCount = await db.coachingBatchEnrollment.count({
    where: { batchId: payload.batchId, status: 'ACTIVE' },
  })
  if (activeCount >= batch.maxCapacity) {
    return { success: false, error: { code: 'ENR-003', message: `Batch is at full capacity (${batch.maxCapacity} students).` } }
  }

  const enrollment = await db.coachingBatchEnrollment.create({
    data: {
      batchId: payload.batchId,
      studentId: payload.studentId,
      discountType: payload.discountType ?? 'NONE',
      discountAmount: payload.discountAmount ?? 0,
      effectiveFee: payload.effectiveFee,
      enrolledDate: payload.enrolledDate ? new Date(payload.enrolledDate) : new Date(),
      notes: payload.notes || null,
    },
    include: {
      student: { select: { id: true, customerName: true, phone: true } },
    },
  })
  await db.auditLog.create({ data: { action: 'ENROLLED', entityType: 'CoachingBatchEnrollment', entityId: enrollment.id, newValue: JSON.stringify({ batchId: enrollment.batchId, studentId: enrollment.studentId }) } }).catch(() => {})
  return { success: true, data: serializeEnrollment(enrollment) }
}

export async function updateEnrollment(payload: {
  id: string
  status?: string
  discountType?: string
  discountAmount?: number
  effectiveFee?: number
  notes?: string | null
}) {
  const db = getPrisma()
  const { id, ...rest } = payload
  const enrollment = await db.coachingBatchEnrollment.update({
    where: { id },
    data: rest,
    include: {
      student: { select: { id: true, customerName: true, phone: true } },
    },
  })
  await db.auditLog.create({ data: { action: payload.status === 'INACTIVE' ? 'WITHDRAWN' : 'UPDATE', entityType: 'CoachingBatchEnrollment', entityId: enrollment.id } }).catch(() => {})
  return { success: true, data: serializeEnrollment(enrollment) }
}

export async function deleteEnrollment(id: string) {
  const db = getPrisma()
  await db.coachingBatchEnrollment.delete({ where: { id } })
  await db.auditLog.create({ data: { action: 'DELETE', entityType: 'CoachingBatchEnrollment', entityId: id } }).catch(() => {})
  return { success: true }
}
