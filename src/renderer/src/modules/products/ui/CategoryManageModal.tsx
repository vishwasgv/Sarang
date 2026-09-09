import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Edit2, Archive, Check, X, FolderOpen } from 'lucide-react'
import { Modal } from '@shared/ui/molecules/Modal'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { Card } from '@shared/ui/molecules/Card'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { cn } from '@shared/utils/cn'

interface Category {
  id: string
  name: string
  description?: string | null
  _count?: { products: number }
}

interface CategoryManageModalProps {
  open: boolean
  onClose: () => void
}

export function CategoryManageModal({ open, onClose }: CategoryManageModalProps) {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [addName, setAddName] = useState('')
  const [addDesc, setAddDesc] = useState('')
  const [adding, setAdding] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [saving, setSaving] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<Category | null>(null)
  const [archiving, setArchiving] = useState(false)

  const canCreate = hasPermission('products.create')
  const canUpdate = hasPermission('products.update')
  const canArchive = hasPermission('products.archive')

  async function loadCategories() {
    setLoading(true)
    try {
      const res = await window.api.categories.list()
      if (res.success) setCategories(res.data as Category[])
      else toastError(t('common.error'), res.error?.message ?? t('products.loadCategoriesFailed'))
    } catch {
      toastError(t('common.error'), t('products.loadCategoriesFailed'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) loadCategories()
  }, [open])

  async function handleAdd() {
    if (!addName.trim()) return
    setAdding(true)
    try {
      const res = await window.api.categories.create({ name: addName.trim(), description: addDesc.trim() || undefined })
      if (res.success) {
        toastSuccess(t('products.categoryAddedTitle'), t('products.categoryCreatedMessage', { name: addName.trim() }))
        setAddName('')
        setAddDesc('')
        setShowAddForm(false)
        loadCategories()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('products.addCategoryFailed'))
      }
    } catch {
      toastError(t('common.error'), t('products.addCategoryFailed'))
    } finally {
      setAdding(false)
    }
  }

  function startEdit(cat: Category) {
    setEditId(cat.id)
    setEditName(cat.name)
    setEditDesc(cat.description ?? '')
  }

  function cancelEdit() {
    setEditId(null)
    setEditName('')
    setEditDesc('')
  }

  async function handleSaveEdit(cat: Category) {
    if (!editName.trim()) return
    setSaving(true)
    try {
      const res = await window.api.categories.update({ id: cat.id, name: editName.trim(), description: editDesc.trim() || undefined })
      if (res.success) {
        toastSuccess(t('products.categoryUpdatedTitle'), t('products.categorySavedMessage', { name: editName.trim() }))
        cancelEdit()
        loadCategories()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('products.updateCategoryFailed'))
      }
    } catch {
      toastError(t('common.error'), t('products.updateCategoryFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleArchive() {
    if (!archiveTarget) return
    setArchiving(true)
    try {
      const res = await window.api.categories.archive(archiveTarget.id)
      if (res.success) {
        toastSuccess(t('products.categoryArchivedTitle'), t('products.categoryArchivedMessage', { name: archiveTarget.name }))
        setArchiveTarget(null)
        loadCategories()
      } else {
        toastError(t('products.cannotArchiveTitle'), res.error?.message ?? t('products.archiveCategoryFailed'))
      }
    } catch {
      toastError(t('products.cannotArchiveTitle'), t('products.archiveCategoryFailed'))
    } finally {
      setArchiving(false)
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={t('products.manageCategoriesTitle')}
        size="md"
        footer={
          <div className="flex items-center justify-between w-full">
            {canCreate && !showAddForm && (
              <Button size="sm" onClick={() => setShowAddForm(true)}>
                <Plus size={14} className="me-1.5" /> {t('products.newCategory')}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onClose} className="ms-auto">{t('common.done')}</Button>
          </div>
        }
      >
        <div className="space-y-3">
          {/* Add new form */}
          {showAddForm && (
            <div className="p-3 bg-brand/5 border border-brand/20 rounded-lg space-y-2">
              <p className="text-xs font-semibold text-brand">{t('products.newCategory')}</p>
              <Input
                placeholder={t('products.categoryNamePlaceholder')}
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setShowAddForm(false) }}
              />
              <Input
                placeholder={t('products.categoryDescPlaceholder')}
                value={addDesc}
                onChange={(e) => setAddDesc(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd} loading={adding} disabled={!addName.trim()}>{t('common.add')}</Button>
                <Button variant="secondary" size="sm" onClick={() => { setShowAddForm(false); setAddName(''); setAddDesc('') }}>{t('common.cancel')}</Button>
              </div>
            </div>
          )}

          {/* Category list */}
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
            ))
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FolderOpen size={32} className="text-slate-200 mb-3" />
              <p className="text-sm text-slate-400">{t('products.noCategoriesYet')}</p>
            </div>
          ) : (
            categories.map((cat) => (
              <Card key={cat.id} padding="sm" hoverable className="flex items-center gap-3">
                {editId === cat.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      className="flex-1 h-8 px-2 text-sm rounded border border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(cat); if (e.key === 'Escape') cancelEdit() }}
                    />
                    <button onClick={() => handleSaveEdit(cat)} disabled={saving || !editName.trim()}
                      className="p-1.5 rounded text-success hover:bg-success/10 disabled:opacity-40 transition-colors" title={t('common.save')}>
                      <Check size={14} />
                    </button>
                    <button onClick={cancelEdit} className="p-1.5 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" title={t('common.cancel')}>
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-dark dark:text-slate-100 truncate">{cat.name}</p>
                      {cat.description && <p className="text-xs text-slate-400 truncate">{cat.description}</p>}
                    </div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full shrink-0', (cat._count?.products ?? 0) > 0 ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' : 'bg-slate-50 dark:bg-slate-800 text-slate-300')}>
                      {t('products.productsCount', { count: cat._count?.products ?? 0 })}
                    </span>
                    {canUpdate && (
                      <button onClick={() => startEdit(cat)} className="p-1.5 rounded text-slate-400 hover:text-brand hover:bg-brand/10 transition-colors shrink-0" title={t('common.edit')}>
                        <Edit2 size={13} />
                      </button>
                    )}
                    {canArchive && (
                      <button onClick={() => setArchiveTarget(cat)} className="p-1.5 rounded text-slate-400 hover:text-danger hover:bg-danger/10 transition-colors shrink-0" title={t('common.archive')}>
                        <Archive size={13} />
                      </button>
                    )}
                  </>
                )}
              </Card>
            ))
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
        loading={archiving}
        title={t('products.archiveCategoryTitle')}
        message={t('products.archiveCategoryMessage', { name: archiveTarget?.name })}
        confirmLabel={t('common.archive')}
      />
    </>
  )
}
