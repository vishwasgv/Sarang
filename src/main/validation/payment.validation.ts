import { z } from 'zod'

export const RecordPaymentSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  // CREDIT is deliberately excluded — it means "deferred, no money received" at
  // invoice creation (CreateInvoiceSchema). Recording a payment is the opposite:
  // it asserts real money WAS received. Allowing 'CREDIT' here let someone clear
  // an invoice's balance and credit the customer ledger with no money moving —
  // matches RecordSplitPaymentSchema's legs, which already exclude it.
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'WALLET']),
  amount: z.number().positive('Payment amount must be greater than zero'),
  referenceNumber: z.string().max(100).optional(),
  remarks: z.string().max(255).optional(),
  paymentDate: z.string().optional(),
})

export const RecordSplitPaymentSchema = z.object({
  invoiceId: z.string().min(1, 'Invoice ID is required'),
  legs: z.array(z.object({
    paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'WALLET']),
    amount: z.number().positive('Payment amount must be greater than zero'),
    referenceNumber: z.string().max(100).optional(),
  })).min(1, 'At least one payment leg is required').max(5),
})

export const ReversePaymentSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID is required'),
  reason: z.string().min(1, 'Reason is required for payment reversal').max(255),
})

export type RecordPaymentPayload = z.infer<typeof RecordPaymentSchema>
export type RecordSplitPaymentPayload = z.infer<typeof RecordSplitPaymentSchema>
export type ReversePaymentPayload = z.infer<typeof ReversePaymentSchema>
