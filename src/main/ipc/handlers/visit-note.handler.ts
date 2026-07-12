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
import {
  CreateVisitNoteSchema,
  UpdateVisitNoteSchema,
  FinalizeVisitNoteSchema,
  ReferToProviderSchema,
} from '../../validation/visit-note.validation'

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
    const parsed = CreateVisitNoteSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createVisitNote({ ...parsed.data, createdBy: session.userId })
  })

  handle('visitNotes:update', async (payload) => {
    const deny = await requirePermission('clinicalNotes.write'); if (deny) return deny
    const parsed = UpdateVisitNoteSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateVisitNote(parsed.data)
  })

  handle('visitNotes:finalize', async (payload) => {
    const deny = await requirePermission('clinicalNotes.write'); if (deny) return deny
    const parsed = FinalizeVisitNoteSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return finalizeVisitNote(parsed.data.id)
  })

  handle('visitNotes:referToProvider', async (payload) => {
    const deny = await requirePermission('clinicalNotes.write'); if (deny) return deny
    const session = getCurrentSession()
    if (!session) return { success: false, error: { code: 'AUTH-003', message: 'Your session has expired.' } }
    const parsed = ReferToProviderSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return referToProvider({ ...parsed.data, createdBy: session.userId })
  })

  handle('visitNotes:listReferrals', async (payload) => {
    const deny = await requirePermission('clinicalNotes.view'); if (deny) return deny
    const { visitNoteId } = payload as { visitNoteId: string }
    return listReferralsForVisitNote(visitNoteId)
  })
}
