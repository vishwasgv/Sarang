import { requirePermission } from '../permission-guard'
import {
  listBoardMeetings,
  createBoardMeeting,
  updateBoardMeeting,
  deleteBoardMeeting,
} from '../../services/board-meeting.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('boardMeeting:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { clientId?: string; meetingType?: string; fromDate?: string; toDate?: string }
    return listBoardMeetings(payload)
  })

  handle('boardMeeting:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { clientId: string; meetingType?: string; meetingDate: string; meetingTime?: string; venue?: string; agenda?: string; notes?: string }
    return createBoardMeeting(payload)
  })

  handle('boardMeeting:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string; meetingType?: string; meetingDate?: string; meetingTime?: string | null; venue?: string | null; agenda?: string | null; quorumMet?: boolean; minutesDone?: boolean; minutesText?: string | null; noticesSent?: boolean; notes?: string | null }
    return updateBoardMeeting(payload)
  })

  handle('boardMeeting:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const { id } = raw as { id: string }
    return deleteBoardMeeting(id)
  })
}
