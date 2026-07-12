import { z } from 'zod'

export const UpdateDebitNoteSchema = z.object({
  supplierId: z.string().nullable().optional(),
  purchaseOrderId: z.string().nullable().optional(),
  reason: z.string().min(1, 'Reason is required').max(500).optional(),
  amount: z.number().positive('Amount must be greater than zero').optional(),
  notes: z.string().max(2000).nullable().optional()
})

export type UpdateDebitNoteInput = z.infer<typeof UpdateDebitNoteSchema>
