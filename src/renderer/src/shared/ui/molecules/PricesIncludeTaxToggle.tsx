import { useTranslation } from 'react-i18next'

interface Props {
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}

// Per-document "Prices include tax" switch, shared by every create form. The default comes from the
// business setting (Settings → Currency & Locale); the hint says which way the entered prices are read.
export function PricesIncludeTaxToggle({ checked, onChange, disabled }: Props) {
  const { t } = useTranslation()
  return (
    <div>
      <label className="flex items-center gap-3 min-h-[44px] text-sm text-dark dark:text-slate-100 cursor-pointer">
        <input
          type="checkbox"
          className="w-5 h-5"
          checked={checked}
          disabled={disabled}
          onChange={e => onChange(e.target.checked)}
        />
        <span>{t('billing.pricesIncludeTax')}</span>
      </label>
      <p className="text-xs text-slate-400">{checked ? t('billing.pricesIncludeTaxHint') : t('billing.pricesExcludeTaxHint')}</p>
    </div>
  )
}
