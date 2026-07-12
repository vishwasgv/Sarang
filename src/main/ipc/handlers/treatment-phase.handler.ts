import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { listTreatmentPhases, createTreatmentPhase, updateTreatmentPhase, closeTreatmentPhase } from '../../services/treatment-phase.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('treatmentPhase:list', async (payload) => {
    const deny = await requirePermission('clinicalNotes.view'); if (deny) return deny
    const { patientId } = payload as { patientId: string }
    return listTreatmentPhases(patientId)
  })

  handle('treatmentPhase:create', async (payload) => {
    const deny = await requirePermission('clinicalNotes.write'); if (deny) return deny
    // createdById is FK'd to Employee, not User — the logged-in session's
    // userId is a User record and there is no schema link from User to
    // Employee, so passing it as createdById always violated the FK. It's
    // now only used for the audit log's userId, which is correctly FK'd to
    // User.
    const session = getCurrentSession()
    const p = payload as Parameters<typeof createTreatmentPhase>[0]
    return createTreatmentPhase({ ...p, createdById: undefined, userId: session?.userId })
  })

  handle('treatmentPhase:update', async (payload) => {
    const deny = await requirePermission('clinicalNotes.write'); if (deny) return deny
    const p = payload as Parameters<typeof updateTreatmentPhase>[0]
    return updateTreatmentPhase(p)
  })

  handle('treatmentPhase:close', async (payload) => {
    const deny = await requirePermission('clinicalNotes.write'); if (deny) return deny
    const p = payload as Parameters<typeof closeTreatmentPhase>[0]
    return closeTreatmentPhase(p)
  })
}
