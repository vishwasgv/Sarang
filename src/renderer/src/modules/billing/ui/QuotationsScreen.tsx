import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, FileText, RefreshCw, ChevronRight, ArrowRightCircle, Trash2, Printer, Receipt } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { useBusinessStore } from '@app/store/business.store'
import { cn } from '@shared/utils/cn'
import { formatDate } from '@shared/utils/locale.util'
import { Button } from '@shared/ui/atoms/Button'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Tabs } from '@shared/ui/molecules/Tabs'

interface QuotationItem {
  id: string; productName: string; quantity: number; unitPrice: number; discount: number; taxRate: number; lineTotal: number
}
interface Quotation {
  id: string; quotationNumber: string; customerName?: string | null; status: string
  totalAmount: number; validUntil?: string | null; createdAt: string; items?: QuotationItem[]
  invoice?: { id: string; invoiceNumber: string } | null
  customer?: { id: string; customerName: string } | null
}

// Matches quotation.service.ts's status type: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'EXPIRED'.
const STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  SENT: 'info',
  ACCEPTED: 'success',
  EXPIRED: 'danger'
}

function fmtMoney(n: number, sym: string) {
  return `${sym}${n.toFixed(2)}`
}

const STATUS_FILTER_VALUES = ['All', 'DRAFT', 'SENT', 'ACCEPTED', 'EXPIRED'] as const
type StatusFilter = typeof STATUS_FILTER_VALUES[number]

export function QuotationsScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const hasPermission = useAuthStore(s => s.hasPermission)
  const sym = useBusinessStore(s => s.profile?.currencySymbol ?? '₹')

  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Quotation | null>(null)
  const [converting, setConverting] = useState<string | null>(null)
  const [printing, setPrinting] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.quotations.list(statusFilter !== 'All' ? { status: statusFilter } : {})
      if (res.success) {
        const d = res.data as { quotations: Quotation[] }
        setQuotations(d.quotations ?? [])
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, toastError, t])

  useEffect(() => { loadData() }, [loadData])

  async function handlePrint(q: Quotation) {
    setPrinting(q.id)
    try {
      const res = await window.api.quotations.print(q.id)
      if (!res.success) {
        toastError((res.error as { message: string })?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'))
    } finally {
      setPrinting(null)
    }
  }

  // Fresh-audit fix (2026-07-12): explicit thermal override — Quotation
  // previously had no way to print at receipt width at all, unlike Invoice.
  async function handlePrintReceipt(q: Quotation) {
    setPrinting(q.id)
    try {
      const res = await window.api.quotations.printReceipt({ id: q.id })
      if (!res.success) {
        toastError((res.error as { message: string })?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'))
    } finally {
      setPrinting(null)
    }
  }

  async function convertToInvoice(q: Quotation) {
    setConverting(q.id)
    const res = await window.api.quotations.convertToInvoice(q.id)
    if (res.success) {
      toastSuccess(t('quotations.converted'))
      loadData()
    } else {
      toastError((res.error as { message: string })?.message ?? t('quotations.failedConvert'))
    }
    setConverting(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const res = await window.api.quotations.delete(deleteTarget.id)
    if (res.success) {
      toastSuccess(t('quotations.deleted'))
      loadData()
    } else {
      toastError((res.error as { message: string })?.message ?? t('quotations.failedDelete'))
    }
    setDeleteTarget(null)
  }

  const canCreate = hasPermission('billing.create')
  const canVoid = hasPermission('billing.void')

  const statusLabels: Record<StatusFilter, string> = {
    All: t('quotations.statusAll'),
    DRAFT: t('quotations.statusDraft'),
    SENT: t('quotations.statusSent'),
    ACCEPTED: t('quotations.statusAccepted'),
    EXPIRED: t('quotations.statusExpired'),
  }

  return (
    <div className="p-6 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
            <FileText size={20} className="text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark dark:text-slate-100">{t('quotations.title')}</h1>
            <p className="text-sm text-slate-500">
              {t('quotations.count', { count: quotations.length })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 hover:border-brand hover:text-brand transition-colors disabled:opacity-50">
            <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
          </button>
          {canCreate && (
            <Button size="md" onClick={() => navigate('/billing/quotations/new')}>
              <Plus size={16} className="mr-1.5" /> {t('quotations.newQuotation')}
            </Button>
          )}
        </div>
      </div>

      <Tabs
        tabs={STATUS_FILTER_VALUES.map(s => ({ id: s, label: statusLabels[s] }))}
        active={statusFilter}
        onChange={setStatusFilter}
      />

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : quotations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
          <FileText size={48} className="opacity-30" />
          <p className="text-base">{t('quotations.noQuotations')}</p>
          {canCreate && (
            <Button size="sm" onClick={() => navigate('/billing/quotations/new')}>
              <Plus size={14} className="mr-1" /> {t('quotations.createFirst')}
            </Button>
          )}
        </div>
      ) : (
        <Card padding="none" className="divide-y divide-slate-100 dark:divide-slate-800">
          {quotations.map(q => (
            <div key={q.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-dark dark:text-slate-100">{q.quotationNumber}</p>
                  <Badge variant={STATUS_VARIANT[q.status] ?? 'neutral'} size="sm">{q.status}</Badge>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {q.customer?.customerName ?? q.customerName ?? t('billing.walkIn')} • {formatDate(q.createdAt)}
                  {q.validUntil && ` • ${t('quotations.validTill', { date: formatDate(q.validUntil) })}`}
                </p>
              </div>
              <p className="text-sm font-bold text-dark dark:text-slate-100 shrink-0">{fmtMoney(q.totalAmount, sym)}</p>
              {q.invoice ? (
                <button onClick={() => navigate(`/billing/invoices/${q.invoice!.id}`)}
                  className="text-xs text-success font-semibold whitespace-nowrap">
                  {q.invoice.invoiceNumber} <ChevronRight size={12} className="inline" />
                </button>
              ) : q.status !== 'EXPIRED' && canCreate ? (
                <button
                  onClick={() => convertToInvoice(q)}
                  disabled={converting === q.id}
                  className="flex items-center gap-1 text-xs text-brand font-semibold hover:underline disabled:opacity-50 whitespace-nowrap">
                  <ArrowRightCircle size={13} />
                  {converting === q.id ? t('quotations.converting') : t('quotations.convertToInvoice')}
                </button>
              ) : null}
              <button onClick={() => handlePrint(q)} disabled={printing === q.id} title="Print (A4)"
                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-brand transition-all disabled:opacity-30">
                <Printer size={14} />
              </button>
              <button onClick={() => handlePrintReceipt(q)} disabled={printing === q.id} title="Print Receipt (Thermal)"
                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-brand transition-all disabled:opacity-30">
                <Receipt size={14} />
              </button>
              {canVoid && !q.invoice && (
                <button onClick={() => setDeleteTarget(q)}
                  className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-danger transition-all">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title={t('quotations.deleteTitle')}
        message={t('quotations.deleteMsg', { number: deleteTarget?.quotationNumber })}
        confirmLabel={t('common.delete')}
        confirmVariant="danger"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
