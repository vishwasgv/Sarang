import { supplierPaymentService } from '../../services/supplier-payment.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { RecordSupplierPaymentSchema, ReverseSupplierPaymentSchema, RecordBulkSupplierPaymentSchema } from '../../validation/supplier-payment.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('supplierPayments:record', async (payload) => {
    const deny = await requirePermission('supplierPayments.record'); if (deny) return deny
    const parsed = RecordSupplierPaymentSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return supplierPaymentService.recordSupplierPayment(parsed.data, getCurrentSession()?.userId)
  })

  handle('supplierPayments:recordBulk', async (payload) => {
    const deny = await requirePermission('supplierPayments.record'); if (deny) return deny
    const parsed = RecordBulkSupplierPaymentSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return supplierPaymentService.recordBulkPayment(parsed.data, getCurrentSession()?.userId)
  })

  handle('supplierPayments:reverse', async (payload) => {
    const deny = await requirePermission('supplierPayments.reverse'); if (deny) return deny
    const parsed = ReverseSupplierPaymentSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return supplierPaymentService.reverseSupplierPayment(parsed.data, getCurrentSession()?.userId)
  })

  handle('supplierPayments:list', async (payload) => {
    const deny = await requirePermission('supplierPayments.view'); if (deny) return deny
    return supplierPaymentService.getSupplierPayments(payload as { billId?: string; supplierId?: string; method?: string; dateFrom?: string; dateTo?: string; search?: string; page?: number; limit?: number } | undefined)
  })

  // Phase 62 — read-only TDS threshold/rate suggestion, gated the same as
  // recording a payment itself (only relevant to someone about to record one).
  handle('supplierPayments:suggestTds', async (payload) => {
    const deny = await requirePermission('supplierPayments.record'); if (deny) return deny
    const { amount } = payload as { amount: number }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
      return { success: false, error: { code: 'VAL-001', message: 'Invalid amount.' } }
    }
    return supplierPaymentService.suggestTds(amount)
  })
}
