import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { getActiveProgram, listPrograms, upsertProgram, markProgramPrinted } from '../../services/exercise-program.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('exerciseProgram:getActive', async (payload) => {
    const deny = await requirePermission('clinicalNotes.view'); if (deny) return deny
    const { patientId } = payload as { patientId: string }
    return getActiveProgram(patientId)
  })

  handle('exerciseProgram:list', async (payload) => {
    const deny = await requirePermission('clinicalNotes.view'); if (deny) return deny
    const { patientId } = payload as { patientId: string }
    return listPrograms(patientId)
  })

  handle('exerciseProgram:upsert', async (payload) => {
    const deny = await requirePermission('clinicalNotes.write'); if (deny) return deny
    // createdById is FK'd to Employee, not User — the logged-in session's
    // userId is a User record and there is no schema link from User to
    // Employee, so passing it as createdById always violated the FK. It's
    // now only used for the audit log's userId, which is correctly FK'd to
    // User.
    const session = getCurrentSession()
    const p = payload as Parameters<typeof upsertProgram>[0]
    return upsertProgram({ ...p, createdById: undefined, userId: session?.userId })
  })

  handle('exerciseProgram:markPrinted', async (payload) => {
    const deny = await requirePermission('clinicalNotes.view'); if (deny) return deny
    const { id } = payload as { id: string }
    return markProgramPrinted(id)
  })
}
