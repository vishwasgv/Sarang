import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import {
  getVisitNote,
  createVisitNote,
  updateVisitNote,
  finalizeVisitNote,
  listVisitNotes,
  referToProvider,
  listReferralsForVisitNote,
} from '../../services/visit-note.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('visitNotes:list', async (payload) => {
    const deny = await requirePermission('clinicalNotes.view'); if (deny) return deny
    return listVisitNotes(payload as Parameters<typeof listVisitNotes>[0])
  })

  handle('visitNotes:get', async (payload) => {
    const deny = await requirePermission('clinicalNotes.view'); if (deny) return deny
    const { appointmentId } = payload as { appointmentId: string }
    return getVisitNote(appointmentId)
  })

  handle('visitNotes:create', async (payload) => {
    const deny = await requirePermission('clinicalNotes.write'); if (deny) return deny
    const session = getCurrentSession()
    if (!session) return { success: false, error: { code: 'AUTH-003', message: 'Your session has expired.' } }
    const p = payload as Parameters<typeof createVisitNote>[0]
    return createVisitNote({ ...p, createdBy: session.userId })
  })

  handle('visitNotes:update', async (payload) => {
    const deny = await requirePermission('clinicalNotes.write'); if (deny) return deny
    return updateVisitNote(payload as Parameters<typeof updateVisitNote>[0])
  })

  handle('visitNotes:finalize', async (payload) => {
    const deny = await requirePermission('clinicalNotes.write'); if (deny) return deny
    const { id } = payload as { id: string }
    return finalizeVisitNote(id)
  })

  handle('visitNotes:referToProvider', async (payload) => {
    const deny = await requirePermission('clinicalNotes.write'); if (deny) return deny
    const session = getCurrentSession()
    if (!session) return { success: false, error: { code: 'AUTH-003', message: 'Your session has expired.' } }
    const p = payload as Parameters<typeof referToProvider>[0]
    return referToProvider({ ...p, createdBy: session.userId })
  })

  handle('visitNotes:listReferrals', async (payload) => {
    const deny = await requirePermission('clinicalNotes.view'); if (deny) return deny
    const { visitNoteId } = payload as { visitNoteId: string }
    return listReferralsForVisitNote(visitNoteId)
  })
}
