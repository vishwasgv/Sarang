import { z } from 'zod'

const VariantInputSchema = z.object({
  id: z.string().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  sku: z.string().optional(),
  barcode: z.string().optional(),
  additionalPrice: z.number().nonnegative('Additional price cannot be negative').finite().optional(),
  stockQty: z.number().nonnegative('Stock quantity cannot be negative').int().optional(),
})

export const UpsertVariantsSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  variants: z.array(VariantInputSchema).min(1, 'At least one variant is required'),
})

export const DeleteVariantSchema = z.object({
  id: z.string().min(1, 'Variant ID is required'),
})

export const AdjustVariantStockSchema = z.object({
  variantId: z.string().min(1, 'Variant is required'),
  quantityDelta: z.number().int('Quantity delta must be a whole number').finite().refine((v) => v !== 0, 'Quantity delta cannot be zero'),
})

export type UpsertVariantsPayload = z.infer<typeof UpsertVariantsSchema>
export type DeleteVariantPayload = z.infer<typeof DeleteVariantSchema>
export type AdjustVariantStockPayload = z.infer<typeof AdjustVariantStockSchema>
