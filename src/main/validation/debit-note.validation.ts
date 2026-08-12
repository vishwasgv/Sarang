import { z } from 'zod'

// Was previously missing entirely — debitNotes:create cast its payload straight
// to CreateDebitNotePayload with no runtime check, unlike every sibling handler
// in this file (update/delete/print all validate). A malformed or negative
// `amount` would flow straight into the supplier ledger as a debitAmount,
// corrupting the supplier's outstandingBalance instead of being cleanly rejected.
// Phase 63 — Account-based line items (relabeled "Vendor Credit" in the UI).
// Same product-or-service duality Phase 61 gave Bill/PurchaseOrder.
const DebitNoteItemSchema = z.object({
  productId: z.string().min(1).optional(),
  serviceDescription: z.string().min(1).max(300).optional(),
  serviceCategoryId: z.string().min(1).optional(),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().min(0),
  taxRate: z.number().min(0).max(100).default(0),
}).refine((item) => !!item.productId || !!item.serviceDescription, {
  message: 'Each line must be either a product or a service description.'
})

export const CreateDebitNoteSchema = z.object({
  supplierId: z.string().min(1).optional(),
  purchaseOrderId: z.string().min(1).optional(),
  reason: z.string().min(1, 'Reason is required').max(500),
  amount: z.number().positive('Amount must be greater than zero').optional(),
  items: z.array(DebitNoteItemSchema).optional(),
  notes: z.string().max(2000).optional()
}).refine((v) => (v.amount !== undefined && v.amount > 0) || (v.items && v.items.length > 0), {
  message: 'Either an amount or at least one line item is required.'
})

export type CreateDebitNoteInput = z.infer<typeof CreateDebitNoteSchema>

export const UpdateDebitNoteSchema = z.object({
  supplierId: z.string().nullable().optional(),
  purchaseOrderId: z.string().nullable().optional(),
  reason: z.string().min(1, 'Reason is required').max(500).optional(),
  amount: z.number().positive('Amount must be greater than zero').optional(),
  notes: z.string().max(2000).nullable().optional()
})

export type UpdateDebitNoteInput = z.infer<typeof UpdateDebitNoteSchema>
