import { z } from 'zod'

export const CreateBankAccountSchema = z.object({
  accountName: z.string().min(1, 'Account name is required').max(150),
  accountType: z.enum(['BANK', 'CASH']).default('BANK'),
  bankName: z.string().max(150).optional(),
  accountNumberMasked: z.string().max(50).optional(),
  ifscCode: z.string().max(20).optional(),
  currencyCode: z.string().max(10).optional(),
  openingBalance: z.number().min(0, 'Opening balance cannot be negative').default(0),
  notes: z.string().max(500).optional(),
})

export const UpdateBankAccountSchema = z.object({
  id: z.string().min(1),
  accountName: z.string().min(1).max(150).optional(),
  bankName: z.string().max(150).optional(),
  accountNumberMasked: z.string().max(50).optional(),
  ifscCode: z.string().max(20).optional(),
  notes: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
})

export type CreateBankAccountPayload = z.infer<typeof CreateBankAccountSchema>
export type UpdateBankAccountPayload = z.infer<typeof UpdateBankAccountSchema>
