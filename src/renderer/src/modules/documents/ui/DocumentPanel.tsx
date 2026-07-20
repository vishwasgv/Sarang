import React, { useEffect, useState } from 'react'
import { Paperclip, Trash2, ExternalLink, FileText, Image, FileSpreadsheet, RefreshCw, UploadCloud } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'
import { useNotificationStore } from '@app/store/notification.store'

interface DocRecord {
  id: string
  fileName: string
  mimeType: string
  fileSizeBytes: number
  notes: string | null
  createdAt: string
}

type EntityType = 'INVOICE' | 'PURCHASE_ORDER' | 'CUSTOMER' | 'SUPPLIER' | 'EXPENSE' | 'PRODUCTION_ORDER' | 'DRAWING_REVISION' | 'SITE_VISIT'
  | 'LEGAL_CASE' | 'COMPLIANCE_TASK' | 'ENGAGEMENT' | 'ROC_FILING' | 'BOARD_MEETING' | 'VISIT_NOTE' | 'TREATMENT_PLAN' | 'LAB_TEST_ORDER' | 'RENTAL_BOOKING_ITEM'
  | 'APPOINTMENT' | 'CANDIDATE'

function fileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <Image size={14} className="text-purple-400" />
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <FileSpreadsheet size={14} className="text-green-500" />
  if (mimeType === 'application/pdf') return <FileText size={14} className="text-red-400" />
  return <FileText size={14} className="text-slate-400" />
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface Props {
  entityType: EntityType
  entityId: string
  compact?: boolean
}

export function DocumentPanel({ entityType, entityId, compact = false }: Props) {
  const { error: toastError } = useNotificationStore()
  const [docs, setDocs] = useState<DocRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [attaching, setAttaching] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<DocRecord | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (entityId) load() }, [entityId])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.documents.list({ entityType, entityId })
      if (res.success && res.data) {
        setDocs(res.data as DocRecord[])
      } else {
        const msg = (res.error as { message?: string })?.message ?? 'Could not load documents.'
        setError(msg)
        toastError('Error', msg)
      }
    } catch {
      setError('Could not load documents.')
      toastError('Error', 'Could not load documents.')
    } finally {
      setLoading(false)
    }
  }

  async function handleAttach() {
    setError(null)
    try {
      const picked = await api.documents.pick({ title: 'Attach Document' })
      if (!picked.success) {
        const msg = (picked.error as { message?: string })?.message ?? 'Could not open file picker.'
        setError(msg)
        toastError('Error', msg)
        return
      }
      if (!picked.data) return // user cancelled the file dialog — not an error
      const { filePath } = picked.data
      const fileName = filePath.split(/[\\/]/).pop() ?? 'document'
      setAttaching(true)
      const res = await api.documents.attach({ sourcePath: filePath, fileName, entityType, entityId })
      if (res.success) {
        await load()
      } else {
        const msg = (res.error as { message?: string })?.message ?? 'Could not attach file.'
        setError(msg)
        toastError('Error', msg)
      }
    } catch {
      setError('Could not attach file.')
      toastError('Error', 'Could not attach file.')
    } finally {
      setAttaching(false)
    }
  }

  async function handleDeleteConfirmed() {
    if (!confirmDelete) return
    setDeletingId(confirmDelete.id)
    try {
      const res = await api.documents.delete({ id: confirmDelete.id })
      if (res.success) {
        setDocs(prev => prev.filter(d => d.id !== confirmDelete.id))
        setConfirmDelete(null)
      } else {
        const msg = (res.error as { message?: string })?.message ?? 'Could not delete document.'
        setError(msg)
        toastError('Error', msg)
      }
    } catch {
      setError('Could not delete document.')
      toastError('Error', 'Could not delete document.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleOpen(id: string) {
    try {
      const res = await api.documents.open({ id })
      if (!res.success) {
        const msg = (res.error as { message?: string })?.message ?? 'Could not open file.'
        setError(msg)
        toastError('Error', msg)
      }
    } catch {
      setError('Could not open file.')
      toastError('Error', 'Could not open file.')
    }
  }

  return (
    <div className={cn('space-y-3', compact ? '' : 'mt-4')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Paperclip size={13} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Documents {docs.length > 0 && `(${docs.length})`}
          </span>
        </div>
        <button
          onClick={handleAttach}
          disabled={attaching}
          className="flex items-center gap-1.5 text-xs text-brand hover:text-brand/80 font-medium transition-colors disabled:opacity-50"
        >
          {attaching ? <RefreshCw size={11} className="animate-spin" /> : <UploadCloud size={11} />}
          Attach file
        </button>
      </div>

      {error && (
        <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">{error}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-4">
          <RefreshCw size={16} className="animate-spin text-slate-300" />
        </div>
      ) : docs.length === 0 ? (
        <div className="text-center py-5 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          <Paperclip size={20} className="text-slate-300 mx-auto mb-1.5" />
          <p className="text-xs text-slate-400">No documents attached</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {docs.map(doc => (
            <div key={doc.id}
              className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 group hover:border-slate-200 dark:hover:border-slate-700 transition-colors">
              <div className="shrink-0">{fileIcon(doc.mimeType)}</div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-dark dark:text-slate-100 truncate">{doc.fileName}</p>
                <p className="text-xs text-slate-400">{fmtSize(doc.fileSizeBytes)}</p>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleOpen(doc.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-brand hover:bg-brand/5 transition-colors"
                  title="Open file">
                  <ExternalLink size={13} />
                </button>
                <button onClick={() => setConfirmDelete(doc)} disabled={deletingId === doc.id}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/5 transition-colors"
                  title="Remove">
                  {deletingId === doc.id ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <p className="text-sm font-semibold text-dark dark:text-slate-100">Remove document?</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              "<strong>{confirmDelete.fileName}</strong>" will be permanently removed. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:border-slate-300 transition-colors">
                Cancel
              </button>
              <button onClick={handleDeleteConfirmed} disabled={!!deletingId}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-danger text-white text-sm font-semibold hover:bg-danger/90 transition-colors disabled:opacity-50">
                {deletingId ? <RefreshCw size={12} className="animate-spin" /> : null} Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
