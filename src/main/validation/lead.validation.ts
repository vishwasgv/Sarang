import { z } from 'zod'

export const CreateLeadSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().max(255).optional(),
  phone: z.string().max(30).optional(),
  companyName: z.string().max(255).optional(),
  source: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  estimatedValue: z.number().nonnegative('Estimated value cannot be negative').finite().optional(),
  assignedToId: z.string().optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateLeadSchema = z.object({
  id: z.string().min(1, 'Lead ID is required'),
  fullName: z.string().min(1).optional(),
  email: z.string().max(255).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  companyName: z.string().max(255).nullable().optional(),
  source: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  estimatedValue: z.number().nonnegative('Estimated value cannot be negative').finite().nullable().optional(),
  assignedToId: z.string().nullable().optional(),
  convertedClientId: z.string().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export type CreateLeadPayload = z.infer<typeof CreateLeadSchema>
export type UpdateLeadPayload = z.infer<typeof UpdateLeadSchema>
