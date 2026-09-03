import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { buildReminderWhatsAppLink } from './notification-queue.service'

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

// Phase 68 §9.1 — CA Firm item 3: document-checklist auto-chase. The
// checklist itself (above) already existed since Phase 58 §2; this closes
// the missing "auto-chase" half — a real worklist of clients whose PENDING
// items have sat unactioned past a real threshold, plus a one-tap WhatsApp
// nudge listing exactly what's still outstanding for that client.
const CHASE_STALE_DAYS = 7

export interface StaleChecklistClient {
  clientId: string; clientName: string; phone: string | null
  pendingLabels: string[]; oldestPendingDays: number
}

export async function getClientsWithStalePendingDocuments(staleDays = CHASE_STALE_DAYS) {
  try {
    const db = getPrisma()
    const cutoff = new Date(Date.now() - staleDays * 86400000)
    const items = await db.clientDocumentChecklistItem.findMany({
      where: { status: 'PENDING', createdAt: { lte: cutoff } },
      include: { client: { select: { id: true, customerName: true, phone: true } } },
      orderBy: { createdAt: 'asc' },
    })

    const byClient = new Map<string, StaleChecklistClient>()
    const now = Date.now()
    for (const item of items) {
      const label = item.label?.trim() || item.documentType
      const daysOld = Math.floor((now - item.createdAt.getTime()) / 86400000)
      const existing = byClient.get(item.clientId) ?? {
        clientId: item.clientId, clientName: item.client.customerName, phone: item.client.phone,
        pendingLabels: [], oldestPendingDays: 0,
      }
      existing.pendingLabels.push(label)
      existing.oldestPendingDays = Math.max(existing.oldestPendingDays, daysOld)
      byClient.set(item.clientId, existing)
    }

    const rows = Array.from(byClient.values()).sort((a, b) => b.oldestPendingDays - a.oldestPendingDays)
    return { success: true, data: rows }
  } catch (err) {
    return { success: false, error: { code: 'CDC-008', message: err instanceof Error ? err.message : 'Could not load stale checklist clients.' } }
  }
}

export async function sendChecklistChaseReminder(clientId: string) {
  try {
    const db = getPrisma()
    const [client, pendingItems] = await Promise.all([
      db.customer.findUnique({ where: { id: clientId }, select: { customerName: true, phone: true } }),
      db.clientDocumentChecklistItem.findMany({ where: { clientId, status: 'PENDING' }, select: { documentType: true, label: true } }),
    ])
    if (!client) return { success: false, error: { code: 'CDC-009', message: 'Client not found.' } }
    if (pendingItems.length === 0) return { success: false, error: { code: 'CDC-010', message: 'This client has no pending documents to chase.' } }
    if (!client.phone) return { success: true, data: null }

    const labels = pendingItems.map((i) => i.label?.trim() || i.documentType).join(', ')
    const message = `Dear ${client.customerName}, we're still awaiting the following document(s) from you: ${labels}. Please share them at your earliest convenience so we can proceed. Powered by Sarang | www.aszurex.com`
    const link = await buildReminderWhatsAppLink(client.phone, message)
    return { success: true, data: { whatsappLink: link, pendingCount: pendingItems.length } }
  } catch (err) {
    return { success: false, error: { code: 'CDC-011', message: err instanceof Error ? err.message : 'Could not build chase reminder.' } }
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
