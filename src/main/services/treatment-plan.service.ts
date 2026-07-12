import { getPrisma } from '../database/db'

// TreatmentPlan.totalEstimatedCost is a Prisma Decimal, not a plain number —
// Electron's IPC (structured clone) cannot serialize a Decimal instance and
// throws "An object could not be cloned" on every response that includes one,
// including from create()/update() returning the row they just wrote. This
// was masked until now by the recordedById/createdById FK bug always
// throwing first.
function serializePlan<T extends { totalEstimatedCost: unknown }>(plan: T): T {
  return { ...plan, totalEstimatedCost: Number(plan.totalEstimatedCost) }
}

export async function listTreatmentPlans(patientId: string) {
  try {
    const db = getPrisma()
    const plans = await db.treatmentPlan.findMany({
      where: { patientId },
      include: { createdBy: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: plans.map(serializePlan) }
  } catch (err) {
    return { success: false, error: { code: 'TP-001', message: err instanceof Error ? err.message : 'Could not list treatment plans.' } }
  }
}

export async function getTreatmentPlan(id: string) {
  try {
    const db = getPrisma()
    const plan = await db.treatmentPlan.findUnique({
      where: { id },
      include: {
        patient: { select: { id: true, customerName: true, phone: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    })
    if (!plan) return { success: false, error: { code: 'TP-002', message: 'Treatment plan not found.' } }
    return { success: true, data: serializePlan(plan) }
  } catch (err) {
    return { success: false, error: { code: 'TP-002', message: err instanceof Error ? err.message : 'Could not fetch treatment plan.' } }
  }
}

export async function createTreatmentPlan(payload: {
  patientId: string
  createdById?: string
  userId?: string
  title?: string
  status?: string
  planItems?: string
  totalEstimatedCost?: number
  notes?: string
}) {
  try {
    const db = getPrisma()
    const plan = await db.treatmentPlan.create({
      data: {
        patientId: payload.patientId,
        createdById: payload.createdById ?? null,
        title: payload.title ?? 'Treatment Plan',
        status: payload.status ?? 'PROPOSED',
        planItems: payload.planItems ?? '[]',
        totalEstimatedCost: payload.totalEstimatedCost ?? 0,
        notes: payload.notes ?? null,
      },
    })

    await db.auditLog.create({
      data: { userId: payload.userId ?? null, action: 'CREATE', entityType: 'TreatmentPlan', entityId: plan.id, newValue: JSON.stringify({ patientId: payload.patientId }) },
    }).catch(() => {})

    return { success: true, data: serializePlan(plan) }
  } catch (err) {
    return { success: false, error: { code: 'TP-003', message: err instanceof Error ? err.message : 'Could not create treatment plan.' } }
  }
}

export async function updateTreatmentPlan(payload: {
  id: string
  title?: string
  status?: string
  planItems?: string
  totalEstimatedCost?: number
  notes?: string | null
  acceptedDate?: string | null
  completedDate?: string | null
}) {
  try {
    const db = getPrisma()
    const { id, acceptedDate, completedDate, ...rest } = payload
    const plan = await db.treatmentPlan.update({
      where: { id },
      data: {
        ...rest,
        ...(acceptedDate !== undefined ? { acceptedDate: acceptedDate ? new Date(acceptedDate) : null } : {}),
        ...(completedDate !== undefined ? { completedDate: completedDate ? new Date(completedDate) : null } : {}),
      },
    })

    await db.auditLog.create({
      data: { action: 'UPDATE', entityType: 'TreatmentPlan', entityId: id },
    }).catch(() => {})

    return { success: true, data: serializePlan(plan) }
  } catch (err) {
    return { success: false, error: { code: 'TP-004', message: err instanceof Error ? err.message : 'Could not update treatment plan.' } }
  }
}
