import { z } from 'zod'

export const UpdateCreditNoteSchema = z.object({
  customerId: z.string().nullable().optional(),
  invoiceId: z.string().nullable().optional(),
  reason: z.string().min(1, 'Reason is required').max(500).optional(),
  amount: z.number().positive('Amount must be greater than zero').optional(),
  notes: z.string().max(2000).nullable().optional()
})

export type UpdateCreditNoteInput = z.infer<typeof UpdateCreditNoteSchema>
