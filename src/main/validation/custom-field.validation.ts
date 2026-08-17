import { z } from 'zod'

export const CUSTOM_FIELD_ENTITY_TYPES = ['INVOICE', 'CUSTOMER', 'SUPPLIER', 'PRODUCT', 'EXPENSE'] as const
export const CUSTOM_FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'SELECT'] as const

export const CreateCustomFieldDefinitionSchema = z.object({
  entityType: z.enum(CUSTOM_FIELD_ENTITY_TYPES),
  fieldName: z.string().min(1, 'Field name is required').max(100),
  fieldType: z.enum(CUSTOM_FIELD_TYPES),
  selectOptions: z.array(z.string().min(1)).max(50).optional(),
  displayOrder: z.number().int().optional(),
}).refine((v) => v.fieldType !== 'SELECT' || (v.selectOptions && v.selectOptions.length > 0), {
  message: 'A SELECT field needs at least one option', path: ['selectOptions']
})

export const UpdateCustomFieldDefinitionSchema = z.object({
  id: z.string().min(1, 'Custom field ID is required'),
  fieldName: z.string().min(1).max(100).optional(),
  selectOptions: z.array(z.string().min(1)).max(50).optional(),
  isActive: z.boolean().optional(),
  displayOrder: z.number().int().optional(),
})

export const ListCustomFieldDefinitionsSchema = z.object({
  entityType: z.enum(CUSTOM_FIELD_ENTITY_TYPES).optional(),
  activeOnly: z.boolean().optional(),
}).optional()

export type CreateCustomFieldDefinitionPayload = z.infer<typeof CreateCustomFieldDefinitionSchema>
export type UpdateCustomFieldDefinitionPayload = z.infer<typeof UpdateCustomFieldDefinitionSchema>

// Shared fragment every one of the 5 supported entities' own create/update
// schemas spreads in — a plain {fieldId: value} object, serialized to the
// entity's `customFields` JSON-string column by custom-field.service.ts's
// serializeCustomFieldValues(). Optional everywhere: omitting it (the
// overwhelming majority of records, on any install that hasn't opted into
// this feature) leaves the column untouched.
export const CustomFieldValuesSchema = z.record(z.string(), z.union([z.string(), z.number()])).optional()

