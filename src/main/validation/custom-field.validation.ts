import { z } from 'zod'

export const CUSTOM_FIELD_ENTITY_TYPES = ['INVOICE', 'CUSTOMER', 'SUPPLIER', 'PRODUCT', 'EXPENSE'] as const
export const CUSTOM_FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'SELECT'] as const

// Phase 67 §9.1 — General item 2: a CustomDocumentType's own field schema
// reuses this exact table, keyed by a namespaced entityType value instead
// of one of the 5 fixed built-in literals — widened from a strict enum to
// a union so a typo'd built-in literal is still caught (unlike a fully
// free-form string), while the new pattern is still precisely validated
// (a real cuid, not arbitrary text).
export const CUSTOM_DOCUMENT_ENTITY_TYPE_PATTERN = /^CUSTOM_DOCUMENT:[a-z0-9]{20,30}$/
const EntityTypeSchema = z.union([
  z.enum(CUSTOM_FIELD_ENTITY_TYPES),
  z.string().regex(CUSTOM_DOCUMENT_ENTITY_TYPE_PATTERN, 'Invalid entity type.')
])

export const CreateCustomFieldDefinitionSchema = z.object({
  entityType: EntityTypeSchema,
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
  entityType: EntityTypeSchema.optional(),
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

