import { requirePermission } from '../permission-guard'
import { listRetainers, createRetainer, updateRetainer, deleteRetainer, generateInvoiceForRetainer } from '../../services/retainer.service'
import { CreateRetainerSchema, UpdateRetainerSchema, RetainerIdSchema, GenerateRetainerInvoiceSchema } from '../../validation/retainer.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('retainer:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { clientId?: string; assignedToId?: string; status?: string }
    return listRetainers(payload)
  })

  handle('retainer:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateRetainerSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createRetainer(parsed.data)
  })

  handle('retainer:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateRetainerSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateRetainer(parsed.data)
  })

  handle('retainer:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = RetainerIdSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteRetainer(parsed.data.id)
  })

  handle('retainer:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = GenerateRetainerInvoiceSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return generateInvoiceForRetainer(parsed.data.id, parsed.data.period)
  })
}
