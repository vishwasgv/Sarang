import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Edit2, Archive, Check, X, FolderOpen } from 'lucide-react'
import { Modal } from '@shared/ui/molecules/Modal'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { Card } from '@shared/ui/molecules/Card'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { cn } from '@shared/utils/cn'

interface Category {
  id: string
  name: string
  description?: string | null
  parentCategoryId?: string | null
  _count?: { products: number }
}

interface CategoryRow extends Category {
  depth: number
}

// Flattens the parent/child tree (ProductCategory.parentCategoryId — always
// supported by the schema/service layer, just never surfaced in this UI
// before 2026-09-22) into a depth-first, indentable list. Orphaned rows
// (parent got archived/deleted without cascading) fall back to depth 0
// instead of vanishing.
function buildCategoryTree(categories: Category[]): CategoryRow[] {
  const byParent = new Map<string, Category[]>()
  for (const cat of categories) {
    const key = cat.parentCategoryId ?? ''
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(cat)
  }
  const ids = new Set(categories.map(c => c.id))
  const rows: CategoryRow[] = []
  const visited = new Set<string>()
  function walk(parentKey: string, depth: number) {
    const children = (byParent.get(parentKey) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name))
    for (const cat of children) {
      if (visited.has(cat.id)) continue // defensive: a cycle should never exist, but never infinite-loop if one does
      visited.add(cat.id)
      rows.push({ ...cat, depth })
      walk(cat.id, depth + 1)
    }
  }
  walk('', 0)
  // Any category whose parentCategoryId points at a now-missing category —
  // still show it, just at depth 0, instead of silently dropping it.
  for (const cat of categories) {
    if (!visited.has(cat.id) && (!cat.parentCategoryId || !ids.has(cat.parentCategoryId))) {
      visited.add(cat.id)
      rows.push({ ...cat, depth: 0 })
    }
  }
  return rows
}

// Every id that is cat itself or one of its descendants — never a valid
// parent choice for cat (would create a cycle the backend doesn't guard
// against beyond the direct self-parent case).
function descendantIds(categories: Category[], catId: string): Set<string> {
  const byParent = new Map<string, string[]>()
  for (const cat of categories) {
    const key = cat.parentCategoryId ?? ''
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(cat.id)
  }
  const result = new Set<string>([catId])
  const stack = [catId]
  while (stack.length) {
    const id = stack.pop()!
    for (const childId of byParent.get(id) ?? []) {
      if (!result.has(childId)) { result.add(childId); stack.push(childId) }
    }
  }
  return result
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
  const [addParentId, setAddParentId] = useState('')
  const [adding, setAdding] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editParentId, setEditParentId] = useState('')
  const [saving, setSaving] = useState(false)
  const [archiveTarget, setArchiveTarget] = useState<Category | null>(null)
  const [archiving, setArchiving] = useState(false)

  const canCreate = hasPermission('products.create')
  const canUpdate = hasPermission('products.update')
  const canArchive = hasPermission('products.archive')

  const rows = useMemo(() => buildCategoryTree(categories), [categories])

  async function loadCategories() {
    setLoading(true)
    try {
      const res = await window.api.categories.list()
      if (res.success) setCategories(res.data as Category[])
      else toastError(t('common.error'), t('products.loadCategoriesFailed'))
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
      const res = await window.api.categories.create({ name: addName.trim(), description: addDesc.trim() || undefined, parentCategoryId: addParentId || undefined })
      if (res.success) {
        toastSuccess(t('products.categoryAddedTitle'), t('products.categoryCreatedMessage', { name: addName.trim() }))
        setAddName('')
        setAddDesc('')
        setAddParentId('')
        setShowAddForm(false)
        loadCategories()
      } else {
        toastError(t('common.error'), t('products.addCategoryFailed'))
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
    setEditParentId(cat.parentCategoryId ?? '')
  }

  function cancelEdit() {
    setEditId(null)
    setEditName('')
    setEditDesc('')
    setEditParentId('')
  }

  async function handleSaveEdit(cat: Category) {
    if (!editName.trim()) return
    setSaving(true)
    try {
      const res = await window.api.categories.update({ id: cat.id, name: editName.trim(), description: editDesc.trim() || undefined, parentCategoryId: editParentId || null })
      if (res.success) {
        toastSuccess(t('products.categoryUpdatedTitle'), t('products.categorySavedMessage', { name: editName.trim() }))
        cancelEdit()
        loadCategories()
      } else {
        toastError(t('common.error'), t('products.updateCategoryFailed'))
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
        toastError(t('products.cannotArchiveTitle'), t('products.archiveCategoryFailed'))
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
              <Select
                aria-label={t('products.parentCategoryLabel')}
                value={addParentId}
                onChange={(e) => setAddParentId(e.target.value)}
                className="h-9 text-sm"
              >
                <option value="">{t('products.noParentOption')}</option>
                {rows.map(r => <option key={r.id} value={r.id}>{'— '.repeat(r.depth)}{r.name}</option>)}
              </Select>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAdd} loading={adding} disabled={!addName.trim()}>{t('common.add')}</Button>
                <Button variant="secondary" size="sm" onClick={() => { setShowAddForm(false); setAddName(''); setAddDesc(''); setAddParentId('') }}>{t('common.cancel')}</Button>
              </div>
            </div>
          )}

          {/* Category list — depth-first, indented so parent/child relationships
              (e.g. Clothing & Apparel > Sarees, Kurta, Shirts...) are visible
              at a glance instead of appearing as one flat list. */}
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
            rows.map((cat) => (
              <Card key={cat.id} padding="sm" hoverable className="flex items-center gap-3" style={{ marginInlineStart: cat.depth * 20 }}>
                {editId === cat.id ? (
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex items-center gap-2">
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
                    <select
                      aria-label={t('products.parentCategoryLabel')}
                      value={editParentId}
                      onChange={(e) => setEditParentId(e.target.value)}
                      className="h-8 px-2 text-sm rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                    >
                      <option value="">{t('products.noParentOption')}</option>
                      {rows.filter(r => !descendantIds(categories, cat.id).has(r.id)).map(r => (
                        <option key={r.id} value={r.id}>{'— '.repeat(r.depth)}{r.name}</option>
                      ))}
                    </select>
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
