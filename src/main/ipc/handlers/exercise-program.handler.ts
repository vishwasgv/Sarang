import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { getActiveProgram, listPrograms, upsertProgram, markProgramPrinted } from '../../services/exercise-program.service'
import { UpsertProgramSchema, MarkProgramPrintedSchema } from '../../validation/exercise-program.validation'

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
    const parsed = UpsertProgramSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return upsertProgram({ ...parsed.data, createdById: undefined, userId: session?.userId })
  })

  handle('exerciseProgram:markPrinted', async (payload) => {
    const deny = await requirePermission('clinicalNotes.view'); if (deny) return deny
    const parsed = MarkProgramPrintedSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return markProgramPrinted(parsed.data.id)
  })
}
