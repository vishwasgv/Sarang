import { z } from 'zod'

const POItemSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitCost: z.number().min(0, 'Unit cost cannot be negative'),
  taxRate: z.number().min(0).max(100).default(0),
})

export const CreatePOSchema = z.object({
  supplierId: z.string().min(1, 'Supplier is required'),
  expectedDate: z.string().optional(),
  notes: z.string().max(500).optional(),
  items: z.array(POItemSchema).min(1, 'At least one item is required'),
})

export const CancelPOSchema = z.object({
  id: z.string().min(1),
  reason: z.string().min(1, 'Cancellation reason is required').max(500),
})

export type CreatePOPayload = z.infer<typeof CreatePOSchema>
export type CancelPOPayload = z.infer<typeof CancelPOSchema>
