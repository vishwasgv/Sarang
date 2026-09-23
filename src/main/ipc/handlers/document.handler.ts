import { dialog, shell, BrowserWindow, app } from 'electron'
import { writeFile, unlink, copyFile } from 'fs/promises'
import { join, basename } from 'path'
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
    const deny = await requirePermission('documents.manage'); if (deny) return deny
    const parsed = AttachDocumentSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return documentService.attachDocument(parsed.data, getCurrentSession()?.userId)
  })

  handle('documents:list', async (payload) => {
    const deny = await requirePermission('documents.view'); if (deny) return deny
    const { entityType, entityId } = payload as { entityType: documentService.DocumentEntityType; entityId: string }
    if (!entityType || !entityId) return { success: false, error: { code: 'VAL-001', message: 'entityType and entityId are required.' } }
    return documentService.listDocuments(entityType, entityId)
  })

  handle('documents:delete', async (payload) => {
    const deny = await requirePermission('documents.manage'); if (deny) return deny
    const parsed = DeleteDocumentSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid payload.' } }
    return documentService.deleteDocument(parsed.data.id, getCurrentSession()?.userId)
  })

  handle('documents:listAll', async (payload) => {
    const deny = await requirePermission('documents.view'); if (deny) return deny
    const p = (payload ?? {}) as { entityType?: documentService.DocumentEntityType; limit?: number }
    return documentService.listAllDocuments(p)
  })

  handle('documents:open', async (payload) => {
    const deny = await requirePermission('documents.view'); if (deny) return deny
    const { id } = payload as { id: string }
    if (!id) return { success: false, error: { code: 'VAL-001', message: 'id is required.' } }
    const res = await documentService.getDocumentPath(id)
    if (!res.success || !res.data) return res
    const errMsg = await shell.openPath(res.data.filePath)
    if (errMsg) return { success: false, error: { code: 'DOC-010', message: `Could not open file: ${errMsg}` } }
    return { success: true }
  })

  // Prints an image or PDF document (e.g. a Doctor Pad hand-drawn note)
  // directly, without relying on an external viewer's own print command —
  // same hidden-BrowserWindow + webContents.print() mechanism every other
  // print:* handler in this app already uses.
  //
  // REAL BUG found+fixed 2026-09-23: this used to reject every PDF outright
  // (DOC-011), so a Doctor Pad note with more than one page — already a PDF —
  // had NO in-app print path at all; the doctor's only option was "Open",
  // which hands off to whatever PDF viewer is installed on the machine. A
  // local PDF file renders in a hidden BrowserWindow the same way Electron's
  // own "Displaying a PDF file" guide does it — `plugins: true` is required
  // for that built-in viewer to activate for a `file://` PDF navigation
  // rather than triggering a download; it's scoped to just this short-lived,
  // hidden, non-interactive print window, not enabled anywhere else.
  handle('documents:print', async (payload) => {
    const deny = await requirePermission('documents.view'); if (deny) return deny
    const { id } = payload as { id: string }
    if (!id) return { success: false, error: { code: 'VAL-001', message: 'id is required.' } }
    const res = await documentService.getDocumentPath(id)
    if (!res.success || !res.data) return res
    const isImage = res.data.mimeType.startsWith('image/')
    const isPdf = res.data.mimeType === 'application/pdf'
    if (!isImage && !isPdf) {
      return { success: false, error: { code: 'DOC-011', message: 'Only image or PDF documents can be printed directly — open the file instead.' } }
    }

    const { pathToFileURL } = await import('url')
    let tmpPath: string | null = null
    let loadUrl: string
    if (isPdf) {
      loadUrl = pathToFileURL(res.data.filePath).href
    } else {
      const imgSrc = pathToFileURL(res.data.filePath).href
      const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0;display:flex;align-items:center;justify-content:center}img{max-width:100%;max-height:100vh}</style></head><body><img src="${imgSrc}"></body></html>`
      tmpPath = join(app.getPath('temp'), `sarang_doc_print_${Date.now()}.html`)
      await writeFile(tmpPath, html, 'utf-8')
      loadUrl = pathToFileURL(tmpPath).href
    }

    return new Promise<{ success: boolean; data?: unknown; error?: { code: string; message: string } }>((resolve) => {
      const win = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true, sandbox: true, plugins: isPdf } })
      win.loadURL(loadUrl)
      win.webContents.once('did-finish-load', () => {
        win.webContents.print({ silent: false, printBackground: true }, (success: boolean) => {
          win.close()
          if (tmpPath) unlink(tmpPath).catch(() => {})
          resolve({ success, data: { printed: success } })
        })
      })
    })
  })

  // Copies an already-attached document (e.g. a Doctor Pad prescription PDF)
  // to a location the owner picks, so the Share widget (see ShareMenu.tsx)
  // can reveal-in-folder + open a wa.me/mailto link the same way it already
  // does for every generated report/invoice PDF — those regenerate their PDF
  // fresh from HTML each time; a Doctor Pad note is a stored drawing that
  // can't be regenerated, so this just re-exports the existing file instead.
  // Same `{cancelled, filePath}` shape ExportPdfResult expects either way.
  handle('documents:exportForShare', async (payload) => {
    const deny = await requirePermission('documents.view'); if (deny) return deny
    const { id } = payload as { id: string }
    if (!id) return { success: false, error: { code: 'VAL-001', message: 'id is required.' } }
    const res = await documentService.getDocumentPath(id)
    if (!res.success || !res.data) return res

    const { filePath: destPath } = await dialog.showSaveDialog({
      title: 'Save Document',
      defaultPath: basename(res.data.filePath),
    })
    if (!destPath) return { success: true, data: { cancelled: true } }

    try {
      await copyFile(res.data.filePath, destPath)
      return { success: true, data: { cancelled: false, filePath: destPath } }
    } catch (err) {
      return { success: false, error: { code: 'DOC-012', message: err instanceof Error ? err.message : 'Could not export the document.' } }
    }
  })
}
