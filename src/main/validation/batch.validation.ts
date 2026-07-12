import { z } from 'zod'

export const CreateBatchSchema = z.object({
  productId: z.string().min(1, 'Product is required'),
  batchNumber: z.string().min(1, 'Batch number is required'),
  expiryDate: z.string().min(1, 'Expiry date is required'),
  mfgDate: z.string().optional(),
  quantityReceived: z.number().positive('Quantity received must be greater than zero'),
  // Fresh-audit fix: unitCost previously accepted negative numbers with no guard.
  unitCost: z.number().nonnegative('Unit cost cannot be negative').optional(),
  supplierId: z.string().optional(),
})

export const UpdateBatchSchema = z.object({
  id: z.string().min(1, 'Batch ID is required'),
  expiryDate: z.string().optional(),
  mfgDate: z.string().optional(),
  quantityRemaining: z.number().nonnegative('Quantity remaining cannot be negative').optional(),
  // Fresh-audit fix: unitCost previously accepted negative numbers with no guard.
  unitCost: z.number().nonnegative('Unit cost cannot be negative').optional(),
})

export const DeleteBatchSchema = z.object({
  id: z.string().min(1, 'Batch ID is required'),
})

export type CreateBatchPayload = z.infer<typeof CreateBatchSchema>
export type UpdateBatchPayload = z.infer<typeof UpdateBatchSchema>
export type DeleteBatchPayload = z.infer<typeof DeleteBatchSchema>
