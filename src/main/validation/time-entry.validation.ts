import { z } from 'zod'

export const CreateTimeEntrySchema = z.object({
  caseId: z.string().optional(),
  projectId: z.string().optional(),
  retainerId: z.string().optional(),
  employeeId: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
  description: z.string().min(1, 'Description is required'),
  hours: z.number().positive('Hours must be greater than zero').finite(),
  ratePerHour: z.number().nonnegative('Rate per hour cannot be negative').finite(),
})

export const UpdateTimeEntrySchema = z.object({
  id: z.string().min(1, 'Time entry ID is required'),
  date: z.string().optional(),
  description: z.string().min(1).optional(),
  hours: z.number().positive('Hours must be greater than zero').finite().optional(),
  ratePerHour: z.number().nonnegative('Rate per hour cannot be negative').finite().optional(),
})

export const DeleteTimeEntrySchema = z.object({
  id: z.string().min(1, 'Time entry ID is required'),
})

export const TimeEntryIdsSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, 'At least one time entry is required'),
})

export type CreateTimeEntryPayload = z.infer<typeof CreateTimeEntrySchema>
export type UpdateTimeEntryPayload = z.infer<typeof UpdateTimeEntrySchema>
export type DeleteTimeEntryPayload = z.infer<typeof DeleteTimeEntrySchema>
export type TimeEntryIdsPayload = z.infer<typeof TimeEntryIdsSchema>
