import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { CreditCard, Search, RefreshCw, RotateCcw } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { SkeletonTable } from '@shared/ui/Skeleton'
import { useNotificationStore } from '@app/store/notification.store'
import { cn } from '@shared/utils/cn'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDateTime } from '@shared/utils/locale.util'
import { useAuthStore } from '@app/store/auth.store'
import { Badge } from '@shared/ui/atoms/Badge'
import { Tabs } from '@shared/ui/molecules/Tabs'

interface Payment {
  id: string; paymentMethod: string; amount: number; referenceNumber?: string | null
  remarks?: string | null; isReversed: boolean; paymentDate: string
  invoice: { id: string; invoiceNumber: string; totalAmount: number } | null
  customer: { id: string; customerName: string } | null
  recordedBy: { id: string; fullName: string } | null
}

// Real values recorded onto Payment.paymentMethod by payment.service.ts /
// billing.service.ts's split-payment path: CASH, UPI, CARD, WALLET. CREDIT is
// kept mapped defensively — a credit sale never gets a Payment row (the
// invoice just stays UNPAID), but METHOD_TABS/filters historically allowed it.
const METHOD_VARIANT: Record<string, 'success' | 'brand' | 'info' | 'warning' | 'neutral'> = {
  CASH: 'success',
  UPI: 'brand',
  CARD: 'info',
  WALLET: 'neutral',
  CREDIT: 'warning'
}

const METHOD_TABS = ['ALL', 'CASH', 'UPI', 'CARD', 'WALLET']

export function PaymentHistoryScreen() {
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canReverse = hasPermission('payments.reverse')

  const [payments, setPayments] = useState<Payment[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [methodFilter, setMethodFilter] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const limit = 50

  // Reverse payment modal
  const [reversingId, setReversingId] = useState<string | null>(null)
  const [reverseReason, setReverseReason] = useState('')

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.payments.list({
        search: search.trim() || undefined,
        method: methodFilter !== 'ALL' ? methodFilter : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit
      })
      if (res.success) {
        const d = res.data as { payments: Payment[]; total: number }
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
    const t = setTimeout(fetchPayments, 200)
    return () => clearTimeout(t)
  }, [fetchPayments])

  function handleMethodFilterChange(m: string) {
    // Reset page in the same batch as the filter change, not via a separate
    // effect — avoids a wasted fetch with the old page + new filter.
    setMethodFilter(m)
    setPage(1)
  }

  async function handleReverse() {
    if (!reversingId || !reverseReason.trim()) { toastError('Reason Required', 'Enter a reason for reversal.'); return }
    const res = await window.api.payments.reverse({ paymentId: reversingId, reason: reverseReason.trim() })
    if (res.success) {
      toastSuccess('Reversed', 'Payment has been reversed.')
      setReversingId(null); setReverseReason('')
      fetchPayments()
    } else {
      toastError('Failed', res.error?.message ?? 'Could not reverse payment.')
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
              <CreditCard size={18} className="text-brand" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark dark:text-slate-100">Payment History</h1>
              <p className="text-xs text-slate-400">{total} total payments</p>
            </div>
          </div>
          <button onClick={fetchPayments} aria-label="Refresh payments" className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
          </button>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search invoice, customer, or reference…"
              className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand text-slate-700 placeholder-slate-400"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-slate-500 shrink-0">From</label>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-slate-500 shrink-0">To</label>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }}
              className="text-xs text-slate-400 hover:text-danger transition-colors px-2 py-1">
              Clear dates
            </button>
          )}
          <Tabs
            tabs={METHOD_TABS.map(m => ({ id: m, label: m === 'ALL' ? 'All' : m }))}
            active={methodFilter}
            onChange={handleMethodFilterChange}
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto dark:bg-slate-950">
        {loading && payments.length === 0 ? (
          <div className="p-6">
            <SkeletonTable rows={8} cols={8} />
          </div>
        ) : payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
            <CreditCard size={40} className="opacity-30" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {search || dateFrom || dateTo || methodFilter !== 'ALL' ? 'No payments match these filters.' : 'No payment records found.'}
            </p>
            <p className="text-xs text-slate-400">
              {search || dateFrom || dateTo || methodFilter !== 'ALL' ? 'Try adjusting the search, dates, or method filter.' : 'Payments will appear here once invoices are paid.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Invoice</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Customer</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Method</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Reference</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">Recorded By</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {payments.map(pmt => (
                <tr key={pmt.id} className={cn('border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors', pmt.isReversed && 'opacity-50')}>
                  <td className="px-6 py-3 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(pmt.paymentDate)}</td>
                  <td className="px-4 py-3">
                    {pmt.invoice ? (
                      <button onClick={() => navigate(`/billing/${pmt.invoice!.id}`)}
                        className="font-semibold text-brand hover:underline">
                        {pmt.invoice.invoiceNumber}
                      </button>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {pmt.customer ? pmt.customer.customerName : <span className="text-slate-400 italic">Walk-in</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={METHOD_VARIANT[pmt.paymentMethod] ?? 'neutral'} size="sm">{pmt.paymentMethod}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">
                    {pmt.referenceNumber ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn('font-semibold', pmt.isReversed ? 'text-slate-400 line-through' : 'text-success')}>
                      {formatCurrency(pmt.amount)}
                    </span>
                    {pmt.isReversed && <span className="ml-2 text-xs text-danger font-semibold">REVERSED</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {pmt.recordedBy?.fullName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!pmt.isReversed && canReverse && (
                      <button onClick={() => { setReversingId(pmt.id); setReverseReason('') }}
                        title="Reverse payment"
                        aria-label="Reverse this payment"
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-danger hover:bg-danger/10 transition-colors ml-auto">
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
          <p className="text-xs text-slate-400">Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 dark:text-slate-300 disabled:opacity-40 hover:border-brand hover:text-brand transition-colors">
              Previous
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">Page {page} of {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 dark:text-slate-300 disabled:opacity-40 hover:border-brand hover:text-brand transition-colors">
              Next
            </button>
          </div>
        </div>
      )}

      {/* Reverse modal */}
      {reversingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
            <h2 className="text-lg font-bold text-dark dark:text-slate-100">Reverse Payment</h2>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">Reason *</label>
              <input value={reverseReason} onChange={e => setReverseReason(e.target.value)}
                placeholder="Enter reason for reversal"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setReversingId(null); setReverseReason('') }}>Cancel</Button>
              <Button variant="danger" className="flex-1" onClick={handleReverse}>Reverse</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
