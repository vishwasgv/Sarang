import { dialog, shell } from 'electron'
import * as documentService from '../../services/document.service'
import { requirePermission } from '../permission-guard'
import { getCurrentSession } from '../../services/auth.service'
import { AttachDocumentSchema, DeleteDocumentSchema } from '../../validation/document.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

export function register(handle: HandleFn): void {
  handle('documents:pick', async (payload) => {
    const opts = (payload ?? {}) as { title?: string }
    const result = await dialog.showOpenDialog({
      title: opts.title ?? 'Attach Document',
      properties: ['openFile'],
      filters: [
        { name: 'Documents', extensions: ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'xlsx', 'xls', 'docx', 'doc', 'txt', 'csv'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePaths[0]) return { success: true, data: null }
    return { success: true, data: { filePath: result.filePaths[0] } }
  })

  handle('documents:attach', async (payload) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const parsed = AttachDocumentSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return documentService.attachDocument(parsed.data, getCurrentSession()?.userId)
  })

  handle('documents:list', async (payload) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const { entityType, entityId } = payload as { entityType: documentService.DocumentEntityType; entityId: string }
    if (!entityType || !entityId) return { success: false, error: { code: 'VAL-001', message: 'entityType and entityId are required.' } }
    return documentService.listDocuments(entityType, entityId)
  })

  handle('documents:delete', async (payload) => {
    const deny = await requirePermission('settings.modify'); if (deny) return deny
    const parsed = DeleteDocumentSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return documentService.deleteDocument(parsed.data.id, getCurrentSession()?.userId)
  })

  handle('documents:listAll', async (payload) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const p = (payload ?? {}) as { entityType?: documentService.DocumentEntityType; limit?: number }
    return documentService.listAllDocuments(p)
  })

  handle('documents:open', async (payload) => {
    const deny = await requirePermission('settings.view'); if (deny) return deny
    const { id } = payload as { id: string }
    if (!id) return { success: false, error: { code: 'VAL-001', message: 'id is required.' } }
    const res = await documentService.getDocumentPath(id)
    if (!res.success || !res.data) return res
    const errMsg = await shell.openPath(res.data.filePath)
    if (errMsg) return { success: false, error: { code: 'DOC-010', message: `Could not open file: ${errMsg}` } }
    return { success: true }
  })
}
