import { z } from 'zod'

export const CreateChequeBookSchema = z
  .object({
    bankAccountId: z.string().min(1, 'Bank account is required'),
    startNumber: z.number().int().positive('Start number must be a positive integer'),
    endNumber: z.number().int().positive('End number must be a positive integer')
  })
  .refine((v) => v.endNumber >= v.startNumber, {
    message: 'End number must be greater than or equal to start number',
    path: ['endNumber']
  })

export type CreateChequeBookPayload = z.infer<typeof CreateChequeBookSchema>
