import { z } from 'zod'

export const CreateSupplierSchema = z.object({
  supplierName: z.string().min(1, 'Supplier name is required').max(200),
  phone: z.string().max(30).optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  taxNumber: z.string().max(50).optional(),
  notes: z.string().max(500).optional()
})

export const UpdateSupplierSchema = z.object({
  id: z.string().min(1),
  supplierName: z.string().min(1, 'Supplier name is required').max(200),
  phone: z.string().max(30).optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  taxNumber: z.string().max(50).optional(),
  notes: z.string().max(500).optional()
})

export type CreateSupplierPayload = z.infer<typeof CreateSupplierSchema>
export type UpdateSupplierPayload = z.infer<typeof UpdateSupplierSchema>
