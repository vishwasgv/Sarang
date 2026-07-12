import { requirePermission } from '../permission-guard'
import {
  listBoardResolutions,
  createBoardResolution,
  updateBoardResolution,
  deleteBoardResolution,
} from '../../services/board-resolution.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('boardResolution:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const { boardMeetingId } = raw as { boardMeetingId: string }
    return listBoardResolutions(boardMeetingId)
  })

  handle('boardResolution:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { boardMeetingId: string; resolutionNumber: string; resolutionType?: string; resolutionText: string; passedUnanimously?: boolean }
    return createBoardResolution(payload)
  })

  handle('boardResolution:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const payload = raw as { id: string; resolutionNumber?: string; resolutionType?: string; resolutionText?: string; passedUnanimously?: boolean }
    return updateBoardResolution(payload)
  })

  handle('boardResolution:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const { id } = raw as { id: string }
    return deleteBoardResolution(id)
  })
}
