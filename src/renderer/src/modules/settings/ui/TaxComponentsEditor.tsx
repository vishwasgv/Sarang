import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'

export interface TaxPartForm {
  name: string
  rate: string
}

export function partsPayload(parts: TaxPartForm[]): Array<{ name: string; rate: number }> {
  return parts.filter((p) => p.name.trim() && Number(p.rate) > 0).map((p) => ({ name: p.name.trim(), rate: Number(p.rate) }))
}

const input = 'h-10 px-3 rounded-lg border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand'

// Splits one tax rate into named parts (for example GST 5% + PST 7%). Only affects how the tax is shown and reported.
export function TaxComponentsEditor({ rate, parts, onChange }: { rate: string; parts: TaxPartForm[]; onChange: (p: TaxPartForm[]) => void }) {
  const { t } = useTranslation()
  const sum = parts.reduce((a, p) => a + (Number(p.rate) || 0), 0)
  const total = Number(rate) || 0
  const off = parts.length > 0 && Math.abs(sum - total) > 0.0001
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-600">{t('settings.tax.parts.title')}</p>
        <button type="button" onClick={() => onChange([...parts, { name: '', rate: '' }])} className="text-xs font-semibold text-brand hover:underline">{t('settings.tax.parts.add')}</button>
      </div>
      <p className="text-xs text-slate-400">{t('settings.tax.parts.hint')}</p>
      {parts.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <input value={p.name} maxLength={40} placeholder={t('settings.tax.parts.namePlaceholder')} className={`${input} flex-1`}
            onChange={(e) => onChange(parts.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          <input type="number" min="0" step="any" value={p.rate} placeholder="%" className={`${input} w-28`}
            onChange={(e) => onChange(parts.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)))} />
          <button type="button" onClick={() => onChange(parts.filter((_, j) => j !== i))} className="text-slate-300 hover:text-danger"><Trash2 size={14} /></button>
        </div>
      ))}
      {parts.length > 0 && (
        <p className={`text-xs ${off ? 'text-danger' : 'text-slate-400'}`}>{t('settings.tax.parts.sum', { sum: Math.round(sum * 10000) / 10000, rate: total })}</p>
      )}
    </div>
  )
}
