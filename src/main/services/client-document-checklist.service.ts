import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

// Phase 58 §2 — CA Firm client-wise document checklist (PAN/Aadhaar/bank
// statements etc. collected vs. pending). Standalone status tracker, NOT
// linked to the generic Document/DocumentPanel file-attachment system — see
// prisma/schema.prisma's ClientDocumentChecklistItem comment for why.

const STANDARD_DOCUMENT_TYPES = ['PAN', 'AADHAAR', 'BANK_STATEMENT', 'GST_CERTIFICATE']

export async function listChecklistItems(clientId: string) {
  try {
    const db = getPrisma()
    const items = await db.clientDocumentChecklistItem.findMany({
      where: { clientId },
      orderBy: { createdAt: 'asc' },
    })
    return { success: true, data: items }
  } catch (err) {
    return { success: false, error: { code: 'CDC-001', message: err instanceof Error ? err.message : 'Could not list checklist items.' } }
  }
}

export async function addChecklistItem(payload: {
  clientId: string
  documentType: string
  label?: string
  notes?: string
}) {
  try {
    const db = getPrisma()
    const client = await db.customer.findUnique({ where: { id: payload.clientId }, select: { id: true } })
    if (!client) return { success: false, error: { code: 'CDC-002', message: 'Client not found.' } }

    const item = await db.clientDocumentChecklistItem.create({
      data: {
        clientId: payload.clientId,
        documentType: payload.documentType,
        label: payload.label?.trim() || null,
        notes: payload.notes?.trim() || null,
        status: 'PENDING',
      },
    })
    await logAction(undefined, 'CREATE', 'ClientDocumentChecklistItem', item.id, null, { clientId: payload.clientId, documentType: payload.documentType }).catch(() => {})
    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'CDC-003', message: err instanceof Error ? err.message : 'Could not add checklist item.' } }
  }
}

// Seeds the 4 most commonly required documents for a new client in one
// click, skipping any documentType already present — idempotent, safe to
// call repeatedly (e.g. if new standard types are added in a future phase).
export async function seedStandardChecklist(clientId: string) {
  try {
    const db = getPrisma()
    const client = await db.customer.findUnique({ where: { id: clientId }, select: { id: true } })
    if (!client) return { success: false, error: { code: 'CDC-002', message: 'Client not found.' } }

    const existing = await db.clientDocumentChecklistItem.findMany({ where: { clientId }, select: { documentType: true } })
    const existingTypes = new Set(existing.map((e) => e.documentType))
    const toCreate = STANDARD_DOCUMENT_TYPES.filter((t) => !existingTypes.has(t))
    if (toCreate.length === 0) return { success: true, data: { created: 0 } }

    await db.clientDocumentChecklistItem.createMany({
      data: toCreate.map((documentType) => ({ clientId, documentType, status: 'PENDING' })),
    })
    return { success: true, data: { created: toCreate.length } }
  } catch (err) {
    return { success: false, error: { code: 'CDC-004', message: err instanceof Error ? err.message : 'Could not seed checklist.' } }
  }
}

export async function updateChecklistItem(payload: {
  id: string
  status?: string
  notes?: string | null
}) {
  try {
    const db = getPrisma()
    const existing = await db.clientDocumentChecklistItem.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'CDC-005', message: 'Checklist item not found.' } }

    const data: Record<string, unknown> = {}
    if (payload.status !== undefined) {
      data.status = payload.status
      data.collectedDate = payload.status === 'COLLECTED' ? new Date() : null
    }
    if (payload.notes !== undefined) data.notes = payload.notes

    const item = await db.clientDocumentChecklistItem.update({ where: { id: payload.id }, data })
    await logAction(undefined, 'UPDATE', 'ClientDocumentChecklistItem', item.id, existing, item).catch(() => {})
    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'CDC-006', message: err instanceof Error ? err.message : 'Could not update checklist item.' } }
  }
}

export async function removeChecklistItem(id: string) {
  try {
    const db = getPrisma()
    await db.clientDocumentChecklistItem.delete({ where: { id } })
    await logAction(undefined, 'DELETE', 'ClientDocumentChecklistItem', id, null, null).catch(() => {})
    return { success: true, data: { id } }
  } catch (err) {
    return { success: false, error: { code: 'CDC-007', message: err instanceof Error ? err.message : 'Could not remove checklist item.' } }
  }
}
