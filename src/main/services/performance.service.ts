import { getPrisma } from '../database/db'

export async function listPerformances(filters?: { batchId?: string }) {
  const db = getPrisma()
  const where: Record<string, unknown> = {}
  if (filters?.batchId) where.batchId = filters.batchId

  const performances = await db.performance.findMany({
    where,
    include: {
      batch: { select: { id: true, batchName: true, subjectOrCourse: true } },
    },
    orderBy: { date: 'desc' },
  })
  return { success: true, data: performances }
}

export async function createPerformance(payload: {
  batchId: string
  performanceName: string
  date: string
  venue?: string
  participatingStudentIds?: string[]
  notes?: string
}) {
  const db = getPrisma()
  const performance = await db.performance.create({
    data: {
      batchId: payload.batchId,
      performanceName: payload.performanceName,
      date: new Date(payload.date),
      venue: payload.venue || null,
      participatingStudentIds: JSON.stringify(payload.participatingStudentIds ?? []),
      notes: payload.notes || null,
    },
    include: {
      batch: { select: { id: true, batchName: true, subjectOrCourse: true } },
    },
  })
  return { success: true, data: performance }
}

export async function updatePerformance(payload: {
  id: string
  performanceName?: string
  date?: string
  venue?: string | null
  participatingStudentIds?: string[]
  notes?: string | null
}) {
  const db = getPrisma()
  const { id, date, participatingStudentIds, ...rest } = payload
  const performance = await db.performance.update({
    where: { id },
    data: {
      ...rest,
      ...(date !== undefined ? { date: new Date(date) } : {}),
      ...(participatingStudentIds !== undefined
        ? { participatingStudentIds: JSON.stringify(participatingStudentIds) }
        : {}),
    },
    include: {
      batch: { select: { id: true, batchName: true, subjectOrCourse: true } },
    },
  })
  return { success: true, data: performance }
}

export async function deletePerformance(id: string) {
  const db = getPrisma()
  await db.performance.delete({ where: { id } })
  return { success: true }
}
