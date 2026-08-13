import { z } from 'zod'

// costCentreId/accountId are both independently optional — see
// schema.prisma's own Budget comment for what null means on each. No
// DB-level uniqueness on the (costCentreId, accountId, period) triplet, so
// the service layer checks for an existing exact-scope row itself.
export const CreateBudgetSchema = z.object({
  costCentreId: z.string().min(1).optional(),
  accountId: z.string().min(1).optional(),
  periodYear: z.number().int().min(2000).max(2100),
  periodMonth: z.number().int().min(1).max(12),
  amount: z.number().finite().positive('Budget amount must be greater than zero'),
  notes: z.string().max(500).optional(),
})

export const UpdateBudgetSchema = z.object({
  id: z.string().min(1, 'Budget ID is required'),
  amount: z.number().finite().positive('Budget amount must be greater than zero').optional(),
  notes: z.string().max(500).optional(),
})

export const DeleteBudgetSchema = z.object({
  id: z.string().min(1, 'Budget ID is required'),
})

export const ListBudgetsSchema = z.object({
  periodYear: z.number().int().optional(),
  periodMonth: z.number().int().optional(),
  costCentreId: z.string().optional(),
}).optional()

export type CreateBudgetPayload = z.infer<typeof CreateBudgetSchema>
export type UpdateBudgetPayload = z.infer<typeof UpdateBudgetSchema>
export type DeleteBudgetPayload = z.infer<typeof DeleteBudgetSchema>
