import { z } from 'zod'

export const CreateServiceSchema = z.object({
  serviceName: z.string().min(1, 'Service name is required'),
  serviceCode: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  durationMinutes: z.number().positive('Duration must be greater than zero').finite().optional(),
  basePrice: z.number().nonnegative('Base price cannot be negative').finite().optional(),
  taxRate: z.number().nonnegative('Tax rate cannot be negative').finite().optional(),
  sacCode: z.string().optional(),
  notes: z.string().optional(),
})

export const UpdateServiceSchema = z.object({
  id: z.string().min(1, 'Service ID is required'),
  serviceName: z.string().min(1).optional(),
  serviceCode: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  durationMinutes: z.number().positive('Duration must be greater than zero').finite().optional(),
  basePrice: z.number().nonnegative('Base price cannot be negative').finite().optional(),
  taxRate: z.number().nonnegative('Tax rate cannot be negative').finite().optional(),
  sacCode: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().nullable().optional(),
})

export const ServiceIdSchema = z.object({ id: z.string().min(1, 'Service ID is required') })

export type CreateServicePayload = z.infer<typeof CreateServiceSchema>
export type UpdateServicePayload = z.infer<typeof UpdateServiceSchema>
