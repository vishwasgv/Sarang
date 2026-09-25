import { z } from 'zod'

export const CreateTaxSchema = z.object({
  taxName: z.string().min(1, 'Tax name is required').max(100),
  taxType: z.enum(['GST', 'VAT', 'SALES_TAX', 'CUSTOM', 'NONE'], { errorMap: () => ({ message: 'Invalid tax type' }) }),
  rate: z.number().min(0, 'Tax rate cannot be negative').max(100, 'Tax rate cannot exceed 100%'),
  country: z.string().max(100).optional(),
  isDefault: z.boolean().default(false),
  components: z.array(z.object({ name: z.string().min(1).max(40), rate: z.number().positive().max(100) })).max(6).optional(),
})

export const UpdateTaxSchema = z.object({
  id: z.string().min(1),
  taxName: z.string().min(1, 'Tax name is required').max(100),
  taxType: z.enum(['GST', 'VAT', 'SALES_TAX', 'CUSTOM', 'NONE']),
  rate: z.number().min(0, 'Tax rate cannot be negative').max(100),
  country: z.string().max(100).optional(),
  isDefault: z.boolean().default(false),
  components: z.array(z.object({ name: z.string().min(1).max(40), rate: z.number().positive().max(100) })).max(6).optional(),
})

export type CreateTaxPayload = z.infer<typeof CreateTaxSchema>
export type UpdateTaxPayload = z.infer<typeof UpdateTaxSchema>
