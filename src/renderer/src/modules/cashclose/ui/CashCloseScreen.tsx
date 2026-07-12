import React, { useState, useEffect, useCallback } from 'react'
import { Calculator, CheckCircle, AlertTriangle, XCircle, RefreshCw, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@shared/ui/atoms/Button'
import { cn } from '@shared/utils/cn'
import { useNotificationStore } from '@app/store/notification.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate, formatTime } from '@shared/utils/locale.util'
import { useBusinessStore } from '@app/store/business.store'
import { Card } from '@shared/ui/molecules/Card'

interface DaySummary {
  date: string
  expectedCash: number
  totalCollected: number
  byMethod: Record<string, number>
  alreadyClosed: boolean
  existing: { id: string; actualCash: number; variance: number; notes: string | null; createdAt: string } | null
}

interface CashCloseRecord {
  id: string
  closeDate: string
  expectedCash: number
  actualCash: number
  variance: number
  notes: string | null
  closedById: string | null
  createdAt: string
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash', UPI: 'UPI', CARD: 'Card', WALLET: 'Wallet', CREDIT: 'Credit'
}

function fmt(n: number) { return formatCurrency(Math.abs(n)) }

function varianceColor(v: number) {
  const abs = Math.abs(v)
  if (abs <= 0.01) return 'text-success'
  if (abs <= 100) return 'text-warning'
  return 'text-danger'
}

function varianceIcon(v: number) {
  const abs = Math.abs(v)
  if (abs <= 0.01) return <CheckCircle size={16} className="text-success" />
  if (abs <= 100) return <AlertTriangle size={16} className="text-warning" />
  return <XCircle size={16} className="text-danger" />
}

export function CashCloseScreen() {
  const { t } = useTranslation()
  const currSym = useBusinessStore(s => s.profile?.currencySymbol ?? '₹')
  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [summary, setSummary] = useState<DaySummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [actualCash, setActualCash] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [history, setHistory] = useState<CashCloseRecord[]>([])
  const { success: toastSuccess, error: toastError } = useNotificationStore()

  const loadSummary = useCallback(async () => {
    setLoading(true)
    setSummary(null)
    setActualCash('')
    setNotes('')
    try {
      const res = await window.api.cashClose.getSummary({ date })
      if (res.success) {
        const d = res.data as DaySummary
        setSummary(d)
        if (d.existing) {
          setActualCash(String(d.existing.actualCash))
          setNotes(d.existing.notes ?? '')
        }
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [date, toastError, t])

  const loadHistory = useCallback(async () => {
    try {
      const res = await window.api.cashClose.list({ limit: 10 })
      if (res.success) {
        setHistory(((res.data as { records: CashCloseRecord[] }) ?? {}).records ?? [])
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    }
  }, [toastError, t])

  useEffect(() => { loadSummary() }, [loadSummary])
  useEffect(() => { loadHistory() }, [loadHistory])

  async function handleSubmit() {
    const cash = parseFloat(actualCash)
    if (isNaN(cash) || cash < 0) { toastError('Invalid Amount', 'Enter a valid cash amount.'); return }
    setSubmitting(true)
    try {
      const res = await window.api.cashClose.create({ date, actualCash: cash, notes: notes.trim() || undefined })
      if (res.success) {
        toastSuccess('Cash Close Recorded', `Day close for ${date} saved successfully.`)
        await loadSummary()
        await loadHistory()
      } else {
        toastError('Error', res.error?.message ?? 'Failed to record cash close.')
      }
    } catch {
      toastError('Error', 'Failed to record cash close.')
    } finally {
      setSubmitting(false)
    }
  }

  const cash = parseFloat(actualCash) || 0
  const expectedCash = summary?.expectedCash ?? 0
  const variance = cash - expectedCash

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
          <Calculator size={20} className="text-brand" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-dark dark:text-slate-100">{t('cashClose.endOfDay')}</h1>
          <p className="text-sm text-slate-500">{t('cashClose.reconcile')}</p>
        </div>
      </div>

      {/* Date selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-slate-600 dark:text-slate-300 w-20">{t('common.date')}</label>
        <input
          type="date"
          value={date}
          max={today}
          onChange={e => setDate(e.target.value)}
          className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand"
        />
        <Button variant="outline" size="sm" onClick={loadSummary} disabled={loading}>
          <RefreshCw size={13} className={cn('mr-1.5', loading && 'animate-spin')} /> {t('common.refresh')}
        </Button>
      </div>

      {loading && (
        <Card padding="lg" className="text-center text-slate-400">
          {t('common.loading')}
        </Card>
      )}

      {!loading && summary && (
        <>
          {/* Payment breakdown */}
          <Card padding="lg" className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('cashClose.paymentsRecorded')} — {date}</h2>
            {Object.keys(summary.byMethod).length === 0 ? (
              <p className="text-sm text-slate-400">{t('cashClose.noPayments')}</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {Object.entries(summary.byMethod).map(([method, amount]) => (
                  <div key={method} className="flex justify-between py-2">
                    <span className="text-sm text-slate-600 dark:text-slate-300">{METHOD_LABELS[method] ?? method}</span>
                    <span className={cn('text-sm font-semibold', method === 'CASH' ? 'text-dark dark:text-slate-100' : 'text-slate-500')}>
                      {fmt(amount)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between py-2 font-semibold">
                  <span className="text-sm text-slate-700 dark:text-slate-200">{t('cashClose.totalCollected')}</span>
                  <span className="text-sm text-dark dark:text-slate-100">{fmt(summary.totalCollected)}</span>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
              <div className="flex justify-between items-center">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('cashClose.expectedCash')}</span>
                <span className="text-base font-bold text-dark dark:text-slate-100">{fmt(summary.expectedCash)}</span>
              </div>
            </div>
          </Card>

          {/* If already closed banner */}
          {summary.alreadyClosed && summary.existing && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-brand/5 border border-brand/20 text-sm text-brand">
              <Clock size={14} />
              <span>
                {t('cashClose.alreadyClosedBanner', { time: formatTime(summary.existing.createdAt) })}
              </span>
            </div>
          )}

          {/* Entry form */}
          <Card padding="lg" className="space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('cashClose.enterActualCash')}</h2>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-500">{t('cashClose.cashInDrawerLabel', { symbol: currSym })}</label>
              <input
                type="number"
                min="0"
                step="1"
                value={actualCash}
                onChange={e => setActualCash(e.target.value)}
                placeholder="Count the physical cash and enter here"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            {actualCash !== '' && (
              <div className={cn(
                'flex items-center gap-2 p-3 rounded-xl border text-sm font-semibold',
                Math.abs(variance) <= 0.01
                  ? 'bg-success/5 border-success/30 text-success'
                  : Math.abs(variance) <= 100
                  ? 'bg-warning/5 border-warning/30 text-warning'
                  : 'bg-danger/5 border-danger/30 text-danger'
              )}>
                {varianceIcon(variance)}
                <span>
                  {t('cashClose.variance')}: {variance >= 0 ? '+' : '-'}{fmt(variance)}
                  {Math.abs(variance) <= 0.01 && ` — ${t('cashClose.balanced')}`}
                  {Math.abs(variance) > 0.01 && Math.abs(variance) <= 100 && (variance > 0 ? ` — ${t('cashClose.drawerOver')}` : ` — ${t('cashClose.drawerShort')}`)}
                  {Math.abs(variance) > 100 && (variance > 0 ? ` — ${t('cashClose.significantOver')}` : ` — ${t('cashClose.significantShort')}`)}
                </span>
              </div>
            )}

            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-500">{t('cashClose.notes')} ({t('common.optional')})</label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Opened with ₹500 float, dropped ₹1000 in safe"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand resize-none"
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={submitting || actualCash === ''}
              className="w-full"
            >
              {submitting ? t('cashClose.saving') : summary.alreadyClosed ? t('cashClose.updateClose') : t('cashClose.recordClose')}
            </Button>
          </Card>
        </>
      )}

      {/* Recent closes */}
      {history.length > 0 && (
        <Card padding="none" className="overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('cashClose.recentCloses')}</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">{t('common.date')}</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">{t('cashClose.expected')}</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">{t('cashClose.actual')}</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-slate-500 uppercase">{t('cashClose.variance')}</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">{t('cashClose.notes')}</th>
              </tr>
            </thead>
            <tbody>
              {history.map(r => (
                <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300 whitespace-nowrap">
                    {formatDate(r.closeDate)}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">{fmt(r.expectedCash)}</td>
                  <td className="px-4 py-2 text-right font-semibold text-slate-700 dark:text-slate-200">{fmt(r.actualCash)}</td>
                  <td className={cn('px-4 py-2 text-right font-semibold', varianceColor(r.variance))}>
                    {r.variance >= 0 ? '+' : '-'}{fmt(r.variance)}
                  </td>
                  <td className="px-4 py-2 text-slate-500 text-xs max-w-[180px] truncate">{r.notes ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  )
}
