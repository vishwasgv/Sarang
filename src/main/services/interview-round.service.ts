import { getPrisma } from '../database/db'

export async function listInterviewRounds(filters: { candidateId?: string; jobOrderId?: string }) {
  const db = getPrisma()
  const where: Record<string, unknown> = {}
  if (filters.candidateId) where.candidateId = filters.candidateId
  if (filters.jobOrderId) where.jobOrderId = filters.jobOrderId
  const rounds = await db.interviewRound.findMany({
    where,
    include: { jobOrder: { select: { id: true, orderNumber: true, jobTitle: true } } },
    orderBy: [{ jobOrderId: 'asc' }, { roundNumber: 'asc' }],
  })
  return { success: true, data: rounds }
}

export async function createInterviewRound(payload: {
  candidateId: string
  jobOrderId: string
  roundNumber?: number
  roundType?: string
  scheduledDate?: string
  interviewerName?: string
  notes?: string
}) {
  const db = getPrisma()
  const candidate = await db.candidate.findUnique({ where: { id: payload.candidateId } })
  if (!candidate) return { success: false, error: { code: 'IR-001', message: 'Candidate not found.' } }
  const jobOrder = await db.jobOrder.findUnique({ where: { id: payload.jobOrderId } })
  if (!jobOrder) return { success: false, error: { code: 'IR-002', message: 'Job order not found.' } }

  // Auto-assign the next round number for this candidate/job-order pairing
  // when not explicitly given, mirroring board-resolution.service.ts's
  // per-scope auto-sequencing.
  let roundNumber = payload.roundNumber
  if (roundNumber == null) {
    const last = await db.interviewRound.findFirst({
      where: { candidateId: payload.candidateId, jobOrderId: payload.jobOrderId },
      orderBy: { roundNumber: 'desc' },
    })
    roundNumber = (last?.roundNumber ?? 0) + 1
  }

  const round = await db.interviewRound.create({
    data: {
      candidateId: payload.candidateId,
      jobOrderId: payload.jobOrderId,
      roundNumber,
      roundType: payload.roundType ?? 'PHONE_SCREEN',
      scheduledDate: payload.scheduledDate ? new Date(payload.scheduledDate) : null,
      interviewerName: payload.interviewerName || null,
      notes: payload.notes || null,
    },
    include: { jobOrder: { select: { id: true, orderNumber: true, jobTitle: true } } },
  })
  await db.auditLog.create({ data: { action: 'CREATE', entityType: 'InterviewRound', entityId: round.id, newValue: JSON.stringify({ candidateId: round.candidateId, jobOrderId: round.jobOrderId, roundNumber: round.roundNumber }) } }).catch(() => {})
  return { success: true, data: round }
}

export async function updateInterviewRound(payload: {
  id: string
  roundType?: string
  scheduledDate?: string | null
  status?: string
  interviewerName?: string | null
  clientFeedback?: string | null
  notes?: string | null
}) {
  const db = getPrisma()
  const { id, scheduledDate, ...rest } = payload
  const round = await db.interviewRound.update({
    where: { id },
    data: {
      ...rest,
      ...(scheduledDate !== undefined ? { scheduledDate: scheduledDate ? new Date(scheduledDate) : null } : {}),
    },
    include: { jobOrder: { select: { id: true, orderNumber: true, jobTitle: true } } },
  })
  await db.auditLog.create({ data: { action: 'UPDATE', entityType: 'InterviewRound', entityId: id } }).catch(() => {})
  return { success: true, data: round }
}

export async function deleteInterviewRound(id: string) {
  const db = getPrisma()
  await db.interviewRound.delete({ where: { id } })
  await db.auditLog.create({ data: { action: 'DELETE', entityType: 'InterviewRound', entityId: id } }).catch(() => {})
  return { success: true, data: { id } }
}
