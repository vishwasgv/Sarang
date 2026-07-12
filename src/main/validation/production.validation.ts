import { z } from 'zod'

export const CreateProductionOrderSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  plannedQty: z.number().positive('Planned quantity must be greater than zero').finite(),
  notes: z.string().optional(),
})

export const ProductionOrderIdSchema = z.object({ id: z.string().min(1, 'Production order ID is required') })

export const CompleteProductionOrderSchema = z.object({
  id: z.string().min(1, 'Production order ID is required'),
  producedQty: z.number().positive('Produced quantity must be greater than zero').finite(),
  notes: z.string().optional(),
})

export const CancelProductionOrderSchema = z.object({
  id: z.string().min(1, 'Production order ID is required'),
  notes: z.string().optional(),
})

export type CreateProductionOrderPayload = z.infer<typeof CreateProductionOrderSchema>
export type CompleteProductionOrderPayload = z.infer<typeof CompleteProductionOrderSchema>
export type CancelProductionOrderPayload = z.infer<typeof CancelProductionOrderSchema>
