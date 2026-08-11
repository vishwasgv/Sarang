import { z } from 'zod'

export const CreatePDCSchema = z.object({
  bankAccountId: z.string().min(1, 'Bank account is required'),
  chequeNumber: z.string().min(1, 'Cheque number is required').max(30),
  direction: z.enum(['RECEIVED', 'ISSUED']),
  partyType: z.enum(['CUSTOMER', 'SUPPLIER']).optional(),
  partyId: z.string().min(1).optional(),
  dueDate: z.string().min(1, 'Due date is required'),
  amount: z.number().positive('Amount must be greater than zero'),
  remarks: z.string().max(500).optional(),
})

export const UpdatePDCStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(['DEPOSITED', 'CLEARED', 'BOUNCED', 'CANCELLED']),
  remarks: z.string().max(500).optional(),
})

export type CreatePDCPayload = z.infer<typeof CreatePDCSchema>
export type UpdatePDCStatusPayload = z.infer<typeof UpdatePDCStatusSchema>
