import { z } from 'zod'

// Was previously missing entirely — debitNotes:create cast its payload straight
// to CreateDebitNotePayload with no runtime check, unlike every sibling handler
// in this file (update/delete/print all validate). A malformed or negative
// `amount` would flow straight into the supplier ledger as a debitAmount,
// corrupting the supplier's outstandingBalance instead of being cleanly rejected.
export const CreateDebitNoteSchema = z.object({
  supplierId: z.string().min(1).optional(),
  purchaseOrderId: z.string().min(1).optional(),
  reason: z.string().min(1, 'Reason is required').max(500),
  amount: z.number().positive('Amount must be greater than zero'),
  notes: z.string().max(2000).optional()
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
