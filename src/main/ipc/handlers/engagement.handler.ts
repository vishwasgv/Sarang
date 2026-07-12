import { requirePermission } from '../permission-guard'
import {
  listEngagements,
  createEngagement,
  updateEngagement,
  deleteEngagement,
  generateEngagementInvoice,
} from '../../services/engagement.service'
import {
  CreateEngagementSchema,
  UpdateEngagementSchema,
  DeleteEngagementSchema,
  GenerateEngagementInvoiceSchema,
} from '../../validation/engagement.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('engagement:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { clientId?: string; staffId?: string; status?: string; engagementType?: string }
    return listEngagements(payload)
  })

  handle('engagement:create', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = CreateEngagementSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return createEngagement(parsed.data)
  })

  handle('engagement:update', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = UpdateEngagementSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return updateEngagement(parsed.data)
  })

  handle('engagement:delete', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = DeleteEngagementSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return deleteEngagement(parsed.data.id)
  })

  handle('engagement:generateInvoice', async (raw) => {
    const deny = await requirePermission('billing.createInvoice'); if (deny) return deny
    const parsed = GenerateEngagementInvoiceSchema.safeParse(raw)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return generateEngagementInvoice(parsed.data.id, parsed.data.period)
  })
}
