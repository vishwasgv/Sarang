import { z } from 'zod'

export const CreateDispatchSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  productionOrderId: z.string().optional(),
  quantity: z.number().finite().positive('Dispatch quantity must be greater than zero'),
  customerId: z.string().optional(),
  destination: z.string().max(255).optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateDispatchStatusSchema = z.object({
  id: z.string().min(1, 'Dispatch ID is required'),
  status: z.enum(['DISPATCHED', 'DELIVERED']),
  date: z.string().optional(),
})

export type CreateDispatchPayload = z.infer<typeof CreateDispatchSchema>
export type UpdateDispatchStatusPayload = z.infer<typeof UpdateDispatchStatusSchema>
