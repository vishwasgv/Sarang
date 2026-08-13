import { z } from 'zod'

export const CreateCostCentreSchema = z.object({
  name: z.string().min(1, 'Cost centre name is required').max(120),
  code: z.string().max(30).optional(),
})

export const UpdateCostCentreSchema = z.object({
  id: z.string().min(1, 'Cost centre ID is required'),
  name: z.string().min(1).max(120).optional(),
  code: z.string().max(30).optional(),
  isActive: z.boolean().optional(),
})

export type CreateCostCentrePayload = z.infer<typeof CreateCostCentreSchema>
export type UpdateCostCentrePayload = z.infer<typeof UpdateCostCentreSchema>
