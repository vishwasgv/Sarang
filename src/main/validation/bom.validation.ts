import { z } from 'zod'

const BomItemInputSchema = z.object({
  rawMaterialId: z.string().min(1, 'Raw material is required'),
  quantityNeeded: z.number().positive('Quantity needed must be greater than zero'),
  wastagePercent: z.number().nonnegative('Wastage percent cannot be negative').optional(),
})

export const UpsertBomSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  description: z.string().optional(),
  outputQty: z.number().positive('Output quantity must be greater than zero').optional(),
  items: z.array(BomItemInputSchema).min(1, 'BOM must have at least one raw material'),
})

export const DeleteBomSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
})

export type UpsertBomPayload = z.infer<typeof UpsertBomSchema>
export type DeleteBomPayload = z.infer<typeof DeleteBomSchema>
