import { z } from 'zod'

export const CreateEnrollmentSchema = z.object({
  batchId: z.string().min(1, 'Batch is required'),
  studentId: z.string().min(1, 'Student is required'),
  discountType: z.string().optional(),
  discountAmount: z.number().nonnegative('Discount amount cannot be negative').optional(),
  effectiveFee: z.number().nonnegative('Effective fee cannot be negative'),
  enrolledDate: z.string().optional(),
  notes: z.string().optional(),
})

export const UpdateEnrollmentSchema = z.object({
  id: z.string().min(1, 'Enrollment ID is required'),
  status: z.string().optional(),
  discountType: z.string().optional(),
  discountAmount: z.number().nonnegative('Discount amount cannot be negative').optional(),
  effectiveFee: z.number().nonnegative('Effective fee cannot be negative').optional(),
  notes: z.string().nullable().optional(),
})

export const EnrollmentIdSchema = z.object({
  id: z.string().min(1, 'Enrollment ID is required'),
})

export type CreateEnrollmentPayload = z.infer<typeof CreateEnrollmentSchema>
export type UpdateEnrollmentPayload = z.infer<typeof UpdateEnrollmentSchema>
