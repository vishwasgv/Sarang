import { z } from 'zod'

export const SaveCoachingAttendanceSchema = z.object({
  batchId: z.string().min(1, 'Batch ID is required'),
  attendanceDate: z.string().min(1, 'Attendance date is required'),
  presentStudentIds: z.array(z.string()),
  absentStudentIds: z.array(z.string()),
  takenById: z.string().optional(),
  notes: z.string().optional(),
})

export type SaveCoachingAttendancePayload = z.infer<typeof SaveCoachingAttendanceSchema>
