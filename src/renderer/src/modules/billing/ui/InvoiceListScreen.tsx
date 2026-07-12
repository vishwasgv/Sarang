import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { FileText, Search, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { cn } from '@shared/utils/cn'
import { SkeletonTable } from '@shared/ui/Skeleton'
import { EmptyState } from '@shared/ui/EmptyState'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'
import { Badge } from '@shared/ui/atoms/Badge'
import { Tabs } from '@shared/ui/molecules/Tabs'

interface InvoiceSummary {
  id: string; invoiceNumber: string; createdAt: string
  totalAmount: number; paidAmount: number; balanceAmount: number
  paymentStatus: string; status: string
  customer: { id: string; customerName: string; customerCode?: string | null } | null
  items: { id: string }[]
}

// STATUS_TABS built dynamically inside component using t()

// Real values produced by billing/payment.service.ts: UNPAID (default on create),
// PAID (fully paid), PARTIAL (partial payment recorded), CANCELLED (invoice cancelled).
const PAYMENT_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  PAID: 'success',
  PARTIAL: 'warning',
  UNPAID: 'danger',
  CANCELLED: 'neutral'
}

export function InvoiceListScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const { error: toastError } = useNotificationStore()
  const canCreate = hasPermission('billing.createInvoice')

  const STATUS_TABS = [
    { value: '', label: t('billing.allInvoices') },
    { value: 'ACTIVE', label: t('common.active') },
    { value: 'CANCELLED', label: t('billing.status.cancelled') }
  ]

  const [invoices, setInvoices] = useState<InvoiceSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  const fetchInvoices = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.billing.listInvoices({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        limit
      })
      if (res.success) {
        const d = res.data as { invoices: InvoiceSummary[]; total: number }
        setInvoices(d.invoices)
        setTotal(d.total)
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally { setLoading(false) }
  }, [search, statusFilter, dateFrom, dateTo, page, toastError, t])

  useEffect(() => {
    const t = setTimeout(fetchInvoices, 200)
    return () => clearTimeout(t)
  }, [fetchInvoices])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-brand/10 flex items-center justify-center">
              <FileText size={22} className="text-brand" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-dark dark:text-slate-100">{t('billing.invoiceList')}</h1>
              <p className="text-sm text-slate-400">{total} {t('billing.totalAmount')}</p>
            </div>
          </div>
          {canCreate && (
            <Button size="md" onClick={() => navigate('/billing/new')}>
              <Plus size={16} className="mr-1" /> {t('billing.newInvoice')}
            </Button>
          )}
        </div>

        {/* Search + Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder={t('billing.searchInvoices')}
              className="w-full h-11 pl-10 pr-3 rounded-xl border border-slate-200 dark:border-slate-700 text-base bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand text-slate-700 placeholder-slate-400"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-slate-500 shrink-0">{t('reports.dateFrom')}</label>
            <input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }}
              className="h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs font-semibold text-slate-500 shrink-0">{t('reports.dateTo')}</label>
            <input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }}
              className="h-11 px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand" />
          </div>
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); setPage(1) }}
              className="text-xs text-slate-400 hover:text-danger transition-colors px-2 py-1">
              {t('common.clear')}
            </button>
          )}
          <Tabs
            tabs={STATUS_TABS.map(s => ({ id: s.value, label: s.label }))}
            active={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1) }}
          />
          <button onClick={fetchInvoices} className="w-11 h-11 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
            <RefreshCw size={16} className={cn(loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto dark:bg-slate-950">
        {loading && invoices.length === 0 ? (
          <div className="p-6">
            <SkeletonTable rows={8} cols={7} />
          </div>
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={<FileText size={28} />}
            title={search ? `${t('common.noResults')} "${search}"` : t('billing.noInvoices')}
            description={search ? t('common.tryAgain') : t('billing.emptyCart')}
            action={!search && canCreate && <Button size="md" onClick={() => navigate('/billing/new')}>{t('billing.newInvoice')}</Button>}
          />
        ) : (
          <table className="w-full text-base">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('billing.invoiceNumber')}</th>
                <th className="text-left px-4 py-4 text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('billing.customer')}</th>
                <th className="text-left px-4 py-4 text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('purchaseOrders.items')}</th>
                <th className="text-right px-4 py-4 text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.total')}</th>
                <th className="text-right px-4 py-4 text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.balance')}</th>
                <th className="text-center px-4 py-4 text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.status')}</th>
                <th className="text-left px-4 py-4 text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.date')}</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => (
                <tr key={inv.id} onClick={() => navigate(`/billing/${inv.id}`)}
                  className="border-b border-slate-50 dark:border-slate-800 hover:bg-brand/5 dark:hover:bg-brand/10 cursor-pointer transition-colors">
                  <td className="px-6 py-4">
                    <span className="font-semibold text-brand">{inv.invoiceNumber}</span>
                    {inv.status === 'CANCELLED' && <span className="ml-2 text-sm text-danger">({t('billing.status.cancelled')})</span>}
                  </td>
                  <td className="px-4 py-4 text-slate-600 dark:text-slate-300">
                    {inv.customer ? inv.customer.customerName : <span className="text-slate-400 italic">{t('billing.walkIn')}</span>}
                  </td>
                  <td className="px-4 py-4 text-slate-500 dark:text-slate-400">{inv.items.length} {t('purchaseOrders.items')}</td>
                  <td className="px-4 py-4 text-right font-semibold text-dark dark:text-slate-100">{formatCurrency(inv.totalAmount)}</td>
                  <td className="px-4 py-4 text-right">
                    {inv.balanceAmount > 0 ? <span className="font-semibold text-danger">{formatCurrency(inv.balanceAmount)}</span> : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <Badge variant={PAYMENT_STATUS_VARIANT[inv.paymentStatus] ?? 'neutral'}>{inv.paymentStatus}</Badge>
                  </td>
                  <td className="px-4 py-4 text-slate-500 dark:text-slate-400 text-sm">{formatDate(inv.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
          <p className="text-sm text-slate-400">Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</p>
          <div className="flex items-center gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 dark:text-slate-300 disabled:opacity-40 hover:border-brand hover:text-brand transition-colors">
              {t('common.back')}
            </button>
            <span className="text-sm text-slate-500 dark:text-slate-400">{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 dark:text-slate-300 disabled:opacity-40 hover:border-brand hover:text-brand transition-colors">
              {t('common.next')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
