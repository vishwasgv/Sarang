import { z } from 'zod'

export const CreateServiceComboSchema = z.object({
  comboName: z.string().min(1, 'Combo name is required'),
  description: z.string().optional(),
  comboPrice: z.coerce.number().positive('Combo price must be greater than zero'),
  serviceCatalogIds: z.array(z.string().min(1)).min(2, 'A combo needs at least 2 distinct services'),
})

export const UpdateServiceComboSchema = z.object({
  id: z.string().min(1),
  comboName: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  comboPrice: z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : v), z.coerce.number().positive('Combo price must be greater than zero').optional()),
  isActive: z.boolean().optional(),
  serviceCatalogIds: z.array(z.string().min(1)).min(2, 'A combo needs at least 2 distinct services').optional(),
})

export const ServiceComboIdSchema = z.object({
  id: z.string().min(1, 'id is required'),
})

export type CreateServiceComboPayload = z.infer<typeof CreateServiceComboSchema>
export type UpdateServiceComboPayload = z.infer<typeof UpdateServiceComboSchema>
