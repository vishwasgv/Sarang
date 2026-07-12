import { z } from 'zod'

export const CreateJobCardSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  itemDescription: z.string().max(2000).optional(),
  priority: z.string().max(20).optional(),
  customerId: z.string().optional(),
  assignedToId: z.string().optional(),
  estimatedCost: z.number().finite().nonnegative('Estimated cost cannot be negative').optional(),
  expectedDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
  internalNotes: z.string().max(2000).optional(),
})

export const UpdateJobCardSchema = z.object({
  id: z.string().min(1, 'Job card ID is required'),
  title: z.string().min(1).optional(),
  itemDescription: z.string().max(2000).optional(),
  status: z.string().max(20).optional(),
  priority: z.string().max(20).optional(),
  customerId: z.string().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  estimatedCost: z.number().finite().nonnegative('Estimated cost cannot be negative').optional(),
  actualCost: z.number().finite().nonnegative('Actual cost cannot be negative').optional(),
  expectedDate: z.string().nullable().optional(),
  deliveredDate: z.string().nullable().optional(),
  notes: z.string().max(2000).optional(),
  internalNotes: z.string().max(2000).optional(),
})

export const DeleteJobCardSchema = z.object({
  id: z.string().min(1, 'Job card ID is required'),
})

export type CreateJobCardPayload = z.infer<typeof CreateJobCardSchema>
export type UpdateJobCardPayload = z.infer<typeof UpdateJobCardSchema>
