import { requirePermission } from '../permission-guard'
import {
  listBoardMeetings,
  createBoardMeeting,
  updateBoardMeeting,
  deleteBoardMeeting,
} from '../../services/board-meeting.service'
import { CreateBoardMeetingSchema, UpdateBoardMeetingSchema, BoardMeetingIdSchema } from '../../validation/board-meeting.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('boardMeeting:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { clientId?: string; meetingType?: string; fromDate?: string; toDate?: string }
    return listBoardMeetings(payload)
  })

  handle('boardMeeting:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateBoardMeetingSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createBoardMeeting(parsed.data)
  })

  handle('boardMeeting:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateBoardMeetingSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateBoardMeeting(parsed.data)
  })

  handle('boardMeeting:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = BoardMeetingIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteBoardMeeting(parsed.data.id)
  })
}
