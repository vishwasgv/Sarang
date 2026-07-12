import { requirePermission } from '../permission-guard'
import {
  listBoardResolutions,
  createBoardResolution,
  updateBoardResolution,
  deleteBoardResolution,
} from '../../services/board-resolution.service'
import { CreateBoardResolutionSchema, UpdateBoardResolutionSchema, BoardResolutionIdSchema } from '../../validation/board-resolution.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('boardResolution:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const { boardMeetingId } = raw as { boardMeetingId: string }
    return listBoardResolutions(boardMeetingId)
  })

  handle('boardResolution:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateBoardResolutionSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createBoardResolution(parsed.data)
  })

  handle('boardResolution:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateBoardResolutionSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateBoardResolution(parsed.data)
  })

  handle('boardResolution:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = BoardResolutionIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteBoardResolution(parsed.data.id)
  })
}
