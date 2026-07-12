import { z } from 'zod'

export const CreateCoachingBatchSchema = z.object({
  batchName: z.string().min(1, 'Batch name is required'),
  subjectOrCourse: z.string().min(1, 'Subject or course is required'),
  instructorId: z.string().optional(),
  scheduleDays: z.array(z.string()).optional(),
  scheduleTime: z.string().optional(),
  roomOrLocation: z.string().optional(),
  maxCapacity: z.number().positive('Max capacity must be greater than zero').optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  feePerMonth: z.number().nonnegative('Fee per month cannot be negative'),
  status: z.string().optional(),
})

export const UpdateCoachingBatchSchema = z.object({
  id: z.string().min(1, 'Batch ID is required'),
  batchName: z.string().min(1).optional(),
  subjectOrCourse: z.string().min(1).optional(),
  instructorId: z.string().nullable().optional(),
  scheduleDays: z.array(z.string()).optional(),
  scheduleTime: z.string().nullable().optional(),
  roomOrLocation: z.string().nullable().optional(),
  maxCapacity: z.number().positive('Max capacity must be greater than zero').optional(),
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
  feePerMonth: z.number().nonnegative('Fee per month cannot be negative').optional(),
  status: z.string().optional(),
})

export const CoachingBatchIdSchema = z.object({
  id: z.string().min(1, 'Batch ID is required'),
})

export type CreateCoachingBatchPayload = z.infer<typeof CreateCoachingBatchSchema>
export type UpdateCoachingBatchPayload = z.infer<typeof UpdateCoachingBatchSchema>
