import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { FileStack, Plus, RefreshCw, Settings, Trash2, Pencil } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Modal } from '@shared/ui/molecules/Modal'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { CustomFieldsEditor } from '@shared/ui/molecules/CustomFieldsEditor'
import { SkeletonTable } from '@shared/ui/Skeleton'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'
import { formatDate } from '@shared/utils/locale.util'

interface DocumentType { id: string; name: string; description: string | null; isActive: boolean }
interface FieldDefinition { id: string; fieldName: string; fieldType: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT'; selectOptions: string[] | null; isActive: boolean }
interface Entry { id: string; entryDate: string; notes: string | null; customFields: Record<string, string | number> }

const FIELD_TYPES = ['TEXT', 'NUMBER', 'DATE', 'SELECT'] as const

// Phase 67 §9.1 — General item 2: Custom Document Builder. The "field
// builder" half is Phase 66's own CustomFieldDefinition mechanism, reused
// as-is here via a namespaced entityType key (see
// custom-document.service.ts's customDocumentEntityType()) — this screen
// only adds the genuinely new half: letting a business define its own
// document TYPES (e.g. "Visitor Register") and log dated entries against
// each, with whatever fields it defined for that type.
export function CustomDocumentsScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canManage = hasPermission('customDocuments.manage')

  const [types, setTypes] = useState<DocumentType[]>([])
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [fields, setFields] = useState<FieldDefinition[]>([])
  const [loadingTypes, setLoadingTypes] = useState(true)
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [showFieldsPanel, setShowFieldsPanel] = useState(false)

  const [showTypeModal, setShowTypeModal] = useState(false)
  const [typeEditTarget, setTypeEditTarget] = useState<DocumentType | null>(null)
  const [typeForm, setTypeForm] = useState({ name: '', description: '' })
  const [savingType, setSavingType] = useState(false)

  const [showFieldModal, setShowFieldModal] = useState(false)
  const [fieldForm, setFieldForm] = useState({ fieldName: '', fieldType: 'TEXT' as typeof FIELD_TYPES[number], selectOptions: [''] })
  const [savingField, setSavingField] = useState(false)

  const [showEntryModal, setShowEntryModal] = useState(false)
  const [entryEditTarget, setEntryEditTarget] = useState<Entry | null>(null)
  const [entryDate, setEntryDate] = useState('')
  const [entryNotes, setEntryNotes] = useState('')
  const [entryFieldValues, setEntryFieldValues] = useState<Record<string, string | number>>({})
  const [savingEntry, setSavingEntry] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Entry | null>(null)
  const [deleting, setDeleting] = useState(false)

  const selectedType = types.find(dt => dt.id === selectedTypeId) ?? null
  const documentEntityType = selectedTypeId ? (`CUSTOM_DOCUMENT:${selectedTypeId}` as const) : null

  const loadTypes = useCallback(async () => {
    setLoadingTypes(true)
    try {
      const res = await api.customDocuments.listTypes()
      if (res.success) {
        const rows = (res.data as DocumentType[]) ?? []
        setTypes(rows)
        if (!selectedTypeId && rows.length > 0) setSelectedTypeId(rows[0].id)
      } else {
        toastError(t('common.error'), res.error?.message ?? t('customDocuments.couldNotLoad'))
      }
    } catch {
      toastError(t('common.error'), t('customDocuments.couldNotLoad'))
    } finally {
      setLoadingTypes(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toastError, t])

  useEffect(() => { loadTypes() }, [loadTypes])

  const loadEntries = useCallback(async () => {
    if (!selectedTypeId) { setEntries([]); return }
    setLoadingEntries(true)
    try {
      const res = await api.customDocuments.listEntries(selectedTypeId)
      if (res.success) setEntries((res.data as Entry[]) ?? [])
      else toastError(t('common.error'), res.error?.message ?? t('customDocuments.couldNotLoad'))
    } catch {
      toastError(t('common.error'), t('customDocuments.couldNotLoad'))
    } finally {
      setLoadingEntries(false)
    }
  }, [selectedTypeId, toastError, t])

  useEffect(() => { loadEntries() }, [loadEntries])

  const loadFields = useCallback(async () => {
    if (!documentEntityType) { setFields([]); return }
    const res = await api.customFields.list({ entityType: documentEntityType })
    if (res.success) setFields((res.data as FieldDefinition[]) ?? [])
  }, [documentEntityType])

  useEffect(() => { loadFields() }, [loadFields])

  function openCreateType() {
    setTypeEditTarget(null)
    setTypeForm({ name: '', description: '' })
    setShowTypeModal(true)
  }
  function openEditType(dt: DocumentType) {
    setTypeEditTarget(dt)
    setTypeForm({ name: dt.name, description: dt.description ?? '' })
    setShowTypeModal(true)
  }
  async function handleSaveType() {
    if (!typeForm.name.trim()) { toastError(t('common.error'), t('customDocuments.nameRequired')); return }
    setSavingType(true)
    try {
      const res = typeEditTarget
        ? await api.customDocuments.updateType({ id: typeEditTarget.id, name: typeForm.name.trim(), description: typeForm.description.trim() || undefined })
        : await api.customDocuments.createType({ name: typeForm.name.trim(), description: typeForm.description.trim() || undefined })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('customDocuments.couldNotSave')); return }
      toastSuccess(t('common.saveChanges'), '')
      setShowTypeModal(false)
      const wasCreate = !typeEditTarget
      await loadTypes()
      if (wasCreate && res.data) setSelectedTypeId((res.data as DocumentType).id)
    } catch {
      toastError(t('common.error'), t('customDocuments.couldNotSave'))
    } finally {
      setSavingType(false)
    }
  }

  function openCreateField() {
    setFieldForm({ fieldName: '', fieldType: 'TEXT', selectOptions: [''] })
    setShowFieldModal(true)
  }
  async function handleSaveField() {
    if (!documentEntityType) return
    if (!fieldForm.fieldName.trim()) { toastError(t('common.error'), t('customFields.nameRequired')); return }
    const cleanOptions = fieldForm.selectOptions.map(o => o.trim()).filter(Boolean)
    if (fieldForm.fieldType === 'SELECT' && cleanOptions.length === 0) { toastError(t('common.error'), t('customFields.optionsRequired')); return }
    setSavingField(true)
    try {
      const res = await api.customFields.create({
        entityType: documentEntityType, fieldName: fieldForm.fieldName.trim(), fieldType: fieldForm.fieldType,
        selectOptions: fieldForm.fieldType === 'SELECT' ? cleanOptions : undefined
      })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('customFields.couldNotSave')); return }
      toastSuccess(t('common.saveChanges'), '')
      setShowFieldModal(false)
      loadFields()
    } catch {
      toastError(t('common.error'), t('customFields.couldNotSave'))
    } finally {
      setSavingField(false)
    }
  }

  function openCreateEntry() {
    setEntryEditTarget(null)
    setEntryDate(new Date().toISOString().slice(0, 10))
    setEntryNotes('')
    setEntryFieldValues({})
    setShowEntryModal(true)
  }
  function openEditEntry(entry: Entry) {
    setEntryEditTarget(entry)
    setEntryDate(entry.entryDate.slice(0, 10))
    setEntryNotes(entry.notes ?? '')
    setEntryFieldValues(entry.customFields ?? {})
    setShowEntryModal(true)
  }
  async function handleSaveEntry() {
    if (!selectedTypeId) return
    setSavingEntry(true)
    try {
      const res = entryEditTarget
        ? await api.customDocuments.updateEntry({ id: entryEditTarget.id, entryDate, notes: entryNotes.trim() || undefined, customFields: entryFieldValues })
        : await api.customDocuments.createEntry({ documentTypeId: selectedTypeId, entryDate, notes: entryNotes.trim() || undefined, customFields: entryFieldValues })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('customDocuments.couldNotSave')); return }
      toastSuccess(t('common.saveChanges'), '')
      setShowEntryModal(false)
      loadEntries()
    } catch {
      toastError(t('common.error'), t('customDocuments.couldNotSave'))
    } finally {
      setSavingEntry(false)
    }
  }

  async function handleDeleteEntry() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await api.customDocuments.deleteEntry(deleteTarget.id)
      if (res.success) { toastSuccess(t('common.delete'), ''); setDeleteTarget(null); loadEntries() }
      else toastError(t('common.error'), res.error?.message ?? t('customDocuments.couldNotDelete'))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
              <FileStack size={18} className="text-brand" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('customDocuments.title')}</h1>
              <p className="text-xs text-slate-400">{t('customDocuments.subtitle')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { loadTypes(); loadEntries() }} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
              <RefreshCw size={14} className={loadingTypes || loadingEntries ? 'animate-spin' : ''} />
            </button>
            {canManage && (
              <Button size="sm" icon={<Plus size={14} />} onClick={openCreateType}>{t('customDocuments.newType')}</Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-e border-slate-100 dark:border-slate-800 overflow-y-auto shrink-0">
          {loadingTypes ? (
            <div className="p-4"><SkeletonTable rows={4} cols={1} /></div>
          ) : types.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-400">{t('customDocuments.noTypesYet')}</div>
          ) : (
            types.map(dt => (
              <button
                key={dt.id}
                onClick={() => setSelectedTypeId(dt.id)}
                className={cn(
                  'w-full text-start px-4 py-3 border-b border-slate-50 dark:border-slate-800 transition-colors',
                  selectedTypeId === dt.id ? 'bg-brand/5 border-s-2 border-s-brand' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                )}
              >
                <p className={cn('text-sm font-semibold', selectedTypeId === dt.id ? 'text-brand' : 'text-dark dark:text-slate-200')}>{dt.name}</p>
                {!dt.isActive && <span className="text-[10px] text-slate-400">{t('common.inactive')}</span>}
              </button>
            ))
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {!selectedType ? (
            <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
              <FileStack size={40} className="opacity-30" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('customDocuments.selectOrCreateType')}</p>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold text-dark dark:text-slate-100">{selectedType.name}</h2>
                  {selectedType.description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{selectedType.description}</p>}
                </div>
                {canManage && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="secondary" icon={<Pencil size={13} />} onClick={() => openEditType(selectedType)}>{t('common.edit')}</Button>
                    <Button size="sm" variant="secondary" icon={<Settings size={13} />} onClick={() => setShowFieldsPanel(v => !v)}>{t('customDocuments.manageFields')}</Button>
                  </div>
                )}
              </div>

              {showFieldsPanel && canManage && (
                <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('customFields.title')}</p>
                    <Button size="sm" variant="ghost" icon={<Plus size={13} />} onClick={openCreateField}>{t('customFields.newField')}</Button>
                  </div>
                  {fields.length === 0 ? (
                    <p className="text-xs text-slate-400">{t('customDocuments.noFieldsYet')}</p>
                  ) : (
                    <ul className="text-sm space-y-1.5">
                      {fields.map(f => (
                        <li key={f.id} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                          <span className="font-medium">{f.fieldName}</span>
                          <span className="text-xs text-slate-400">({t(`customFields.type.${f.fieldType}`)})</span>
                          {!f.isActive && <span className="text-[10px] text-slate-400">{t('common.inactive')}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-dark dark:text-slate-100">{t('customDocuments.entries', { count: entries.length })}</p>
                {canManage && <Button size="sm" icon={<Plus size={14} />} onClick={openCreateEntry}>{t('customDocuments.newEntry')}</Button>}
              </div>

              {loadingEntries ? (
                <SkeletonTable rows={5} cols={3} />
              ) : entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-2 text-slate-400">
                  <p className="text-sm">{t('customDocuments.noEntriesYet')}</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="text-start px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.date')}</th>
                      <th className="text-start px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('customDocuments.details')}</th>
                      <th className="text-end px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(entry => (
                      <tr key={entry.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-3 py-2.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatDate(entry.entryDate)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-600 dark:text-slate-300">
                            {Object.entries(entry.customFields ?? {}).map(([k, v]) => {
                              const fieldName = fields.find(f => f.id === k)?.fieldName ?? k
                              return <span key={k}><span className="text-slate-400">{fieldName}:</span> {v}</span>
                            })}
                          </div>
                          {entry.notes && <p className="text-xs text-slate-400 mt-0.5">{entry.notes}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-end">
                          {canManage && (
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => openEditEntry(entry)} className="text-slate-300 hover:text-brand transition-colors"><Pencil size={13} /></button>
                              <button onClick={() => setDeleteTarget(entry)} className="text-slate-300 hover:text-danger transition-colors"><Trash2 size={13} /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {showTypeModal && (
        <Modal open onClose={() => setShowTypeModal(false)} title={typeEditTarget ? t('customDocuments.editType') : t('customDocuments.newType')} size="sm"
          footer={<>
            <Button variant="secondary" onClick={() => setShowTypeModal(false)} disabled={savingType}>{t('common.cancel')}</Button>
            <Button onClick={handleSaveType} loading={savingType}>{t('common.save')}</Button>
          </>}
        >
          <div className="space-y-4">
            <Input label={t('customDocuments.typeName')} value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))} placeholder={t('customDocuments.typeNamePlaceholder')} />
            <Input label={t('common.description')} value={typeForm.description} onChange={e => setTypeForm(f => ({ ...f, description: e.target.value }))} />
          </div>
        </Modal>
      )}

      {showFieldModal && (
        <Modal open onClose={() => setShowFieldModal(false)} title={t('customFields.newField')} size="sm"
          footer={<>
            <Button variant="secondary" onClick={() => setShowFieldModal(false)} disabled={savingField}>{t('common.cancel')}</Button>
            <Button onClick={handleSaveField} loading={savingField}>{t('common.save')}</Button>
          </>}
        >
          <div className="space-y-4">
            <Input label={t('customFields.fieldName')} value={fieldForm.fieldName} onChange={e => setFieldForm(f => ({ ...f, fieldName: e.target.value }))} />
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t('customFields.fieldType')}</label>
              <select
                value={fieldForm.fieldType}
                onChange={e => setFieldForm(f => ({ ...f, fieldType: e.target.value as typeof FIELD_TYPES[number] }))}
                className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
              >
                {FIELD_TYPES.map(ft => <option key={ft} value={ft}>{t(`customFields.type.${ft}`)}</option>)}
              </select>
            </div>
            {fieldForm.fieldType === 'SELECT' && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">{t('customFields.options')}</label>
                {fieldForm.selectOptions.map((opt, i) => (
                  <Input key={i} value={opt} onChange={e => setFieldForm(f => ({ ...f, selectOptions: f.selectOptions.map((o, oi) => oi === i ? e.target.value : o) }))} />
                ))}
                <Button size="sm" variant="ghost" icon={<Plus size={13} />} onClick={() => setFieldForm(f => ({ ...f, selectOptions: [...f.selectOptions, ''] }))}>{t('customFields.addOption')}</Button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {showEntryModal && documentEntityType && (
        <Modal open onClose={() => setShowEntryModal(false)} title={entryEditTarget ? t('customDocuments.editEntry') : t('customDocuments.newEntry')} size="md"
          footer={<>
            <Button variant="secondary" onClick={() => setShowEntryModal(false)} disabled={savingEntry}>{t('common.cancel')}</Button>
            <Button onClick={handleSaveEntry} loading={savingEntry}>{t('common.save')}</Button>
          </>}
        >
          <div className="space-y-4">
            <Input label={t('common.date')} type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
            <CustomFieldsEditor entityType={documentEntityType} values={entryFieldValues} onChange={setEntryFieldValues} />
            <div>
              <label htmlFor="custom-document-entry-notes" className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t('customDocuments.notes')}</label>
              <textarea
                id="custom-document-entry-notes"
                value={entryNotes} onChange={e => setEntryNotes(e.target.value)} rows={3}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
              />
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          open
          title={t('customDocuments.deleteEntryTitle')}
          message={t('customDocuments.deleteEntryMessage')}
          confirmLabel={t('common.delete')}
          loading={deleting}
          onConfirm={handleDeleteEntry}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
