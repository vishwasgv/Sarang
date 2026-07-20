import { z } from 'zod'

// Phase 58 §2 — multi-level BOM: a line is EITHER a raw material OR another
// finished/semi-finished Product (a sub-assembly with its own BOM), never
// both — enforced with .refine below rather than two separate schemas,
// since every other field (quantityNeeded/wastagePercent) is identical.
const BomItemInputSchema = z.object({
  rawMaterialId: z.string().optional(),
  componentProductId: z.string().optional(),
  quantityNeeded: z.number().positive('Quantity needed must be greater than zero'),
  wastagePercent: z.number().nonnegative('Wastage percent cannot be negative').optional(),
}).refine(item => !!item.rawMaterialId !== !!item.componentProductId, {
  message: 'Each BOM line must be either a raw material or a component product, not both or neither.'
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
