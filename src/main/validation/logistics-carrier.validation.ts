import { z } from 'zod'

export const CreateCarrierSchema = z.object({
  name: z.string().min(1, 'Carrier name is required'),
  type: z.string().max(50).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().max(255).optional(),
  gstNumber: z.string().max(50).optional(),
  ratePerKg: z.number().nonnegative('Rate per kg cannot be negative').finite().optional(),
  ratePerKm: z.number().nonnegative('Rate per km cannot be negative').finite().optional(),
  notes: z.string().max(2000).optional(),
})

export const UpdateCarrierSchema = z.object({
  id: z.string().min(1, 'Carrier ID is required'),
  name: z.string().min(1).optional(),
  type: z.string().max(50).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().max(255).optional(),
  gstNumber: z.string().max(50).optional(),
  ratePerKg: z.number().nonnegative('Rate per kg cannot be negative').finite().nullable().optional(),
  ratePerKm: z.number().nonnegative('Rate per km cannot be negative').finite().nullable().optional(),
  notes: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
})

export type CreateCarrierPayload = z.infer<typeof CreateCarrierSchema>
export type UpdateCarrierPayload = z.infer<typeof UpdateCarrierSchema>
