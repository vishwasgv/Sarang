import { z } from 'zod'

export const CreateMilestoneSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  milestoneName: z.string().min(1, 'Milestone name is required'),
  milestoneAmount: z.number().nonnegative('Milestone amount cannot be negative').finite().optional(),
  status: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
})

export const UpdateMilestoneSchema = z.object({
  id: z.string().min(1, 'Milestone ID is required'),
  milestoneName: z.string().min(1).optional(),
  milestoneAmount: z.number().nonnegative('Milestone amount cannot be negative').finite().nullable().optional(),
  status: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  completedDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export const MilestoneIdSchema = z.object({ id: z.string().min(1, 'Milestone ID is required') })

export type CreateMilestonePayload = z.infer<typeof CreateMilestoneSchema>
export type UpdateMilestonePayload = z.infer<typeof UpdateMilestoneSchema>
