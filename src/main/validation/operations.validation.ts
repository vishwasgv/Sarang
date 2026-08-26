import { z } from 'zod'

export const CreateReturnSchema = z.object({
  originalInvoiceId: z.string().min(1, 'Original invoice ID is required'),
  items: z.array(z.object({
    productId: z.string().min(1, 'Product ID is required'),
    quantity: z.number().positive('Quantity must be greater than zero'),
    // Optional — distinguishes which size/colour variant is being returned
    // when the same product was sold as more than one variant on the
    // original invoice (real bug fix 2026-07-16, see returns.service.ts).
    variantId: z.string().min(1).optional(),
  })).min(1, 'At least one item is required'),
  reason: z.string().min(1, 'Reason is required'),
})

// Phase 67 §9.1 — Clothing item 4: size/color exchange workflow.
export const CreateExchangeSchema = z.object({
  originalInvoiceId: z.string().min(1, 'Original invoice ID is required'),
  oldProductId: z.string().min(1, 'Product ID is required'),
  oldVariantId: z.string().min(1, 'Original variant is required'),
  quantity: z.number().positive('Quantity must be greater than zero'),
  newVariantId: z.string().min(1, 'Replacement variant is required'),
  reason: z.string().min(1, 'Reason is required'),
  paymentMethod: z.enum(['CASH', 'UPI', 'CARD', 'WALLET', 'CREDIT', 'SPLIT']),
})

export const CashCloseCreateSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  actualCash: z.number().nonnegative('Actual cash cannot be negative').finite(),
  notes: z.string().max(2000).optional(),
})

// Phase 67 §9.1 — Footwear item 3: trial-pair counter workflow.
export const RecordTrialSessionSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  triedVariantIds: z.array(z.string().min(1)).min(2, 'At least two variants must be tried on'),
  purchasedVariantId: z.string().min(1).optional().nullable(),
  customerId: z.string().min(1).optional().nullable(),
})

// Phase 67 §9.1 — Footwear item 5: seasonal reorder calendar.
export const SeasonalCycleSchema = z.object({
  name: z.string().min(1, 'Season name is required').max(100),
  startMonth: z.number().int().min(1).max(12),
  startDay: z.number().int().min(1).max(31),
  endMonth: z.number().int().min(1).max(12),
  endDay: z.number().int().min(1).max(31),
  leadTimeDays: z.number().int().min(0).optional(),
})
export const UpdateSeasonalCycleSchema = SeasonalCycleSchema.extend({ id: z.string().min(1, 'ID is required') })

// Phase 67 §9.1 — Agri Inputs item 1: crop-season-aligned credit terms.
export const CropSeasonSchema = z.object({
  name: z.string().min(1, 'Season name is required').max(100),
  harvestMonth: z.number().int().min(1).max(12),
  harvestDay: z.number().int().min(1).max(31),
})
export const UpdateCropSeasonSchema = CropSeasonSchema.extend({ id: z.string().min(1, 'ID is required') })

export type CreateReturnPayload = z.infer<typeof CreateReturnSchema>
export type CreateExchangePayload = z.infer<typeof CreateExchangeSchema>
export type CashCloseCreatePayload = z.infer<typeof CashCloseCreateSchema>
export type RecordTrialSessionPayload = z.infer<typeof RecordTrialSessionSchema>
export type SeasonalCyclePayload = z.infer<typeof SeasonalCycleSchema>
export type UpdateSeasonalCyclePayload = z.infer<typeof UpdateSeasonalCycleSchema>
export type CropSeasonPayload = z.infer<typeof CropSeasonSchema>
export type UpdateCropSeasonPayload = z.infer<typeof UpdateCropSeasonSchema>
