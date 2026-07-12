import { getPrisma } from '../database/db'

// CoachingBatch.feePerMonth is a Prisma Decimal field — Electron's IPC
// (structured clone) cannot serialize a Decimal instance and throws "An
// object could not be cloned" on every response that includes one. Exported
// so coaching-batch-enrollment.service.ts can apply it to the nested `batch`
// object returned by listEnrollmentsByStudent's `include: { batch }`.
export function serializeBatch<T extends { feePerMonth: unknown }>(b: T): T {
  return { ...b, feePerMonth: Number(b.feePerMonth) }
}

export async function listBatches(filters?: { status?: string; search?: string }) {
  const db = getPrisma()
  const where: Record<string, unknown> = {}
  if (filters?.status) where.status = filters.status
  if (filters?.search) where.batchName = { contains: filters.search }

  const batches = await db.coachingBatch.findMany({
    where,
    include: {
      instructor: { select: { id: true, fullName: true } },
      _count: { select: { enrollments: true } },
    },
    orderBy: [{ status: 'asc' }, { batchName: 'asc' }],
  })
  return { success: true, data: batches.map(serializeBatch) }
}

export async function createBatch(payload: {
  batchName: string
  subjectOrCourse: string
  instructorId?: string
  scheduleDays?: string[]
  scheduleTime?: string
  roomOrLocation?: string
  maxCapacity?: number
  startDate: string
  endDate?: string
  feePerMonth: number
  status?: string
}) {
  const db = getPrisma()
  const batch = await db.coachingBatch.create({
    data: {
      batchName: payload.batchName,
      subjectOrCourse: payload.subjectOrCourse,
      instructorId: payload.instructorId || null,
      scheduleDays: JSON.stringify(payload.scheduleDays ?? []),
      scheduleTime: payload.scheduleTime || null,
      roomOrLocation: payload.roomOrLocation || null,
      maxCapacity: payload.maxCapacity ?? 20,
      startDate: new Date(payload.startDate),
      endDate: payload.endDate ? new Date(payload.endDate) : null,
      feePerMonth: payload.feePerMonth,
      status: payload.status ?? 'ACTIVE',
    },
    include: {
      instructor: { select: { id: true, fullName: true } },
      _count: { select: { enrollments: true } },
    },
  })
  await db.auditLog.create({ data: { action: 'CREATE', entityType: 'CoachingBatch', entityId: batch.id, newValue: JSON.stringify({ batchName: batch.batchName }) } }).catch(() => {})
  return { success: true, data: serializeBatch(batch) }
}

export async function updateBatch(payload: {
  id: string
  batchName?: string
  subjectOrCourse?: string
  instructorId?: string | null
  scheduleDays?: string[]
  scheduleTime?: string | null
  roomOrLocation?: string | null
  maxCapacity?: number
  startDate?: string
  endDate?: string | null
  feePerMonth?: number
  status?: string
}) {
  const db = getPrisma()
  const { id, startDate, endDate, scheduleDays, ...rest } = payload
  const batch = await db.coachingBatch.update({
    where: { id },
    data: {
      ...rest,
      ...(scheduleDays !== undefined ? { scheduleDays: JSON.stringify(scheduleDays) } : {}),
      ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
      ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
    },
    include: {
      instructor: { select: { id: true, fullName: true } },
      _count: { select: { enrollments: true } },
    },
  })
  await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'CoachingBatch', entityId: batch.id } }).catch(() => {})
  return { success: true, data: serializeBatch(batch) }
}

export async function deleteBatch(id: string) {
  const db = getPrisma()
  await db.coachingBatch.delete({ where: { id } })
  await db.auditLog.create({ data: { action: 'DELETE', entityType: 'CoachingBatch', entityId: id } }).catch(() => {})
  return { success: true }
}

export async function getBatchKPIs() {
  const db = getPrisma()
  const [totalBatches, activeBatches, activeEnrollments] = await Promise.all([
    db.coachingBatch.count(),
    db.coachingBatch.count({ where: { status: 'ACTIVE' } }),
    db.coachingBatchEnrollment.findMany({
      where: { status: 'ACTIVE', batch: { status: 'ACTIVE' } },
      select: { effectiveFee: true },
    }),
  ])
  const totalEnrolled = activeEnrollments.length
  const totalMonthlyRevenue = activeEnrollments.reduce((s, e) => s + Number(e.effectiveFee), 0)
  return { success: true, data: { totalBatches, activeBatches, totalEnrolled, totalMonthlyRevenue } }
}
