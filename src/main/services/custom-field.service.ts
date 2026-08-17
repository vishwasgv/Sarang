import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import type { CreateCustomFieldDefinitionPayload, UpdateCustomFieldDefinitionPayload } from '../validation/custom-field.validation'

// Phase 66 — Custom Fields. A CustomFieldDefinition describes a field;
// values live on the entity's own `customFields` JSON-string column (see
// schema.prisma's own comment on Expense.customFields for the storage
// convention this mirrors). Every install starts with zero definitions, so
// the inline value editor on Invoice/Customer/Supplier/Product/Expense forms
// only appears once at least one definition exists for that entity type —
// same "zero footprint until opted in" precedent as CostCentre (Phase 65).
export const customFieldService = {
  async listDefinitions(filters?: { entityType?: string; activeOnly?: boolean }) {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.entityType) where.entityType = filters.entityType
    if (filters?.activeOnly) where.isActive = true
    const rows = await db.customFieldDefinition.findMany({ where, orderBy: [{ entityType: 'asc' }, { displayOrder: 'asc' }, { createdAt: 'asc' }] })
    return { success: true, data: rows.map(serializeDefinition) }
  },

  async createDefinition(payload: CreateCustomFieldDefinitionPayload, userId?: string) {
    const db = getPrisma()
    const created = await db.customFieldDefinition.create({
      data: {
        entityType: payload.entityType,
        fieldName: payload.fieldName.trim(),
        fieldType: payload.fieldType,
        selectOptions: payload.selectOptions ? JSON.stringify(payload.selectOptions) : null,
        displayOrder: payload.displayOrder ?? 0,
      }
    })
    await logAction({ userId, action: 'CUSTOM_FIELD_DEFINITION_CREATE', entityType: 'CustomFieldDefinition', entityId: created.id, newValue: created })
    return { success: true, data: serializeDefinition(created) }
  },

  async updateDefinition(payload: UpdateCustomFieldDefinitionPayload, userId?: string) {
    const db = getPrisma()
    const existing = await db.customFieldDefinition.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'CF-001', message: 'Custom field not found.' } }
    const data: Record<string, unknown> = {}
    if (payload.fieldName !== undefined) data.fieldName = payload.fieldName.trim()
    if (payload.selectOptions !== undefined) data.selectOptions = JSON.stringify(payload.selectOptions)
    if (payload.isActive !== undefined) data.isActive = payload.isActive
    if (payload.displayOrder !== undefined) data.displayOrder = payload.displayOrder
    const updated = await db.customFieldDefinition.update({ where: { id: payload.id }, data })
    await logAction({ userId, action: 'CUSTOM_FIELD_DEFINITION_UPDATE', entityType: 'CustomFieldDefinition', entityId: payload.id, oldValue: existing, newValue: updated })
    return { success: true, data: serializeDefinition(updated) }
  }
}

function serializeDefinition(row: { selectOptions: string | null; [k: string]: unknown }) {
  let selectOptions: string[] | null = null
  if (row.selectOptions) {
    try { selectOptions = JSON.parse(row.selectOptions) } catch { selectOptions = null }
  }
  return { ...row, selectOptions }
}

// Shared helper every entity service (customer/supplier/product/expense/
// billing) uses to turn a plain {fieldId: value} object into the JSON-string
// blob stored on that entity's own `customFields` column — one place this
// serialization rule lives, not five slightly-different copies.
export function serializeCustomFieldValues(values: Record<string, string | number> | undefined | null): string | null {
  if (!values || Object.keys(values).length === 0) return null
  return JSON.stringify(values)
}

export function parseCustomFieldValues(raw: string | null | undefined): Record<string, string | number> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}
