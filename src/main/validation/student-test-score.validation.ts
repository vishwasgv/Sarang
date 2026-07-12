import { z } from 'zod'

export const CreateTestScoreSchema = z.object({
  enrollmentId: z.string().min(1, 'Enrollment is required'),
  testName: z.string().min(1, 'Test name is required'),
  subject: z.string().optional(),
  marksObtained: z.number().nonnegative('Marks obtained cannot be negative').finite(),
  maxMarks: z.number().positive('Max marks must be greater than zero').finite(),
  testDate: z.string().min(1, 'Test date is required'),
  grade: z.string().optional(),
  notes: z.string().optional(),
})

export const UpdateTestScoreSchema = z.object({
  id: z.string().min(1, 'Test score ID is required'),
  testName: z.string().min(1).optional(),
  subject: z.string().nullable().optional(),
  marksObtained: z.number().nonnegative('Marks obtained cannot be negative').finite().optional(),
  maxMarks: z.number().positive('Max marks must be greater than zero').finite().optional(),
  testDate: z.string().optional(),
  grade: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export const DeleteTestScoreSchema = z.object({
  id: z.string().min(1, 'Test score ID is required'),
})

export type CreateTestScorePayload = z.infer<typeof CreateTestScoreSchema>
export type UpdateTestScorePayload = z.infer<typeof UpdateTestScoreSchema>
export type DeleteTestScorePayload = z.infer<typeof DeleteTestScoreSchema>
