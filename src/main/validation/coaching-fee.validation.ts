import { z } from 'zod'

export const GenerateMonthlyFeesSchema = z.object({
  month: z.string().min(1, 'Month is required'),
  taxRate: z.number().nonnegative('Tax rate cannot be negative').optional(),
})

export const UpdateFeeRecordSchema = z.object({
  id: z.string().min(1, 'Fee record ID is required'),
  amountReceived: z.number().nonnegative('Amount received cannot be negative').optional(),
  status: z.string().optional(),
  paidDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export type GenerateMonthlyFeesPayload = z.infer<typeof GenerateMonthlyFeesSchema>
export type UpdateFeeRecordPayload = z.infer<typeof UpdateFeeRecordSchema>
