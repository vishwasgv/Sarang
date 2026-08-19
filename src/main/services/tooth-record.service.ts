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

// Phase 67 §9.1 item 21.5 — Dental Clinic: tooth-chart-linked treatment
// timeline. Grounding confirmed getToothHistory() above already covers half
// of this ("every condition this tooth has ever been given"), but the other
// half — which TREATMENT PLAN procedures were ever proposed/done for this
// specific tooth — was never surfaced anywhere, even though
// TreatmentPlanItem.toothNumber has carried this link since Phase 25. This
// merges both real, already-captured sources into one chronological view
// instead of building a new data model. A treatment entry's date is the
// plan's own createdAt — TreatmentPlanItem has no per-item timestamp of its
// own (only a Pending/Done flag), so this is honestly "when this procedure
// was proposed as part of this plan," not "the exact date it was
// performed" — the itemStatus is included precisely so the caller isn't
// misled into treating it as a completion date.
export interface ToothTimelineEntry {
  type: 'CONDITION' | 'TREATMENT'
  date: Date
  // CONDITION fields
  condition?: string
  surface?: string
  notes?: string | null
  recordedBy?: { id: string; fullName: string } | null
  // TREATMENT fields
  procedure?: string
  itemStatus?: 'PENDING' | 'DONE'
  planId?: string
  planTitle?: string
  planStatus?: string
}

export async function getToothTimeline(patientId: string, toothNumber: number) {
  try {
    const db = getPrisma()

    const toothRecord = await db.toothRecord.findUnique({
      where: { patientId_toothNumber: { patientId, toothNumber } },
      select: { id: true },
    })
    const conditionHistory = toothRecord
      ? await db.toothRecordHistory.findMany({
          where: { toothRecordId: toothRecord.id },
          include: { recordedBy: { select: { id: true, fullName: true } } },
        })
      : []

    const plans = await db.treatmentPlan.findMany({
      where: { patientId },
      select: { id: true, title: true, status: true, planItems: true, createdAt: true },
    })

    const timeline: ToothTimelineEntry[] = []
    for (const h of conditionHistory) {
      timeline.push({
        type: 'CONDITION', date: h.recordedDate,
        condition: h.condition, surface: h.surface, notes: h.notes, recordedBy: h.recordedBy,
      })
    }
    for (const plan of plans) {
      let items: Array<{ toothNumber?: number; procedure: string; itemStatus: 'PENDING' | 'DONE' }> = []
      try { items = JSON.parse(plan.planItems) } catch { items = [] }
      for (const item of items) {
        if (item.toothNumber !== toothNumber) continue
        timeline.push({
          type: 'TREATMENT', date: plan.createdAt,
          procedure: item.procedure, itemStatus: item.itemStatus,
          planId: plan.id, planTitle: plan.title, planStatus: plan.status,
        })
      }
    }

    timeline.sort((a, b) => b.date.getTime() - a.date.getTime())
    return { success: true, data: timeline }
  } catch (err) {
    return { success: false, error: { code: 'TR-004', message: err instanceof Error ? err.message : 'Could not load tooth timeline.' } }
  }
}
