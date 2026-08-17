import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@renderer/services/ipc-client'
import { shouldShowCustomField } from './custom-fields.util'

interface CustomFieldDefinition {
  id: string
  fieldName: string
  fieldType: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT'
  selectOptions: string[] | null
  isActive: boolean
}


type CustomFieldEntityType = 'INVOICE' | 'CUSTOMER' | 'SUPPLIER' | 'PRODUCT' | 'EXPENSE'

// Shared by every entity form's own openEdit() — parses the JSON-string
// blob a record's own `customFields` column stores back into the plain
// object this editor (and the create/update payload) both expect.
export function parseCustomFields(raw: string | null | undefined): Record<string, string | number> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

// Phase 66 — Custom Fields. One shared editor every entity form (Billing/
// Customer/Supplier/Product/Expense) mounts, instead of five near-identical
// copies of "fetch active definitions for this entity type, render a field
// per definition, collect a {fieldId: value} object." Self-hides (renders
// nothing) when zero active fields exist for that entity type — same "zero
// footprint until opted in" precedent Phase 65's cost-centre pickers established.
export function CustomFieldsEditor({
  entityType, values, onChange
}: {
  entityType: CustomFieldEntityType
  values: Record<string, string | number>
  onChange: (values: Record<string, string | number>) => void
}) {
  const { t } = useTranslation()
  const [allFields, setAllFields] = useState<CustomFieldDefinition[]>([])

  // Fetches EVERY definition (active + inactive), not just active ones — an
  // earlier version passed activeOnly:true here, which meant deactivating a
  // field made its already-recorded value invisible on EVERY form forever,
  // contradicting this feature's own documented promise. See
  // shouldShowCustomField above for the fix and its own test coverage.
  useEffect(() => {
    let cancelled = false
    api.customFields.list({ entityType }).then((res) => {
      if (!cancelled && res.success) setAllFields((res.data as CustomFieldDefinition[]) ?? [])
    }).catch(() => {})
    return () => { cancelled = true }
  }, [entityType])

  const fields = allFields.filter((f) => shouldShowCustomField(f, values))

  if (fields.length === 0) return null

  function setValue(fieldId: string, value: string | number) {
    const next = { ...values }
    if (value === '' || value === undefined) delete next[fieldId]
    else next[fieldId] = value
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('customFields.title')}</p>
      {fields.map((field) => (
        <div key={field.id}>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
            {field.fieldName}
            {!field.isActive && <span className="ms-1.5 text-slate-400">({t('common.inactive')})</span>}
          </label>
          {field.fieldType === 'SELECT' ? (
            <select
              value={values[field.id] ?? ''}
              onChange={(e) => setValue(field.id, e.target.value)}
              className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
            >
              <option value="">{t('common.select')}</option>
              {(field.selectOptions ?? []).map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          ) : (
            <input
              type={field.fieldType === 'NUMBER' ? 'number' : field.fieldType === 'DATE' ? 'date' : 'text'}
              value={values[field.id] ?? ''}
              onChange={(e) => setValue(field.id, field.fieldType === 'NUMBER' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
            />
          )}
        </div>
      ))}
    </div>
  )
}
