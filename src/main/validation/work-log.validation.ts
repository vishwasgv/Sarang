import { z } from 'zod'

export const CreateWorkLogSchema = z.object({
  projectId: z.string().optional(),
  ticketId: z.string().optional(),
  jobCardId: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  hours: z.number().positive('Hours must be greater than zero').finite(),
  logDate: z.string().optional(),
  billable: z.boolean().optional(),
})

export const DeleteWorkLogSchema = z.object({
  id: z.string().min(1, 'Work log ID is required'),
})

export type CreateWorkLogPayload = z.infer<typeof CreateWorkLogSchema>
export type DeleteWorkLogPayload = z.infer<typeof DeleteWorkLogSchema>
