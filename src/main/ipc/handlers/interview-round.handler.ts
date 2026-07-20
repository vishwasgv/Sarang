import { requirePermission } from '../permission-guard'
import { listInterviewRounds, createInterviewRound, updateInterviewRound, deleteInterviewRound } from '../../services/interview-round.service'
import { ListInterviewRoundsSchema, EntityIdSchema, CreateInterviewRoundSchema, UpdateInterviewRoundSchema } from '../../validation/interview-round.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function registerInterviewRound(handle: HandleFn): void {
  handle('interviewRound:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const parsed = ListInterviewRoundsSchema.safeParse(raw ?? {})
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return listInterviewRounds(parsed.data)
  })

  handle('interviewRound:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateInterviewRoundSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createInterviewRound(parsed.data)
  })

  handle('interviewRound:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateInterviewRoundSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateInterviewRound(parsed.data)
  })

  handle('interviewRound:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = EntityIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteInterviewRound(parsed.data.id)
  })
}
