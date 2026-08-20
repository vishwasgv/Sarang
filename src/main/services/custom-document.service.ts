import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { serializeCustomFieldValues, parseCustomFieldValues } from './custom-field.service'
import type {
  CreateCustomDocumentTypePayload, UpdateCustomDocumentTypePayload,
  CreateCustomDocumentEntryPayload, UpdateCustomDocumentEntryPayload
} from '../validation/custom-document.validation'

// Phase 67 §9.1 — General item 2: Custom Document Builder. See
// schema.prisma's own comment on CustomDocumentType for why field
// definitions deliberately reuse CustomFieldDefinition (Phase 66) via a
// namespaced entityType key rather than a parallel field-schema mechanism.
export function customDocumentEntityType(documentTypeId: string): string {
  return `CUSTOM_DOCUMENT:${documentTypeId}`
}

export const customDocumentService = {
  async listTypes(filters?: { activeOnly?: boolean }) {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.activeOnly) where.isActive = true
    const rows = await db.customDocumentType.findMany({ where, orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] })
    return { success: true, data: rows }
  },

  async createType(payload: CreateCustomDocumentTypePayload, userId?: string) {
    const db = getPrisma()
    const created = await db.customDocumentType.create({
      data: {
        name: payload.name.trim(),
        description: payload.description?.trim() || null,
        displayOrder: payload.displayOrder ?? 0,
      }
    })
    await logAction({ userId, action: 'CUSTOM_DOCUMENT_TYPE_CREATE', entityType: 'CustomDocumentType', entityId: created.id, newValue: created })
    return { success: true, data: created }
  },

  async updateType(payload: UpdateCustomDocumentTypePayload, userId?: string) {
    const db = getPrisma()
    const existing = await db.customDocumentType.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'CD-001', message: 'Custom document type not found.' } }
    const data: Record<string, unknown> = {}
    if (payload.name !== undefined) data.name = payload.name.trim()
    if (payload.description !== undefined) data.description = payload.description?.trim() || null
    if (payload.isActive !== undefined) data.isActive = payload.isActive
    if (payload.displayOrder !== undefined) data.displayOrder = payload.displayOrder
    const updated = await db.customDocumentType.update({ where: { id: payload.id }, data })
    await logAction({ userId, action: 'CUSTOM_DOCUMENT_TYPE_UPDATE', entityType: 'CustomDocumentType', entityId: payload.id, oldValue: existing, newValue: updated })
    return { success: true, data: updated }
  },

  async listEntries(documentTypeId: string) {
    const db = getPrisma()
    const rows = await db.customDocumentEntry.findMany({ where: { documentTypeId }, orderBy: { entryDate: 'desc' } })
    return { success: true, data: rows.map(serializeEntry) }
  },

  async createEntry(payload: CreateCustomDocumentEntryPayload, userId?: string) {
    const db = getPrisma()
    const docType = await db.customDocumentType.findUnique({ where: { id: payload.documentTypeId } })
    if (!docType) return { success: false, error: { code: 'CD-001', message: 'Custom document type not found.' } }
    const created = await db.customDocumentEntry.create({
      data: {
        documentTypeId: payload.documentTypeId,
        entryDate: payload.entryDate ? new Date(payload.entryDate) : new Date(),
        notes: payload.notes?.trim() || null,
        customFields: serializeCustomFieldValues(payload.customFields),
      }
    })
    await logAction({ userId, action: 'CUSTOM_DOCUMENT_ENTRY_CREATE', entityType: 'CustomDocumentEntry', entityId: created.id, newValue: created })
    return { success: true, data: serializeEntry(created) }
  },

  async updateEntry(payload: UpdateCustomDocumentEntryPayload, userId?: string) {
    const db = getPrisma()
    const existing = await db.customDocumentEntry.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'CD-002', message: 'Custom document entry not found.' } }
    const data: Record<string, unknown> = {}
    if (payload.entryDate !== undefined) data.entryDate = new Date(payload.entryDate)
    if (payload.notes !== undefined) data.notes = payload.notes?.trim() || null
    if (payload.customFields !== undefined) data.customFields = serializeCustomFieldValues(payload.customFields)
    const updated = await db.customDocumentEntry.update({ where: { id: payload.id }, data })
    await logAction({ userId, action: 'CUSTOM_DOCUMENT_ENTRY_UPDATE', entityType: 'CustomDocumentEntry', entityId: payload.id, oldValue: existing, newValue: updated })
    return { success: true, data: serializeEntry(updated) }
  },

  async deleteEntry(id: string, userId?: string) {
    const db = getPrisma()
    const existing = await db.customDocumentEntry.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'CD-002', message: 'Custom document entry not found.' } }
    await db.customDocumentEntry.delete({ where: { id } })
    await logAction({ userId, action: 'CUSTOM_DOCUMENT_ENTRY_DELETE', entityType: 'CustomDocumentEntry', entityId: id, oldValue: existing })
    return { success: true }
  }
}

function serializeEntry(row: { customFields: string | null; [k: string]: unknown }) {
  return { ...row, customFields: parseCustomFieldValues(row.customFields) }
}
