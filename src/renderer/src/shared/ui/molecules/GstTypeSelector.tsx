import { useTranslation } from 'react-i18next'
import { cn } from '@shared/utils/cn'
import type { GstType } from '../../../../../shared/utils/gst-presentation'

interface Props {
  value: GstType
  onChange: (next: GstType) => void
  /** True while the choice still follows the place of supply automatically. */
  isAuto?: boolean
  disabled?: boolean
}

const OPTIONS: Array<{ value: GstType; labelKey: string }> = [
  { value: 'CGST_SGST', labelKey: 'billing.taxShownCgstSgst' },
  { value: 'IGST', labelKey: 'billing.taxShownIgst' },
  { value: 'GST', labelKey: 'billing.taxShownGst' }
]

// Per-document "Tax shown as" choice for a GST business. Only the presentation changes: the tax amount and
// the payable total are identical in all three. The caller renders this only under the GST tax model.
export function GstTypeSelector({ value, onChange, isAuto, disabled }: Props) {
  const { t } = useTranslation()
  return (
    <div>
      <p className="text-sm font-semibold text-dark dark:text-slate-100 mb-1">{t('billing.taxShownAs')}</p>
      <div role="radiogroup" aria-label={t('billing.taxShownAs')} className="grid grid-cols-3 gap-2">
        {OPTIONS.map(o => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'min-h-[44px] px-2 rounded-xl border text-sm font-semibold transition-colors',
              value === o.value
                ? 'bg-brand text-white border-brand'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:border-brand hover:text-brand'
            )}
          >
            {t(o.labelKey)}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-1">{isAuto ? t('billing.taxShownAutoHint') : t('billing.taxShownSameAmountHint')}</p>
    </div>
  )
}
