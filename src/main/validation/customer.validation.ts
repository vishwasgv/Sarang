import { z } from 'zod'

export const CreateCustomerSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required').max(200),
  phone: z.string().max(30).optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  taxNumber: z.string().max(50).optional(),
  taxExempt: z.boolean().default(false),
  taxExemptReason: z.string().max(200).optional(),
  creditLimit: z.number().min(0, 'Credit limit cannot be negative').default(0),
  notes: z.string().max(500).optional()
})

export const UpdateCustomerSchema = z.object({
  id: z.string().min(1),
  customerName: z.string().min(1, 'Customer name is required').max(200),
  phone: z.string().max(30).optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  taxNumber: z.string().max(50).optional(),
  taxExempt: z.boolean().default(false),
  taxExemptReason: z.string().max(200).optional(),
  creditLimit: z.number().min(0, 'Credit limit cannot be negative').default(0),
  notes: z.string().max(500).optional()
})

export type CreateCustomerPayload = z.infer<typeof CreateCustomerSchema>
export type UpdateCustomerPayload = z.infer<typeof UpdateCustomerSchema>
