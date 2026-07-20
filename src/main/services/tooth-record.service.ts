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

    // Phase 58 §2 — ToothRecord itself stays the fast "current state" row
    // the chart reads (unique per patient+tooth, unchanged shape), but
    // every save ALSO appends a ToothRecordHistory row snapshotting exactly
    // what was saved — an additional ledger, not a replacement, same
    // pattern as RawMaterialBatch alongside RawMaterial.currentStock. This
    // is what makes a tooth's progression across visits actually visible,
    // instead of every save silently overwriting the only row that existed.
    const recordedDate = new Date()
    const record = await db.$transaction(async (tx) => {
      const saved = existing
        ? await tx.toothRecord.update({
            where: { id: existing.id },
            data: {
              condition: payload.condition,
              surface: payload.surface ?? existing.surface,
              notes: payload.notes ?? null,
              recordedDate,
              recordedById: payload.recordedById ?? null,
            },
          })
        : await tx.toothRecord.create({
            data: {
              patientId: payload.patientId,
              toothNumber: payload.toothNumber,
              condition: payload.condition,
              surface: payload.surface ?? '[]',
              notes: payload.notes ?? null,
              recordedById: payload.recordedById ?? null,
            },
          })

      await tx.toothRecordHistory.create({
        data: {
          toothRecordId: saved.id,
          condition: saved.condition,
          surface: saved.surface,
          notes: saved.notes,
          recordedDate: saved.recordedDate,
          recordedById: saved.recordedById,
        },
      })

      return saved
    })

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

// Phase 58 §2 — a tooth's real chronological history, most recent first.
export async function getToothHistory(patientId: string, toothNumber: number) {
  try {
    const db = getPrisma()
    const toothRecord = await db.toothRecord.findUnique({
      where: { patientId_toothNumber: { patientId, toothNumber } },
      select: { id: true },
    })
    if (!toothRecord) return { success: true, data: [] }

    const history = await db.toothRecordHistory.findMany({
      where: { toothRecordId: toothRecord.id },
      include: { recordedBy: { select: { id: true, fullName: true } } },
      orderBy: { recordedDate: 'desc' },
    })
    return { success: true, data: history }
  } catch (err) {
    return { success: false, error: { code: 'TR-003', message: err instanceof Error ? err.message : 'Could not load tooth history.' } }
  }
}
