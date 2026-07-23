import { z } from 'zod'

// Was previously missing entirely — creditNotes:create cast its payload straight
// to CreateCreditNotePayload with no runtime check, unlike every sibling handler
// in this file (update/delete/print all validate). A malformed or negative
// `amount` would flow straight into the customer ledger as a creditAmount,
// corrupting the customer's outstandingBalance instead of being cleanly rejected.
export const CreateCreditNoteSchema = z.object({
  customerId: z.string().min(1).optional(),
  invoiceId: z.string().min(1).optional(),
  reason: z.string().min(1, 'Reason is required').max(500),
  amount: z.number().positive('Amount must be greater than zero'),
  notes: z.string().max(2000).optional()
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
