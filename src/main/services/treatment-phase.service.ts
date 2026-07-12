import { getPrisma } from '../database/db'

export async function listTreatmentPhases(patientId: string) {
  try {
    const db = getPrisma()
    const phases = await db.treatmentPhase.findMany({
      where: { patientId },
      include: { createdBy: { select: { id: true, fullName: true } } },
      orderBy: { startDate: 'desc' },
    })
    return { success: true, data: phases }
  } catch (err) {
    return { success: false, error: { code: 'TP26-001', message: err instanceof Error ? err.message : 'Could not list treatment phases.' } }
  }
}

const VALID_PHASES = ['ASSESSMENT', 'ACUTE', 'SUB_ACUTE', 'REHABILITATION', 'MAINTENANCE', 'DISCHARGE'] as const

export async function createTreatmentPhase(payload: {
  patientId: string
  phase?: string
  title: string
  startDate: string
  goals?: string
  createdById?: string
  userId?: string
}) {
  try {
    const resolvedPhase = payload.phase ?? 'ASSESSMENT'
    if (!VALID_PHASES.includes(resolvedPhase as typeof VALID_PHASES[number])) {
      return { success: false, error: { code: 'TP26-VAL', message: `Invalid phase "${resolvedPhase}". Must be one of: ${VALID_PHASES.join(', ')}` } }
    }
    const db = getPrisma()
    const phase = await db.treatmentPhase.create({
      data: {
        patientId: payload.patientId,
        phase: resolvedPhase,
        title: payload.title,
        startDate: new Date(payload.startDate),
        goals: payload.goals || null,
        isActive: true,
        createdById: payload.createdById ?? null,
      },
    })

    await db.auditLog.create({
      data: { userId: payload.userId ?? null, action: 'CREATE', entityType: 'TreatmentPhase', entityId: phase.id, newValue: JSON.stringify({ patientId: payload.patientId, phase: phase.phase }) },
    }).catch(() => {})

    return { success: true, data: phase }
  } catch (err) {
    return { success: false, error: { code: 'TP26-002', message: err instanceof Error ? err.message : 'Could not create treatment phase.' } }
  }
}

export async function updateTreatmentPhase(payload: {
  id: string
  phase?: string
  title?: string
  startDate?: string
  goals?: string | null
}) {
  try {
    if (payload.phase !== undefined && !VALID_PHASES.includes(payload.phase as typeof VALID_PHASES[number])) {
      return { success: false, error: { code: 'TP26-VAL', message: `Invalid phase "${payload.phase}". Must be one of: ${VALID_PHASES.join(', ')}` } }
    }
    const db = getPrisma()
    const { id, startDate, ...rest } = payload
    const phase = await db.treatmentPhase.update({
      where: { id },
      data: {
        ...rest,
        ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
      },
    })

    await db.auditLog.create({
      data: { action: 'UPDATE', entityType: 'TreatmentPhase', entityId: id },
    }).catch(() => {})

    return { success: true, data: phase }
  } catch (err) {
    return { success: false, error: { code: 'TP26-003', message: err instanceof Error ? err.message : 'Could not update treatment phase.' } }
  }
}

export async function closeTreatmentPhase(payload: { id: string; outcome?: string }) {
  try {
    const db = getPrisma()
    const existing = await db.treatmentPhase.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'TP26-NOT-FOUND', message: 'Treatment phase not found.' } }
    if (!existing.isActive) return { success: false, error: { code: 'TP26-ALREADY-CLOSED', message: 'Treatment phase is already closed.' } }
    const phase = await db.treatmentPhase.update({
      where: { id: payload.id },
      data: {
        isActive: false,
        endDate: new Date(),
        outcome: payload.outcome ?? null,
      },
    })

    await db.auditLog.create({
      data: { action: 'CLOSE', entityType: 'TreatmentPhase', entityId: payload.id },
    }).catch(() => {})

    return { success: true, data: phase }
  } catch (err) {
    return { success: false, error: { code: 'TP26-004', message: err instanceof Error ? err.message : 'Could not close treatment phase.' } }
  }
}
