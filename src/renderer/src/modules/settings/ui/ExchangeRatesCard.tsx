import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@shared/ui/atoms/Button'
import { Card } from '@shared/ui/molecules/Card'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { toLocalISODate } from '@shared/utils/locale.util'

interface Rate { id: string; currencyCode: string; rate: number; rateDate: string }

// Exchange rates kept by hand or imported from a CSV file, with history. Used to fill in the rate on foreign-currency invoices.
export function ExchangeRatesCard() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canEdit = useAuthStore((s) => s.hasPermission('settings.modify'))
  const [rates, setRates] = useState<Rate[]>([])
  const [code, setCode] = useState('')
  const [rate, setRate] = useState('')
  const [day, setDay] = useState(() => toLocalISODate(new Date()))
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const r = await window.api.exchangeRates.list()
    if (r.success) setRates((r.data as Rate[]) ?? [])
  }, [])
  useEffect(() => { void load() }, [load])

  async function add() {
    const r = await window.api.exchangeRates.save({ currencyCode: code, rate: Number(rate), rateDate: day })
    if (!r.success) { toastError(t('common.error'), r.error?.message ?? ''); return }
    setRate('')
    void load()
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    const text = await file.text()
    const r = await window.api.exchangeRates.importCsv({ text })
    if (fileRef.current) fileRef.current.value = ''
    if (!r.success) { toastError(t('exchangeRates.importFailed'), r.error?.message ?? ''); return }
    toastSuccess(t('exchangeRates.imported'), String((r.data as { imported: number }).imported))
    void load()
  }

  const field = 'h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-dark dark:text-slate-100'
  return (
    <Card padding="lg" className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-dark dark:text-slate-100">{t('exchangeRates.title')}</h3>
        <p className="text-sm text-slate-500 mt-1">{t('exchangeRates.hint')}</p>
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={3} placeholder={t('exchangeRates.codePlaceholder')} className={`${field} w-28`} />
          <input type="number" min={0} step="0.0001" value={rate} onChange={(e) => setRate(e.target.value)} placeholder={t('exchangeRates.ratePlaceholder')} className={`${field} w-40`} />
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={field} />
          <Button onClick={add} disabled={code.length !== 3 || !(Number(rate) > 0) || !day}>{t('common.add')}</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>{t('exchangeRates.importCsv')}</Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" className="hidden" onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>
      )}
      <p className="text-xs text-slate-400">{t('exchangeRates.csvHelp')}</p>
      {rates.length === 0 ? (
        <p className="text-sm text-slate-400">{t('exchangeRates.empty')}</p>
      ) : (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-sm">
            <tbody>
              {rates.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 font-medium text-dark dark:text-slate-100">{r.currencyCode}</td>
                  <td className="py-2 text-slate-600 dark:text-slate-300">{r.rate}</td>
                  <td className="py-2 text-slate-400">{r.rateDate}</td>
                  <td className="py-2 text-end">
                    {canEdit && <button onClick={async () => { await window.api.exchangeRates.remove({ id: r.id }); void load() }} className="text-xs text-slate-400 hover:text-danger">{t('common.delete')}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}
