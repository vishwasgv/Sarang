import { z } from 'zod'

export const CreateGstPaymentSchema = z.object({
  paymentDate: z.string().min(1, 'Payment date is required'),
  // Tax settled by this payment (goes against the tax payable balance).
  taxAmount: z.number().positive('Tax amount must be more than zero'),
  // How much of it is met from input tax credit; the rest is paid in cash or from the bank.
  creditUsed: z.number().nonnegative().default(0),
  cashPaid: z.number().nonnegative().default(0),
  bankAccountId: z.string().min(1).optional(),
  reference: z.string().max(60).optional(),
  notes: z.string().max(300).optional()
})

export type CreateGstPaymentPayload = z.infer<typeof CreateGstPaymentSchema>
