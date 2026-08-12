import { z } from 'zod'

export const CreatePDCSchema = z
  .object({
    bankAccountId: z.string().min(1, 'Bank account is required'),
    // Optional when useChequeBook is true — the number is then auto-consumed
    // from the bank account's active ChequeBook instead of typed in by hand.
    chequeNumber: z.string().min(1).max(30).optional(),
    useChequeBook: z.boolean().optional(),
    direction: z.enum(['RECEIVED', 'ISSUED']),
    partyType: z.enum(['CUSTOMER', 'SUPPLIER']).optional(),
    partyId: z.string().min(1).optional(),
    dueDate: z.string().min(1, 'Due date is required'),
    amount: z.number().positive('Amount must be greater than zero'),
    remarks: z.string().max(500).optional(),
  })
  .refine((v) => v.useChequeBook || (v.chequeNumber && v.chequeNumber.length > 0), {
    message: 'Cheque number is required',
    path: ['chequeNumber']
  })

export const UpdatePDCStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['DEPOSITED', 'CLEARED', 'BOUNCED', 'CANCELLED']),
  remarks: z.string().max(500).optional(),
})

export type CreatePDCPayload = z.infer<typeof CreatePDCSchema>
export type UpdatePDCStatusPayload = z.infer<typeof UpdatePDCStatusSchema>
