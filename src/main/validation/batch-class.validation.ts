import { z } from 'zod'

export const CreateBatchClassSchema = z.object({
  className: z.string().min(1, 'Class name is required'),
  instructorId: z.string().optional(),
  maxCapacity: z.number().positive('Max capacity must be greater than zero'),
  scheduleDays: z.string().min(1, 'Schedule days are required'),
  scheduleTime: z.string().min(1, 'Schedule time is required'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  roomOrLocation: z.string().optional(),
})

export const UpdateBatchClassSchema = z.object({
  id: z.string().min(1, 'Class ID is required'),
  className: z.string().min(1).optional(),
  instructorId: z.string().nullable().optional(),
  maxCapacity: z.number().positive('Max capacity must be greater than zero').optional(),
  scheduleDays: z.string().optional(),
  scheduleTime: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
  roomOrLocation: z.string().nullable().optional(),
  status: z.string().optional(),
})

export const EnrollMemberSchema = z.object({
  batchClassId: z.string().min(1, 'Class ID is required'),
  memberId: z.string().min(1, 'Member ID is required'),
})

export const UnenrollMemberSchema = z.object({
  batchClassId: z.string().min(1, 'Class ID is required'),
  memberId: z.string().min(1, 'Member ID is required'),
})

export const MarkAttendanceSchema = z.object({
  classId: z.string().min(1, 'Class ID is required'),
  memberIds: z.array(z.string()),
  sessionDate: z.string().min(1, 'Session date is required'),
})

export type CreateBatchClassPayload = z.infer<typeof CreateBatchClassSchema>
export type UpdateBatchClassPayload = z.infer<typeof UpdateBatchClassSchema>
export type EnrollMemberPayload = z.infer<typeof EnrollMemberSchema>
export type UnenrollMemberPayload = z.infer<typeof UnenrollMemberSchema>
export type MarkAttendancePayload = z.infer<typeof MarkAttendanceSchema>
