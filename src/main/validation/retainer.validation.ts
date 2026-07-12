import { z } from 'zod'

export const CreateRetainerSchema = z.object({
  clientId: z.string().min(1, 'Client ID is required'),
  assignedToId: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  retainerType: z.string().optional(),
  status: z.string().optional(),
  monthlyAmount: z.number().nonnegative('Monthly amount cannot be negative').finite(),
  billingDay: z.number().int().min(1).max(31).optional(),
  hoursPerMonth: z.number().nonnegative('Hours per month cannot be negative').finite().optional(),
  deliverables: z.string().optional(),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional(),
  notes: z.string().optional(),
})

export const UpdateRetainerSchema = z.object({
  id: z.string().min(1, 'Retainer ID is required'),
  assignedToId: z.string().nullable().optional(),
  title: z.string().min(1).optional(),
  retainerType: z.string().optional(),
  monthlyAmount: z.number().nonnegative('Monthly amount cannot be negative').finite().optional(),
  billingDay: z.number().int().min(1).max(31).nullable().optional(),
  hoursPerMonth: z.number().nonnegative('Hours per month cannot be negative').finite().nullable().optional(),
  deliverables: z.string().nullable().optional(),
  status: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

export const RetainerIdSchema = z.object({ id: z.string().min(1, 'Retainer ID is required') })

export const GenerateRetainerInvoiceSchema = z.object({
  id: z.string().min(1, 'Retainer ID is required'),
  period: z.string().optional(),
})

export type CreateRetainerPayload = z.infer<typeof CreateRetainerSchema>
export type UpdateRetainerPayload = z.infer<typeof UpdateRetainerSchema>
