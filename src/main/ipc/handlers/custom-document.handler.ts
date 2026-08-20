import { customDocumentService } from '../../services/custom-document.service'
import {
  CreateCustomDocumentTypeSchema, UpdateCustomDocumentTypeSchema,
  CreateCustomDocumentEntrySchema, UpdateCustomDocumentEntrySchema
} from '../../validation/custom-document.validation'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('customDocuments:listTypes', async (payload) => {
    const deny = await requirePermission('customDocuments.view'); if (deny) return deny
    return customDocumentService.listTypes(payload as { activeOnly?: boolean } | undefined)
  })

  handle('customDocuments:createType', async (payload) => {
    const deny = await requirePermission('customDocuments.manage'); if (deny) return deny
    const parsed = CreateCustomDocumentTypeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    return customDocumentService.createType(parsed.data, getCurrentSession()?.userId)
  })

  handle('customDocuments:updateType', async (payload) => {
    const deny = await requirePermission('customDocuments.manage'); if (deny) return deny
    const parsed = UpdateCustomDocumentTypeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    return customDocumentService.updateType(parsed.data, getCurrentSession()?.userId)
  })

  handle('customDocuments:listEntries', async (documentTypeId) => {
    const deny = await requirePermission('customDocuments.view'); if (deny) return deny
    if (typeof documentTypeId !== 'string' || !documentTypeId.trim()) {
      return { success: false, error: { code: 'VAL-001', message: 'Invalid custom document type ID.' } }
    }
    return customDocumentService.listEntries(documentTypeId)
  })

  handle('customDocuments:createEntry', async (payload) => {
    const deny = await requirePermission('customDocuments.manage'); if (deny) return deny
    const parsed = CreateCustomDocumentEntrySchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    return customDocumentService.createEntry(parsed.data, getCurrentSession()?.userId)
  })

  handle('customDocuments:updateEntry', async (payload) => {
    const deny = await requirePermission('customDocuments.manage'); if (deny) return deny
    const parsed = UpdateCustomDocumentEntrySchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.issues[0]?.message ?? 'Invalid payload' } }
    return customDocumentService.updateEntry(parsed.data, getCurrentSession()?.userId)
  })

  handle('customDocuments:deleteEntry', async (id) => {
    const deny = await requirePermission('customDocuments.manage'); if (deny) return deny
    if (typeof id !== 'string' || !id.trim()) {
      return { success: false, error: { code: 'VAL-001', message: 'Invalid custom document entry ID.' } }
    }
    return customDocumentService.deleteEntry(id, getCurrentSession()?.userId)
  })
}
