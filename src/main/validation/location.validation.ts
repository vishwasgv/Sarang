import { z } from 'zod'

export const CreateLocationSchema = z.object({
  name: z.string().min(1, 'Location name is required').max(120),
  address: z.string().max(500).optional(),
})

export const UpdateLocationSchema = z.object({
  id: z.string().min(1, 'Location ID is required'),
  name: z.string().min(1).max(120).optional(),
  address: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
})

export type CreateLocationPayload = z.infer<typeof CreateLocationSchema>
export type UpdateLocationPayload = z.infer<typeof UpdateLocationSchema>
