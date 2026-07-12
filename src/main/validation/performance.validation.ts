import { z } from 'zod'

export const CreatePerformanceSchema = z.object({
  batchId: z.string().min(1, 'Batch ID is required'),
  performanceName: z.string().min(1, 'Performance name is required'),
  date: z.string().min(1, 'Date is required'),
  venue: z.string().max(255).optional(),
  participatingStudentIds: z.array(z.string()).optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdatePerformanceSchema = z.object({
  id: z.string().min(1, 'Performance ID is required'),
  performanceName: z.string().min(1).optional(),
  date: z.string().optional(),
  venue: z.string().max(255).nullable().optional(),
  participatingStudentIds: z.array(z.string()).optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export type CreatePerformancePayload = z.infer<typeof CreatePerformanceSchema>
export type UpdatePerformancePayload = z.infer<typeof UpdatePerformanceSchema>
