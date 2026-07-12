import { z } from 'zod'

export const CreateStudentSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().min(1, 'Customer name is required'),
  phone: z.string().optional(),
  email: z.string().optional(),
  address: z.string().optional(),
  rollNumber: z.string().optional(),
  classOrGrade: z.string().min(1, 'Class/grade is required'),
  schoolName: z.string().optional(),
  parentPhone: z.string().optional(),
  enrollmentDate: z.string().optional(),
})

export const UpdateStudentSchema = z.object({
  id: z.string().min(1, 'Student ID is required'),
  customerName: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  rollNumber: z.string().nullable().optional(),
  classOrGrade: z.string().min(1).optional(),
  schoolName: z.string().nullable().optional(),
  parentPhone: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
})

export const DeleteStudentSchema = z.object({
  id: z.string().min(1, 'Student ID is required'),
})

export type CreateStudentPayload = z.infer<typeof CreateStudentSchema>
export type UpdateStudentPayload = z.infer<typeof UpdateStudentSchema>
export type DeleteStudentPayload = z.infer<typeof DeleteStudentSchema>
