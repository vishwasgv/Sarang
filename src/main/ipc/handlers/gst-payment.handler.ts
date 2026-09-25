import { gstPaymentService } from '../../services/gst-payment.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { CreateGstPaymentSchema } from '../../validation/gst-payment.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('gstPayments:record', async (payload) => {
    const deny = await requirePermission('journalEntries.create'); if (deny) return deny
    const parsed = CreateGstPaymentSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return gstPaymentService.record(parsed.data, getCurrentSession()?.userId)
  })

  handle('gstPayments:list', async () => {
    const deny = await requirePermission('journalEntries.view'); if (deny) return deny
    return gstPaymentService.list()
  })

  handle('gstPayments:void', async (payload) => {
    const deny = await requirePermission('journalEntries.create'); if (deny) return deny
    const { id, reason } = (payload ?? {}) as { id?: string; reason?: string }
    if (!id || !reason?.trim()) return { success: false, error: { code: 'VAL-001', message: 'A reason is required.' } }
    return gstPaymentService.void(id, reason.trim(), getCurrentSession()?.userId)
  })
}
