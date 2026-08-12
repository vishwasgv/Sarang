import { z } from 'zod'

// Was previously missing entirely — creditNotes:create cast its payload straight
// to CreateCreditNotePayload with no runtime check, unlike every sibling handler
// in this file (update/delete/print all validate). A malformed or negative
// `amount` would flow straight into the customer ledger as a creditAmount,
// corrupting the customer's outstandingBalance instead of being cleanly rejected.
// Phase 63 — Account-based line items. A line is either a real Product or a
// free-text service line, same product-or-service duality Phase 61 gave
// Bill/PurchaseOrder. Optional: a caller can still pass a plain `amount`
// (the pre-Phase-63 shape) — when `items` is provided, `amount` is instead
// computed from the lines and whatever the caller sent is ignored.
const CreditNoteItemSchema = z.object({
  productId: z.string().min(1).optional(),
  serviceDescription: z.string().min(1).max(300).optional(),
  serviceCategoryId: z.string().min(1).optional(),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().min(0),
  taxRate: z.number().min(0).max(100).default(0),
}).refine((item) => !!item.productId || !!item.serviceDescription, {
  message: 'Each line must be either a product or a service description.'
})

export const CreateCreditNoteSchema = z.object({
  customerId: z.string().min(1).optional(),
  invoiceId: z.string().min(1).optional(),
  reason: z.string().min(1, 'Reason is required').max(500),
  amount: z.number().positive('Amount must be greater than zero').optional(),
  items: z.array(CreditNoteItemSchema).optional(),
  notes: z.string().max(2000).optional()
}).refine((v) => (v.amount !== undefined && v.amount > 0) || (v.items && v.items.length > 0), {
  message: 'Either an amount or at least one line item is required.'
})

export type CreateCreditNoteInput = z.infer<typeof CreateCreditNoteSchema>

export const UpdateCreditNoteSchema = z.object({
  customerId: z.string().nullable().optional(),
  invoiceId: z.string().nullable().optional(),
  reason: z.string().min(1, 'Reason is required').max(500).optional(),
  amount: z.number().positive('Amount must be greater than zero').optional(),
  notes: z.string().max(2000).nullable().optional()
})

export type UpdateCreditNoteInput = z.infer<typeof UpdateCreditNoteSchema>
