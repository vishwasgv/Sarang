import { z } from 'zod'

export const CreateProjectSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.string().optional(),
  customerId: z.string().optional(),
  assignedToId: z.string().optional(),
  estimatedHours: z.number().nonnegative('Estimated hours cannot be negative').finite().optional(),
  estimatedAmount: z.number().nonnegative('Estimated amount cannot be negative').finite().optional(),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
})

export const UpdateProjectSchema = z.object({
  id: z.string().min(1, 'Project ID is required'),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  customerId: z.string().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  estimatedHours: z.number().nonnegative('Estimated hours cannot be negative').finite().optional(),
  estimatedAmount: z.number().nonnegative('Estimated amount cannot be negative').finite().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  completedDate: z.string().nullable().optional(),
  notes: z.string().optional(),
})

export const ProjectIdSchema = z.object({ id: z.string().min(1, 'Project ID is required') })

export const CreateProjectTaskSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.string().optional(),
  estimatedHours: z.number().nonnegative('Estimated hours cannot be negative').finite().optional(),
  dueDate: z.string().optional(),
})

export const UpdateProjectTaskSchema = z.object({
  id: z.string().min(1, 'Task ID is required'),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  estimatedHours: z.number().nonnegative('Estimated hours cannot be negative').finite().optional(),
  dueDate: z.string().nullable().optional(),
})

export const ProjectTaskIdSchema = z.object({ id: z.string().min(1, 'Task ID is required') })

export type CreateProjectPayload = z.infer<typeof CreateProjectSchema>
export type UpdateProjectPayload = z.infer<typeof UpdateProjectSchema>
export type CreateProjectTaskPayload = z.infer<typeof CreateProjectTaskSchema>
export type UpdateProjectTaskPayload = z.infer<typeof UpdateProjectTaskSchema>
