import { requirePermission } from '../permission-guard'
import {
  listChecklistItems, addChecklistItem, seedStandardChecklist,
  updateChecklistItem, removeChecklistItem,
  getClientsWithStalePendingDocuments, sendChecklistChaseReminder,
} from '../../services/client-document-checklist.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('clientDocumentChecklist:list', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = raw as { clientId: string }
    if (!payload?.clientId) return { success: false, error: { code: 'VAL-001', message: 'Client is required.' } }
    return listChecklistItems(payload.clientId)
  })

  handle('clientDocumentChecklist:add', async (raw) => {
    const deny = await requirePermission('engagements.manage'); if (deny) return deny
    const payload = raw as { clientId: string; documentType: string; label?: string; notes?: string }
    if (!payload?.clientId || !payload?.documentType) return { success: false, error: { code: 'VAL-001', message: 'Client and document type are required.' } }
    return addChecklistItem(payload)
  })

  handle('clientDocumentChecklist:seedStandard', async (raw) => {
    const deny = await requirePermission('engagements.manage'); if (deny) return deny
    const payload = raw as { clientId: string }
    if (!payload?.clientId) return { success: false, error: { code: 'VAL-001', message: 'Client is required.' } }
    return seedStandardChecklist(payload.clientId)
  })

  handle('clientDocumentChecklist:update', async (raw) => {
    const deny = await requirePermission('engagements.manage'); if (deny) return deny
    const payload = raw as { id: string; status?: string; notes?: string | null }
    if (!payload?.id) return { success: false, error: { code: 'VAL-001', message: 'Checklist item ID is required.' } }
    return updateChecklistItem(payload)
  })

  handle('clientDocumentChecklist:remove', async (raw) => {
    const deny = await requirePermission('engagements.manage'); if (deny) return deny
    const payload = raw as { id: string }
    if (!payload?.id) return { success: false, error: { code: 'VAL-001', message: 'Checklist item ID is required.' } }
    return removeChecklistItem(payload.id)
  })

  // Phase 68 §9.1 — CA Firm item 3: document-checklist auto-chase.
  handle('clientDocumentChecklist:stale', async (raw) => {
    const deny = await requirePermission('billing.view'); if (deny) return deny
    const payload = (raw ?? {}) as { staleDays?: number }
    return getClientsWithStalePendingDocuments(payload.staleDays)
  })

  handle('clientDocumentChecklist:chase', async (raw) => {
    const deny = await requirePermission('engagements.manage'); if (deny) return deny
    const payload = raw as { clientId: string }
    if (!payload?.clientId) return { success: false, error: { code: 'VAL-001', message: 'Client is required.' } }
    return sendChecklistChaseReminder(payload.clientId)
  })
}
