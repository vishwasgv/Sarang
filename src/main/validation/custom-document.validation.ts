import { z } from 'zod'
import { CustomFieldValuesSchema } from './custom-field.validation'

export const CreateCustomDocumentTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  displayOrder: z.number().int().optional(),
})

export const UpdateCustomDocumentTypeSchema = z.object({
  id: z.string().min(1, 'Custom document type ID is required'),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
})

export const CreateCustomDocumentEntrySchema = z.object({
  documentTypeId: z.string().min(1, 'Custom document type ID is required'),
  entryDate: z.string().min(1).optional(),
  notes: z.string().max(1000).optional(),
  customFields: CustomFieldValuesSchema,
})

export const UpdateCustomDocumentEntrySchema = z.object({
  id: z.string().min(1, 'Custom document entry ID is required'),
  entryDate: z.string().min(1).optional(),
  notes: z.string().max(1000).optional(),
  customFields: CustomFieldValuesSchema,
})

export type CreateCustomDocumentTypePayload = z.infer<typeof CreateCustomDocumentTypeSchema>
export type UpdateCustomDocumentTypePayload = z.infer<typeof UpdateCustomDocumentTypeSchema>
export type CreateCustomDocumentEntryPayload = z.infer<typeof CreateCustomDocumentEntrySchema>
export type UpdateCustomDocumentEntryPayload = z.infer<typeof UpdateCustomDocumentEntrySchema>
