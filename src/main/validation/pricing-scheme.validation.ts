import { z } from 'zod'

const SlabBreakpointSchema = z.object({
  minQty: z.number().positive(),
  discountPercent: z.number().min(0).max(100),
})

export const CreatePricingSchemeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  ruleType: z.enum(['BUY_X_GET_Y_FREE', 'SLAB_DISCOUNT']),
  productId: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(),
  buyQuantity: z.number().positive().optional(),
  freeQuantity: z.number().positive().optional(),
  slabBreakpoints: z.array(SlabBreakpointSchema).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}).refine((v) => !!v.productId || !!v.categoryId, {
  message: 'A scheme must be scoped to either a product or a category.'
}).refine((v) => v.ruleType !== 'BUY_X_GET_Y_FREE' || (!!v.buyQuantity && !!v.freeQuantity), {
  message: 'buyQuantity and freeQuantity are required for a BUY_X_GET_Y_FREE scheme.'
}).refine((v) => v.ruleType !== 'SLAB_DISCOUNT' || (!!v.slabBreakpoints && v.slabBreakpoints.length > 0), {
  message: 'At least one slab breakpoint is required for a SLAB_DISCOUNT scheme.'
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
