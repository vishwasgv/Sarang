import { z } from 'zod'

// Standard currently-circulating Indian note/coin denominations. Keyed as
// strings since they arrive from a form and are used as JSON object keys.
export const DENOMINATION_VALUES = ['500', '200', '100', '50', '20', '10', '5', '2', '1'] as const

export const CreateBankDepositSchema = z.object({
  bankAccountId: z.string().min(1, 'Bank account is required'),
  depositDate: z.string().min(1, 'Deposit date is required'),
  // Record<denomination, count> — only the denominations actually counted
  // need to be present; missing ones are treated as zero.
  denominations: z.record(z.string(), z.number().int().nonnegative()),
  chequeIds: z.array(z.string().min(1)).optional(),
  notes: z.string().max(500).optional(),
})

export type CreateBankDepositPayload = z.infer<typeof CreateBankDepositSchema>
