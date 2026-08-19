import { z } from 'zod'

const SlabBreakpointSchema = z.object({
  minQty: z.number().positive(),
  discountPercent: z.number().min(0).max(100),
})

export const CreatePricingSchemeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  ruleType: z.enum(['BUY_X_GET_Y_FREE', 'SLAB_DISCOUNT', 'FLAT_PERCENT_OFF']),
  productId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  buyQuantity: z.number().positive().optional(),
  freeQuantity: z.number().positive().optional(),
  slabBreakpoints: z.array(SlabBreakpointSchema).optional(),
  flatDiscountPercent: z.number().min(0).max(100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  // Time-of-day window (minutes since midnight) — optional, gates any
  // ruleType, e.g. a happy-hour FLAT_PERCENT_OFF from 16:00-18:00.
  startTimeMinutes: z.number().int().min(0).max(1439).optional(),
  endTimeMinutes: z.number().int().min(0).max(1439).optional(),
}).refine((v) => !!v.productId || !!v.categoryId, {
  message: 'A scheme must be scoped to either a product or a category.'
}).refine((v) => v.ruleType !== 'BUY_X_GET_Y_FREE' || (!!v.buyQuantity && !!v.freeQuantity), {
  message: 'buyQuantity and freeQuantity are required for a BUY_X_GET_Y_FREE scheme.'
}).refine((v) => v.ruleType !== 'SLAB_DISCOUNT' || (!!v.slabBreakpoints && v.slabBreakpoints.length > 0), {
  message: 'At least one slab breakpoint is required for a SLAB_DISCOUNT scheme.'
}).refine((v) => v.ruleType !== 'FLAT_PERCENT_OFF' || v.flatDiscountPercent !== undefined, {
  message: 'flatDiscountPercent is required for a FLAT_PERCENT_OFF scheme.'
}).refine((v) => (v.startTimeMinutes === undefined) === (v.endTimeMinutes === undefined), {
  message: 'startTimeMinutes and endTimeMinutes must be set together.'
}).refine((v) => v.startTimeMinutes === undefined || v.endTimeMinutes === undefined || v.endTimeMinutes > v.startTimeMinutes, {
  message: 'endTimeMinutes must be after startTimeMinutes — a window crossing midnight is not supported.'
})

export const UpdatePricingSchemeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200).optional(),
  isActive: z.boolean().optional(),
  endDate: z.string().nullable().optional(),
})

const CartLineSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
})

export const EvaluateCartSchema = z.object({
  items: z.array(CartLineSchema).min(1),
})

export type CreatePricingSchemePayload = z.infer<typeof CreatePricingSchemeSchema>
export type UpdatePricingSchemePayload = z.infer<typeof UpdatePricingSchemeSchema>
export type EvaluateCartPayload = z.infer<typeof EvaluateCartSchema>
