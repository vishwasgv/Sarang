import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import { useBusinessStore } from '@app/store/business.store'
import { formatCurrency } from '@shared/utils/currency.util'

interface Tile { id: string; name: string; metric: string; period: string; value: number }

const METRICS = ['SALES_TOTAL', 'INVOICE_COUNT', 'EXPENSE_TOTAL', 'PURCHASES_TOTAL', 'NEW_CUSTOMERS']
const PERIODS = ['TODAY', 'WEEK', 'MONTH', 'YEAR']
const COUNT_METRICS = ['INVOICE_COUNT', 'NEW_CUSTOMERS']

export function CustomKpiRow() {
  const { t } = useTranslation()
  const profile = useBusinessStore((s) => s.profile)
  const [tiles, setTiles] = useState<Tile[]>([])
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [metric, setMetric] = useState(METRICS[0])
  const [period, setPeriod] = useState('MONTH')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const r = await window.api.customKpis.list()
    if (r.success) setTiles((r.data as Tile[]) ?? [])
  }, [])
  useEffect(() => { void load() }, [load])

  const add = async () => {
    setError('')
    const r = await window.api.customKpis.add({ name, metric, period })
    if (!r.success) { setError(r.error?.message ?? ''); return }
    setName(''); setAdding(false); void load()
  }
  const remove = async (id: string) => { await window.api.customKpis.remove({ id }); void load() }

  const field = 'h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-dark dark:text-slate-100'
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {tiles.map((k) => (
          <div key={k.id} className="relative bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <button onClick={() => remove(k.id)} title={t('common.delete')} className="absolute top-2 right-2 text-slate-300 hover:text-danger"><X size={14} /></button>
            <p className="text-xs text-slate-400 pr-5 truncate">{k.name}</p>
            <p className="text-xl font-bold text-dark dark:text-slate-100 mt-1">
              {COUNT_METRICS.includes(k.metric) ? k.value : formatCurrency(k.value, profile?.currencyCode, profile?.currencySymbol)}
            </p>
            <p className="text-xs text-slate-400 mt-1">{t(`dashboard.customKpi.metrics.${k.metric}`)} · {t(`dashboard.customKpi.periods.${k.period}`)}</p>
          </div>
        ))}
        {!adding && tiles.length < 8 && (
          <button onClick={() => setAdding(true)}
            className="flex items-center justify-center gap-2 min-h-[88px] rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-sm text-slate-500 hover:border-brand hover:text-brand">
            <Plus size={16} /> {t('dashboard.customKpi.add')}
          </button>
        )}
      </div>
      {adding && (
        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={t('dashboard.customKpi.namePlaceholder')} className={`${field} w-48`} />
          <select value={metric} onChange={(e) => setMetric(e.target.value)} className={field}>
            {METRICS.map((m) => <option key={m} value={m}>{t(`dashboard.customKpi.metrics.${m}`)}</option>)}
          </select>
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className={field}>
            {PERIODS.map((p) => <option key={p} value={p}>{t(`dashboard.customKpi.periods.${p}`)}</option>)}
          </select>
          <button onClick={add} className="h-11 px-4 rounded-lg bg-brand text-white text-sm font-semibold">{t('common.save')}</button>
          <button onClick={() => setAdding(false)} className="h-11 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-sm">{t('common.cancel')}</button>
          {error && <p className="text-sm text-danger w-full">{error}</p>}
        </div>
      )}
    </div>
  )
}
