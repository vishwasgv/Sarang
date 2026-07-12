import { z } from 'zod'

export const CreateSprintSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  name: z.string().optional(),
  goal: z.string().optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().min(1, 'End date is required'),
})

export const UpdateSprintSchema = z.object({
  id: z.string().min(1, 'Sprint ID is required'),
  name: z.string().nullable().optional(),
  goal: z.string().nullable().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  status: z.string().optional(),
})

export const DeleteSprintSchema = z.object({
  id: z.string().min(1, 'Sprint ID is required'),
})

export type CreateSprintPayload = z.infer<typeof CreateSprintSchema>
export type UpdateSprintPayload = z.infer<typeof UpdateSprintSchema>
export type DeleteSprintPayload = z.infer<typeof DeleteSprintSchema>
