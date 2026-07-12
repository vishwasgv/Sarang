import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import {
  listTreatmentPlans,
  getTreatmentPlan,
  createTreatmentPlan,
  updateTreatmentPlan,
} from '../../services/treatment-plan.service'

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
    const p = payload as Parameters<typeof createTreatmentPlan>[0]
    return createTreatmentPlan({ ...p, createdById: undefined, userId: session?.userId })
  })

  handle('treatmentPlan:update', async (payload) => {
    const deny = await requirePermission('clinicalNotes.write'); if (deny) return deny
    return updateTreatmentPlan(payload as Parameters<typeof updateTreatmentPlan>[0])
  })
}
