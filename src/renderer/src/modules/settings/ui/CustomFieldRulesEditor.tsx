import { useTranslation } from 'react-i18next'

export interface FieldRulesForm {
  isRequired: boolean
  minValue: string
  maxValue: string
  pattern: string
  patternHint: string
}

export const EMPTY_RULES: FieldRulesForm = { isRequired: false, minValue: '', maxValue: '', pattern: '', patternHint: '' }

/** The rules sent to the server: blanks become null so they clear an earlier rule. */
export function rulesPayload(fieldType: string, r: FieldRulesForm) {
  return {
    isRequired: r.isRequired,
    minValue: fieldType === 'NUMBER' && r.minValue !== '' ? Number(r.minValue) : null,
    maxValue: fieldType === 'NUMBER' && r.maxValue !== '' ? Number(r.maxValue) : null,
    pattern: fieldType === 'TEXT' && r.pattern.trim() ? r.pattern.trim() : null,
    patternHint: fieldType === 'TEXT' && r.patternHint.trim() ? r.patternHint.trim() : null
  }
}

const input = 'w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100'

export function CustomFieldRulesEditor({ fieldType, value, onChange }: { fieldType: string; value: FieldRulesForm; onChange: (v: FieldRulesForm) => void }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input type="checkbox" checked={value.isRequired} onChange={(e) => onChange({ ...value, isRequired: e.target.checked })} className="w-4 h-4 accent-brand" />
        {t('customFields.rules.required')}
      </label>
      {fieldType === 'NUMBER' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('customFields.rules.min')}</label>
            <input type="number" value={value.minValue} onChange={(e) => onChange({ ...value, minValue: e.target.value })} className={input} />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('customFields.rules.max')}</label>
            <input type="number" value={value.maxValue} onChange={(e) => onChange({ ...value, maxValue: e.target.value })} className={input} />
          </div>
        </div>
      )}
      {fieldType === 'TEXT' && (
        <>
          <div>
            <label className="block text-xs text-slate-500 mb-1">{t('customFields.rules.pattern')}</label>
            <input value={value.pattern} maxLength={200} onChange={(e) => onChange({ ...value, pattern: e.target.value })} placeholder={t('customFields.rules.patternPlaceholder')} className={input} />
          </div>
          {value.pattern.trim() && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">{t('customFields.rules.patternHint')}</label>
              <input value={value.patternHint} maxLength={120} onChange={(e) => onChange({ ...value, patternHint: e.target.value })} className={input} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
