import { z } from 'zod'

export const AddStockSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().positive('Quantity must be greater than zero'),
  reason: z.string().min(1, 'Reason is required').max(255),
  unitCost: z.number().min(0).optional(),
  referenceType: z.string().max(50).optional(),
  referenceId: z.string().optional(),
})

export const AdjustStockSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z.number().min(0, 'Quantity cannot be negative'),
  reason: z.string().min(1, 'Reason is required for stock adjustment').max(255),
  unitCost: z.number().min(0).optional(),
})

export type AddStockPayload = z.infer<typeof AddStockSchema>
export type AdjustStockPayload = z.infer<typeof AdjustStockSchema>
