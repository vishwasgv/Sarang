import { z } from 'zod'

export const CreateExpenseSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  expenseName: z.string().min(1, 'Expense name is required'),
  amount: z.number().finite().positive('Amount must be greater than zero'),
  expenseDate: z.string().optional(),
  paymentMethod: z.string().max(50).optional(),
  remarks: z.string().max(2000).optional(),
})

export const UpdateExpenseSchema = z.object({
  id: z.string().min(1, 'Expense ID is required'),
  categoryId: z.string().min(1, 'Category is required'),
  expenseName: z.string().min(1, 'Expense name is required'),
  amount: z.number().finite().positive('Amount must be greater than zero'),
  expenseDate: z.string().optional(),
  paymentMethod: z.string().max(50).optional(),
  remarks: z.string().max(2000).optional(),
})

export const CreateExpenseCategorySchema = z.object({
  categoryName: z.string().min(1, 'categoryName is required'),
  description: z.string().max(500).optional(),
})

export type CreateExpensePayload = z.infer<typeof CreateExpenseSchema>
export type UpdateExpensePayload = z.infer<typeof UpdateExpenseSchema>
export type CreateExpenseCategoryPayload = z.infer<typeof CreateExpenseCategorySchema>
