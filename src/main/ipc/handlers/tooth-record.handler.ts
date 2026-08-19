import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { getPatientChart, upsertTooth, getToothHistory, getToothTimeline } from '../../services/tooth-record.service'
import { UpsertToothSchema, GetToothHistorySchema, GetToothTimelineSchema } from '../../validation/tooth-record.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('toothRecord:getChart', async (payload) => {
    const deny = await requirePermission('clinicalNotes.view'); if (deny) return deny
    const { patientId } = payload as { patientId: string }
    return getPatientChart(patientId)
  })

  handle('toothRecord:upsert', async (payload) => {
    const deny = await requirePermission('clinicalNotes.write'); if (deny) return deny
    // recordedById is FK'd to Employee, not User — the logged-in session's
    // userId is a User record and there is no schema link from User to
    // Employee, so passing it as recordedById always violated the FK. It's
    // now only used for the audit log's userId, which is correctly FK'd to
    // User.
    const session = getCurrentSession()
    const parsed = UpsertToothSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return upsertTooth({ ...parsed.data, recordedById: undefined, userId: session?.userId })
  })

  handle('toothRecord:getHistory', async (payload) => {
    const deny = await requirePermission('clinicalNotes.view'); if (deny) return deny
    const parsed = GetToothHistorySchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return getToothHistory(parsed.data.patientId, parsed.data.toothNumber)
  })

  // Phase 67 §9.1 item 21.5 — Dental Clinic: tooth-chart-linked treatment timeline.
  handle('toothRecord:getTimeline', async (payload) => {
    const deny = await requirePermission('clinicalNotes.view'); if (deny) return deny
    const parsed = GetToothTimelineSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return getToothTimeline(parsed.data.patientId, parsed.data.toothNumber)
  })
}
