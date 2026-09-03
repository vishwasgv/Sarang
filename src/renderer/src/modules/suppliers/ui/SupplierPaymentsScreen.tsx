import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Banknote, Search, RefreshCw, RotateCcw } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { SkeletonTable } from '@shared/ui/Skeleton'
import { useNotificationStore } from '@app/store/notification.store'
import { cn } from '@shared/utils/cn'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDateTime } from '@shared/utils/locale.util'
import { useAuthStore } from '@app/store/auth.store'
import { Badge } from '@shared/ui/atoms/Badge'
import { Tabs } from '@shared/ui/molecules/Tabs'

interface SupplierPayment {
  id: string; paymentMethod: string; amount: number; referenceNumber?: string | null
  remarks?: string | null; isReversed: boolean; paymentDate: string
  bill: { id: string; billNumber: string; totalAmount: number } | null
  supplier: { id: string; supplierName: string } | null
  recordedBy: { id: string; fullName: string } | null
}

const METHOD_VARIANT: Record<string, 'success' | 'brand' | 'info' | 'warning' | 'neutral'> = {
  CASH: 'success',
  UPI: 'brand',
  CARD: 'info',
  BANK_TRANSFER: 'neutral',
  CHEQUE: 'warning'
}

const METHOD_TABS = ['ALL', 'CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE']

// Mirrors PaymentHistoryScreen (Payments Received) exactly, against
// supplierPayments.list / Bill instead of payments.list / Invoice — same
// "Payments Made" first-class record the roadmap calls for.
export function SupplierPaymentsScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canReverse = hasPermission('supplierPayments.reverse')

  const [payments, setPayments] = useState<SupplierPayment[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const limit = 50

  const [reversingId, setReversingId] = useState<string | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const [reversing, setReversing] = useState(false)

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.supplierPayments.list({
        search: search.trim() || undefined,
        method: methodFilter !== 'ALL' ? methodFilter : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit
      })
      if (res.success) {
        const d = res.data as { payments: SupplierPayment[]; total: number }
        setPayments(d.payments)
        setTotal(d.total)
      } else {
        toastError('Failed', res.error?.message ?? 'Could not load payments.')
      }
    } catch {
      toastError('Failed', 'Could not load payments.')
    } finally { setLoading(false) }
  }, [search, methodFilter, dateFrom, dateTo, page, toastError])

  useEffect(() => {
    const timer = setTimeout(fetchPayments, 200)
    return () => clearTimeout(timer)
  }, [fetchPayments])

  function handleMethodFilterChange(m: string) {
    setMethodFilter(m)
    setPage(1)
  }

  async function handleReverse() {
    if (!reversingId || !reverseReason.trim()) { toastError('Reason Required', 'Enter a reason for reversal.'); return }
    setReversing(true)
    try {
      const res = await window.api.supplierPayments.reverse({ paymentId: reversingId, reason: reverseReason.trim() })
      if (res.success) {
        toastSuccess('Reversed', 'Payment has been reversed.')
        setReversingId(null); setReverseReason('')
        fetchPayments()
      } else {
        toastError('Failed', res.error?.message ?? 'Could not reverse payment.')
      }
    } catch {
      toastError('Failed', 'Could not reverse payment.')
    } finally {
      setReversing(false)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
              <Banknote size={18} className="text-brand" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('supplierPayments.title')}</h1>
              <p className="text-xs text-slate-400">{t('supplierPayments.subtitle', { count: total })}</p>
            </div>
          </div>
          <button onClick={fetchPayments} aria-label="Refresh payments" className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-4">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder={t('supplierPayments.searchPlaceholder')}
              className="w-full h-9 ps-9 pe-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand text-slate-700 placeholder-slate-400"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-slate-500 shrink-0">{t('reports.dateFrom')}</label>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-slate-500 shrink-0">{t('reports.dateTo')}</label>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }}
              className="text-xs text-slate-400 hover:text-danger transition-colors px-2 py-1">
              {t('common.clear')}
            </button>
          )}
          <Tabs
            tabs={METHOD_TABS.map(m => ({ id: m, label: m === 'ALL' ? t('common.all') : m.replace('_', ' ') }))}
            active={methodFilter}
            onChange={handleMethodFilterChange}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto dark:bg-slate-950">
        {loading && payments.length === 0 ? (
          <div className="p-6">
            <SkeletonTable rows={8} cols={8} />
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
            <Banknote size={40} className="opacity-30" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {search || dateFrom || dateTo || methodFilter !== 'ALL' ? t('supplierPayments.noPaymentsFiltered') : t('supplierPayments.noPayments')}
            </p>
            <p className="text-xs text-slate-400">
              {search || dateFrom || dateTo || methodFilter !== 'ALL' ? t('common.tryAdjustingFilters') : t('supplierPayments.noPaymentsHint')}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                <th className="text-start px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.date')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('supplierPayments.bill')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('supplierPayments.supplier')}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('bills.paymentMethod')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('bills.referenceNumber')}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('expenses.amount')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('supplierPayments.recordedBy')}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {payments.map(pmt => (
                <tr key={pmt.id} className={cn('border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors', pmt.isReversed && 'opacity-50')}>
                  <td className="px-6 py-3 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(pmt.paymentDate)}</td>
                  <td className="px-4 py-3">
                    {pmt.bill ? (
                      <button onClick={() => navigate(`/bills/${pmt.bill!.id}`)} className="font-semibold text-brand hover:underline">
                        {pmt.bill.billNumber}
                      </button>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {pmt.supplier ? pmt.supplier.supplierName : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={METHOD_VARIANT[pmt.paymentMethod] ?? 'neutral'} size="sm">{pmt.paymentMethod.replace('_', ' ')}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">{pmt.referenceNumber ?? '—'}</td>
                  <td className="px-4 py-3 text-end">
                    <span className={cn('font-semibold', pmt.isReversed ? 'text-slate-400 line-through' : 'text-success')}>{formatCurrency(pmt.amount)}</span>
                    {pmt.isReversed && <span className="ms-2 text-xs text-danger font-semibold">REVERSED</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">{pmt.recordedBy?.fullName ?? '—'}</td>
                  <td className="px-4 py-3 text-end">
                    {!pmt.isReversed && canReverse && (
                      <button onClick={() => { setReversingId(pmt.id); setReverseReason('') }}
                        title="Reverse payment" aria-label="Reverse this payment"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-danger hover:bg-danger/10 transition-colors ms-auto">
                        <RotateCcw size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
          <p className="text-xs text-slate-400">{t('common.showingRange', { from: (page - 1) * limit + 1, to: Math.min(page * limit, total), total })}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 dark:text-slate-300 disabled:opacity-40 hover:border-brand hover:text-brand transition-colors">
              {t('inventory.previous')}
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">{t('audit.page')} {page} {t('audit.of')} {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 dark:text-slate-300 disabled:opacity-40 hover:border-brand hover:text-brand transition-colors">
              {t('common.next')}
            </button>
          </div>
        </div>
      )}

      {reversingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('supplierPayments.reversePayment')}</h2>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">{t('supplierPayments.reason')} *</label>
              <input value={reverseReason} onChange={e => setReverseReason(e.target.value)}
                placeholder={t('supplierPayments.reverseReasonPlaceholder')}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setReversingId(null); setReverseReason('') }} disabled={reversing}>{t('common.cancel')}</Button>
              <Button variant="danger" className="flex-1" onClick={handleReverse} loading={reversing}>{t('supplierPayments.reverse')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
