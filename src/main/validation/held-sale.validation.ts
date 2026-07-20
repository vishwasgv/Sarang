import { z } from 'zod'

export const HoldSaleSchema = z.object({
  cartJson: z.string().min(1, 'Cannot hold an empty cart.'),
  itemCount: z.number().int().positive('Cannot hold an empty cart.'),
  totalAmount: z.number().nonnegative('Total amount cannot be negative').finite(),
  label: z.string().max(100).optional(),
  customerId: z.string().optional(),
})

export const HeldSaleIdSchema = z.object({ id: z.string().min(1, 'Held sale ID is required') })

export type HoldSalePayload = z.infer<typeof HoldSaleSchema>
