import { requirePermission } from '../permission-guard'
import { listHearings, createHearing, updateHearing, deleteHearing } from '../../services/hearing.service'
import { CreateHearingSchema, UpdateHearingSchema, DeleteHearingSchema } from '../../validation/hearing.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('hearing:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { caseId?: string; status?: string; fromDate?: string; toDate?: string }
    return listHearings(payload)
  })

  handle('hearing:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateHearingSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createHearing(parsed.data)
  })

  handle('hearing:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateHearingSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateHearing(parsed.data)
  })

  handle('hearing:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = DeleteHearingSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteHearing(parsed.data.id)
  })
}
