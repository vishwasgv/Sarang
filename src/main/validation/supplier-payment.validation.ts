import { z } from 'zod'

// Phase 61 — B2B supplier payments routinely go by bank transfer or cheque,
// not just the customer-facing CASH/UPI/CARD/WALLET set RecordPaymentSchema
// uses — this is the real-world gap the field notes flagged ("from where the
// goods are being bought, at what price").
export const RecordSupplierPaymentSchema = z.object({
  billId: z.string().min(1, 'Bill ID is required'),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE']),
  amount: z.number().positive('Payment amount must be greater than zero'),
  referenceNumber: z.string().max(100).optional(),
  remarks: z.string().max(255).optional(),
  paymentDate: z.string().optional(),
  // Phase 62 — TDS withheld from this payment. Entered explicitly by
  // whoever records the payment (matches this file's own "records only,
  // never verifies or processes" convention) rather than auto-computed from
  // a statutory rate table this app doesn't attempt to maintain.
  tdsAmount: z.number().min(0).default(0),
  tdsSection: z.string().max(20).optional(),
})

// 2026-09 — settling a foreign-currency Bill in full, in its own currency.
// Mirrors payment.validation.ts's own RecordForeignCurrencySettlementSchema.
export const RecordForeignCurrencyBillSettlementSchema = z.object({
  billId: z.string().min(1, 'Bill ID is required'),
  foreignAmount: z.number().positive('Amount must be greater than zero'),
  settlementRate: z.number().positive('Exchange rate must be greater than zero'),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE']),
  referenceNumber: z.string().max(100).optional(),
  remarks: z.string().max(255).optional(),
  paymentDate: z.string().optional(),
})

export const ReverseSupplierPaymentSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  reason: z.string().min(1, 'Reason is required for payment reversal').max(255),
})

// Phase 61 Section 3.5 acceptance item — "Payments Made supports partial
// allocation across multiple open Bills": one payment run, split across
// several of the same supplier's open Bills in a single atomic transaction.
// min(2) is deliberate — paying exactly one bill already has its own,
// simpler path (RecordSupplierPaymentSchema above); this schema only exists
// for the genuinely multi-bill case.
export const RecordBulkSupplierPaymentSchema = z.object({
  supplierId: z.string().min(1, 'Supplier ID is required'),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE']),
  referenceNumber: z.string().max(100).optional(),
  remarks: z.string().max(255).optional(),
  allocations: z.array(z.object({
    billId: z.string().min(1),
    amount: z.number().positive('Allocated amount must be greater than zero')
  })).min(2, 'Bulk payment requires at least 2 bills — use Record Payment on the bill itself for a single bill.').max(50)
})

export type RecordSupplierPaymentPayload = z.infer<typeof RecordSupplierPaymentSchema>
export type RecordForeignCurrencyBillSettlementPayload = z.infer<typeof RecordForeignCurrencyBillSettlementSchema>
export type ReverseSupplierPaymentPayload = z.infer<typeof ReverseSupplierPaymentSchema>
export type RecordBulkSupplierPaymentPayload = z.infer<typeof RecordBulkSupplierPaymentSchema>
