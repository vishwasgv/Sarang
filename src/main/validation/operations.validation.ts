import { z } from 'zod'

export const CreateReturnSchema = z.object({
  originalInvoiceId: z.string().min(1, 'Original invoice ID is required'),
  items: z.array(z.object({
    productId: z.string().min(1, 'Product ID is required'),
    quantity: z.number().positive('Quantity must be greater than zero'),
  })).min(1, 'At least one item is required'),
  reason: z.string().min(1, 'Reason is required'),
})

export const CashCloseCreateSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  actualCash: z.number().nonnegative('Actual cash cannot be negative').finite(),
  notes: z.string().max(2000).optional(),
})

export type CreateReturnPayload = z.infer<typeof CreateReturnSchema>
export type CashCloseCreatePayload = z.infer<typeof CashCloseCreateSchema>
