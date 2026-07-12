import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import {
  listTreatmentPlans,
  getTreatmentPlan,
  createTreatmentPlan,
  updateTreatmentPlan,
} from '../../services/treatment-plan.service'
import { CreateTreatmentPlanSchema, UpdateTreatmentPlanSchema } from '../../validation/treatment-plan.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('treatmentPlan:list', async (payload) => {
    const deny = await requirePermission('clinicalNotes.view'); if (deny) return deny
    const { patientId } = payload as { patientId: string }
    return listTreatmentPlans(patientId)
  })

  handle('treatmentPlan:get', async (payload) => {
    const deny = await requirePermission('clinicalNotes.view'); if (deny) return deny
    const { id } = payload as { id: string }
    return getTreatmentPlan(id)
  })

  handle('treatmentPlan:create', async (payload) => {
    const deny = await requirePermission('clinicalNotes.write'); if (deny) return deny
    // createdById is FK'd to Employee, not User — the logged-in session's
    // userId is a User record and there is no schema link from User to
    // Employee, so passing it as createdById always violated the FK. It's
    // now only used for the audit log's userId, which is correctly FK'd to
    // User.
    const session = getCurrentSession()
    const parsed = CreateTreatmentPlanSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createTreatmentPlan({ ...parsed.data, createdById: undefined, userId: session?.userId })
  })

  handle('treatmentPlan:update', async (payload) => {
    const deny = await requirePermission('clinicalNotes.write'); if (deny) return deny
    const parsed = UpdateTreatmentPlanSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateTreatmentPlan(parsed.data)
  })
}
