import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Paperclip, Trash2, ExternalLink, FileText, Image, FileSpreadsheet, RefreshCw } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { formatDate } from '@shared/utils/locale.util'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'

interface DocRecord {
  id: string
  fileName: string
  mimeType: string
  fileSizeBytes: number
  entityType: string
  entityId: string
  notes: string | null
  createdAt: string
}

// DocumentEntityType is a closed 6-value union (document.service.ts) — every
// value is mapped to a distinct Badge variant below, no fallback needed for
// a real value.
const ENTITY_VARIANT: Record<string, 'brand' | 'info' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  INVOICE: 'brand',
  PURCHASE_ORDER: 'info',
  CUSTOMER: 'success',
  SUPPLIER: 'warning',
  EXPENSE: 'danger',
  PRODUCTION_ORDER: 'neutral',
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <Image size={15} className="text-purple-400 shrink-0" />
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return <FileSpreadsheet size={15} className="text-green-500 shrink-0" />
  if (mimeType === 'application/pdf') return <FileText size={15} className="text-red-400 shrink-0" />
  return <FileText size={15} className="text-slate-400 shrink-0" />
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const fmtDate = formatDate

export function DocumentsScreen() {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const [docs, setDocs] = useState<DocRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('ALL')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<DocRecord | null>(null)
  const [error, setError] = useState<string | null>(null)

  const ENTITY_LABELS: Record<string, string> = {
    INVOICE: t('documents.entityInvoice'),
    PURCHASE_ORDER: t('documents.entityPurchaseOrder'),
    CUSTOMER: t('documents.entityCustomer'),
    SUPPLIER: t('documents.entitySupplier'),
    EXPENSE: t('documents.entityExpense'),
    PRODUCTION_ORDER: t('documents.entityProductionOrder'),
  }

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.documents.listAll({ limit: 500 })
      if (res.success && res.data) {
        setDocs(res.data as DocRecord[])
      } else {
        const msg = (res.error as { message?: string })?.message ?? t('documents.couldNotLoad')
        setError(msg)
        toastError(t('common.error'), msg)
      }
    } catch {
      setError(t('documents.couldNotLoad'))
      toastError(t('common.error'), t('documents.couldNotLoad'))
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
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
        toastError(t('common.error'), msg)
      }
    } catch {
      setError('Could not delete document.')
      toastError(t('common.error'), 'Could not delete document.')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleOpen(id: string) {
    try {
      const res = await api.documents.open({ id })
      if (!res.success) {
        const msg = (res.error as { message?: string })?.message ?? t('documents.couldNotOpen')
        setError(msg)
        toastError(t('common.error'), msg)
      }
    } catch {
      setError(t('documents.couldNotOpen'))
      toastError(t('common.error'), t('documents.couldNotOpen'))
    }
  }

  const filtered = docs.filter(d => {
    const matchType = filterType === 'ALL' || d.entityType === filterType
    const matchSearch = !search.trim() || d.fileName.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('documents.title')}</h2>
        <p className="text-sm text-slate-400">{docs.length} {t('documents.filesAttached')}</p>
      </div>

      {error && (
        <div className="bg-danger/5 border border-danger/20 rounded-xl px-4 py-3 text-sm text-danger">{error}</div>
      )}

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('documents.searchPlaceholder')}
          className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand bg-white dark:bg-slate-900"
        />
        <Select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
        >
          <option value="ALL">{t('documents.allTypes')}</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
        <button onClick={load} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 transition-colors">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <RefreshCw size={20} className="animate-spin text-brand" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
          <Paperclip size={28} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('documents.noDocumentsFound')}</p>
          <p className="text-xs text-slate-400 mt-1">{t('documents.noDocumentsHint')}</p>
        </div>
      ) : (
        <Card padding="none" className="divide-y divide-slate-100 overflow-hidden">
          {filtered.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 px-4 py-3 group hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              {fileIcon(doc.mimeType)}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-dark dark:text-slate-100 truncate">{doc.fileName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant={ENTITY_VARIANT[doc.entityType] ?? 'neutral'} size="sm">
                    {ENTITY_LABELS[doc.entityType] ?? doc.entityType}
                  </Badge>
                  <span className="text-xs text-slate-400">{fmtSize(doc.fileSizeBytes)}</span>
                  <span className="text-xs text-slate-400">{fmtDate(doc.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleOpen(doc.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-brand hover:bg-brand/5 transition-colors" title={t('documents.open')}>
                  <ExternalLink size={13} />
                </button>
                <button onClick={() => setConfirmDelete(doc)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/5 transition-colors" title={t('documents.delete')}>
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <p className="text-sm font-semibold text-dark dark:text-slate-100">{t('documents.confirmDelete')}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              "<strong>{confirmDelete.fileName}</strong>" {t('documents.confirmDeleteText')}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:border-slate-300 transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={handleDelete} disabled={!!deletingId}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-danger text-white text-sm font-semibold hover:bg-danger/90 transition-colors disabled:opacity-50">
                {deletingId ? <RefreshCw size={12} className="animate-spin" /> : null} {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
