import { z } from 'zod'

export const CreateEngagementSchema = z.object({
  clientId: z.string().min(1, 'Client is required'),
  staffId: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  engagementType: z.string().max(50).optional(),
  feeType: z.string().max(50).optional(),
  feeAmount: z.number().finite().nonnegative('Fee amount cannot be negative').optional(),
  billingDay: z.number().finite().int().min(1).max(31).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateEngagementSchema = z.object({
  id: z.string().min(1, 'Engagement ID is required'),
  staffId: z.string().nullable().optional(),
  title: z.string().min(1).optional(),
  engagementType: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  feeType: z.string().max(50).optional(),
  feeAmount: z.number().finite().nonnegative('Fee amount cannot be negative').nullable().optional(),
  billingDay: z.number().finite().int().min(1).max(31).nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export const DeleteEngagementSchema = z.object({
  id: z.string().min(1, 'Engagement ID is required'),
})

export const GenerateEngagementInvoiceSchema = z.object({
  id: z.string().min(1, 'Engagement ID is required'),
  period: z.string().optional(),
})

export type CreateEngagementPayload = z.infer<typeof CreateEngagementSchema>
export type UpdateEngagementPayload = z.infer<typeof UpdateEngagementSchema>
