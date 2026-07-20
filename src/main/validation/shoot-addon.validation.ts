import { z } from 'zod'

export const ShootBookingIdParamSchema = z.object({ shootBookingId: z.string().min(1, 'Shoot booking ID is required') })
export const EntityIdSchema = z.object({ id: z.string().min(1, 'ID is required') })

export const AddShootAddOnSchema = z.object({
  shootBookingId: z.string().min(1, 'Shoot booking ID is required'),
  description: z.string().min(1, 'Description is required').max(300),
  quantity: z.number().int().positive().max(10000).optional(),
  unitPrice: z.number().nonnegative().finite(),
})
