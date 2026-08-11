import { z } from 'zod'

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE'] as const

export const CreateAccountSchema = z.object({
  accountCode: z.string().min(1, 'Account code is required').max(20),
  accountName: z.string().min(1, 'Account name is required').max(150),
  accountType: z.enum(ACCOUNT_TYPES),
  parentId: z.string().min(1).optional(),
})

export const UpdateAccountSchema = z.object({
  id: z.string().min(1),
  accountName: z.string().min(1).max(150).optional(),
  parentId: z.string().min(1).nullable().optional(),
  isActive: z.boolean().optional(),
})

export type CreateAccountPayload = z.infer<typeof CreateAccountSchema>
export type UpdateAccountPayload = z.infer<typeof UpdateAccountSchema>
