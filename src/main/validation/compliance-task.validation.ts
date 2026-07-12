import { z } from 'zod'

export const CreateComplianceTaskSchema = z.object({
  complianceEventId: z.string().optional(),
  clientId: z.string().min(1, 'Client is required'),
  staffId: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  category: z.string().min(1, 'Category is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  priority: z.string().optional(),
  notes: z.string().optional(),
})

export const UpdateComplianceTaskSchema = z.object({
  id: z.string().min(1, 'Task ID is required'),
  staffId: z.string().nullable().optional(),
  title: z.string().min(1).optional(),
  category: z.string().optional(),
  dueDate: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  notes: z.string().nullable().optional(),
  filedOn: z.string().nullable().optional(),
  acknowledgmentNo: z.string().nullable().optional(),
})

export const ComplianceTaskIdSchema = z.object({
  id: z.string().min(1, 'Task ID is required'),
})

export type CreateComplianceTaskPayload = z.infer<typeof CreateComplianceTaskSchema>
export type UpdateComplianceTaskPayload = z.infer<typeof UpdateComplianceTaskSchema>
