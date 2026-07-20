import { z } from 'zod'

export const ShootBookingIdParamSchema = z.object({ shootBookingId: z.string().min(1, 'Shoot booking ID is required') })
export const EntityIdSchema = z.object({ id: z.string().min(1, 'ID is required') })

export const AddShootChecklistItemSchema = z.object({
  shootBookingId: z.string().min(1, 'Shoot booking ID is required'),
  label: z.string().min(1, 'Label is required').max(200),
  category: z.enum(['EQUIPMENT', 'CREW']).optional(),
})

export const ToggleShootChecklistItemSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  isDone: z.boolean(),
})
