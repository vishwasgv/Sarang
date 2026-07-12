import { paymentService } from '../../services/payment.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { RecordPaymentSchema, RecordSplitPaymentSchema, ReversePaymentSchema } from '../../validation/payment.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('payments:record', async (payload) => {
    const deny = await requirePermission('payments.record'); if (deny) return deny
    const parsed = RecordPaymentSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return paymentService.recordPayment(parsed.data, getCurrentSession()?.userId)
  })

  handle('payments:recordSplit', async (payload) => {
    const deny = await requirePermission('payments.record'); if (deny) return deny
    const parsed = RecordSplitPaymentSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return paymentService.recordSplitPayment(parsed.data, getCurrentSession()?.userId)
  })

  handle('payments:reverse', async (payload) => {
    const deny = await requirePermission('payments.reverse'); if (deny) return deny
    const parsed = ReversePaymentSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return paymentService.reversePayment(parsed.data, getCurrentSession()?.userId)
  })

  handle('payments:list', async (payload) => {
    const deny = await requirePermission('payments.view'); if (deny) return deny
    return paymentService.getPayments(payload as { invoiceId?: string; customerId?: string; method?: string; dateFrom?: string; dateTo?: string; search?: string; page?: number; limit?: number } | undefined)
  })
}
