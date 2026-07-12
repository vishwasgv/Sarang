import { z } from 'zod'

export const OpenFileDialogSchema = z.object({
  title: z.string().max(200).optional(),
  accept: z.array(z.string()).optional(),
  maxSizeBytes: z.number().positive('maxSizeBytes must be greater than zero').optional(),
})

export const GenerateUpiPaymentQrSchema = z.object({
  amount: z.number().finite().optional(),
  note: z.string().max(200).optional(),
})

export type OpenFileDialogPayload = z.infer<typeof OpenFileDialogSchema>
export type GenerateUpiPaymentQrPayload = z.infer<typeof GenerateUpiPaymentQrSchema>
