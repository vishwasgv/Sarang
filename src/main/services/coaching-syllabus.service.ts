import { getPrisma } from '../database/db'

// Phase 58 §2 — Coaching Institute: topic-by-topic syllabus coverage per
// batch, so "how much of the syllabus is actually done" is a real tracked
// fact instead of living only in an instructor's head.

export async function listSyllabusTopics(batchId: string) {
  try {
    const db = getPrisma()
    const topics = await db.syllabusTopic.findMany({
      where: { batchId },
      orderBy: [{ sequenceOrder: 'asc' }, { createdAt: 'asc' }],
    })
    return { success: true, data: topics }
  } catch (err) {
    return { success: false, error: { code: 'SYL-001', message: err instanceof Error ? err.message : 'Could not list syllabus topics.' } }
  }
}

export async function createSyllabusTopic(payload: {
  batchId: string
  topicName: string
  sequenceOrder?: number
  plannedDate?: string
  notes?: string
}) {
  try {
    const db = getPrisma()
    const topic = await db.syllabusTopic.create({
      data: {
        batchId: payload.batchId,
        topicName: payload.topicName,
        sequenceOrder: payload.sequenceOrder ?? 0,
        plannedDate: payload.plannedDate ? new Date(payload.plannedDate) : null,
        notes: payload.notes || null,
      },
    })
    await db.auditLog.create({ data: { action: 'CREATE', entityType: 'SyllabusTopic', entityId: topic.id, newValue: JSON.stringify({ batchId: topic.batchId, topicName: topic.topicName }) } }).catch(() => {})
    return { success: true, data: topic }
  } catch (err) {
    return { success: false, error: { code: 'SYL-002', message: err instanceof Error ? err.message : 'Could not create syllabus topic.' } }
  }
}

export async function updateSyllabusTopic(payload: {
  id: string
  topicName?: string
  sequenceOrder?: number
  plannedDate?: string | null
  status?: string
  notes?: string | null
}) {
  try {
    const db = getPrisma()
    const { id, plannedDate, status, ...rest } = payload

    // Completing a topic stamps completedDate automatically; reverting it
    // back to PENDING clears that stamp rather than leaving a stale date on
    // a topic that's no longer marked done.
    const statusData =
      status === 'COMPLETED' ? { status, completedDate: new Date() } :
      status === 'PENDING' ? { status, completedDate: null } :
      {}

    const topic = await db.syllabusTopic.update({
      where: { id },
      data: {
        ...rest,
        ...statusData,
        ...(plannedDate !== undefined ? { plannedDate: plannedDate ? new Date(plannedDate) : null } : {}),
      },
    })
    await db.auditLog.create({ data: { action: status === 'COMPLETED' ? 'COMPLETED' : 'UPDATE', entityType: 'SyllabusTopic', entityId: topic.id } }).catch(() => {})
    return { success: true, data: topic }
  } catch (err) {
    return { success: false, error: { code: 'SYL-003', message: err instanceof Error ? err.message : 'Could not update syllabus topic.' } }
  }
}

export async function deleteSyllabusTopic(id: string) {
  try {
    const db = getPrisma()
    await db.syllabusTopic.delete({ where: { id } })
    await db.auditLog.create({ data: { action: 'DELETE', entityType: 'SyllabusTopic', entityId: id } }).catch(() => {})
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'SYL-004', message: err instanceof Error ? err.message : 'Could not delete syllabus topic.' } }
  }
}

export async function getSyllabusProgress(batchId: string) {
  try {
    const db = getPrisma()
    const [total, completed] = await Promise.all([
      db.syllabusTopic.count({ where: { batchId } }),
      db.syllabusTopic.count({ where: { batchId, status: 'COMPLETED' } }),
    ])
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0
    return { success: true, data: { total, completed, percent } }
  } catch (err) {
    return { success: false, error: { code: 'SYL-005', message: err instanceof Error ? err.message : 'Could not compute syllabus progress.' } }
  }
}
