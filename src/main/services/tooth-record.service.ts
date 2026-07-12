import { getPrisma } from '../database/db'

export async function getPatientChart(patientId: string) {
  try {
    const db = getPrisma()
    const records = await db.toothRecord.findMany({
      where: { patientId },
      include: { recordedBy: { select: { id: true, fullName: true } } },
      orderBy: { toothNumber: 'asc' },
    })
    return { success: true, data: records }
  } catch (err) {
    return { success: false, error: { code: 'TR-001', message: err instanceof Error ? err.message : 'Could not load tooth chart.' } }
  }
}

export async function upsertTooth(payload: {
  patientId: string
  toothNumber: number
  condition: string
  surface?: string
  notes?: string | null
  recordedById?: string
  userId?: string
}) {
  try {
    const db = getPrisma()
    const existing = await db.toothRecord.findUnique({
      where: { patientId_toothNumber: { patientId: payload.patientId, toothNumber: payload.toothNumber } },
    })

    let record
    if (existing) {
      record = await db.toothRecord.update({
        where: { id: existing.id },
        data: {
          condition: payload.condition,
          surface: payload.surface ?? existing.surface,
          notes: payload.notes ?? null,
          recordedDate: new Date(),
          recordedById: payload.recordedById ?? null,
        },
      })
    } else {
      record = await db.toothRecord.create({
        data: {
          patientId: payload.patientId,
          toothNumber: payload.toothNumber,
          condition: payload.condition,
          surface: payload.surface ?? '[]',
          notes: payload.notes ?? null,
          recordedById: payload.recordedById ?? null,
        },
      })
    }

    await db.auditLog.create({
      data: {
        userId: payload.userId ?? null,
        action: existing ? 'UPDATE' : 'CREATE',
        entityType: 'ToothRecord',
        entityId: record.id,
        newValue: JSON.stringify({ toothNumber: payload.toothNumber, condition: payload.condition }),
      },
    }).catch(() => {})

    return { success: true, data: record }
  } catch (err) {
    return { success: false, error: { code: 'TR-002', message: err instanceof Error ? err.message : 'Could not update tooth record.' } }
  }
}
