import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ClipboardList, CheckCircle2, XCircle, FileText, Printer } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Modal } from '@shared/ui/molecules/Modal'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { formatDate } from '@shared/utils/locale.util'
import { formatCurrency } from '@shared/utils/currency.util'
import { cn } from '@shared/utils/cn'
import { ApprovalPanel } from '@shared/ui/organisms/ApprovalPanel'

interface Customer { id: string; customerName: string; customerCode: string; phone?: string | null; email?: string | null }
interface Product { id: string; productName: string; sku?: string | null; unit: string }
interface SalesOrderItem {
  id: string; quantity: number; invoicedQty: number; unitPrice: number; taxRate: number; total: number
  product: Product | null
  serviceDescription: string | null
  serviceCategory: { id: string; categoryName: string } | null
}
interface SalesOrder {
  id: string; soNumber: string; status: string
  orderDate: string; expectedDate?: string | null; notes?: string | null
  subtotal: number; taxAmount: number; totalAmount: number
  customer: Customer
  items: SalesOrderItem[]
  invoices: { id: string; invoiceNumber: string; totalAmount: number; invoiceDate: string }[]
}

const STATUS_VARIANT: Record<string, 'neutral' | 'brand' | 'success' | 'danger' | 'warning'> = {
  DRAFT: 'neutral',
  PENDING_APPROVAL: 'warning',
  CONFIRMED: 'brand',
  PARTIALLY_INVOICED: 'warning',
  INVOICED: 'success',
  CANCELLED: 'danger'
}

export function SalesOrderDetailScreen() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()

  const [so, setSo] = useState<SalesOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [confirming, setConfirming] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [invoiceQty, setInvoiceQty] = useState<Record<string, string>>({})
  const [invoicing, setInvoicing] = useState(false)
  const [printing, setPrinting] = useState(false)

  const canCreate = hasPermission('salesOrders.create')
  const canCancel = hasPermission('salesOrders.cancel')
  const canInvoice = hasPermission('salesOrders.invoice')

  const loadSO = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await window.api.salesOrders.get(id)
      if (res.success) setSo(res.data as SalesOrder)
      else setError(res.error?.message ?? t('salesOrders.notFound'))
    } catch {
      setError(t('common.error'))
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [id, toastError, t])

  useEffect(() => { loadSO() }, [loadSO])

  async function handleConfirm() {
    if (!so) return
    setConfirming(true)
    try {
      const res = await window.api.salesOrders.confirm(so.id)
      if (res.success) {
        const status = (res.data as { status: string }).status
        toastSuccess(status === 'PENDING_APPROVAL' ? t('salesOrders.submittedForApproval') : t('salesOrders.confirmed'), so.soNumber)
        loadSO()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally { setConfirming(false) }
  }

  async function handlePrint() {
    if (!so) return
    setPrinting(true)
    try {
      const res = await window.api.salesOrders.print(so.id)
      if (!res.success) toastError(t('common.error'), res.error?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally { setPrinting(false) }
  }

  async function handleCancel() {
    if (!so || !cancelReason.trim()) { toastError(t('salesOrders.reasonRequired'), t('salesOrders.enterCancelReason')); return }
    setCancelling(true)
    try {
      const res = await window.api.salesOrders.cancel({ id: so.id, reason: cancelReason.trim() })
      if (res.success) {
        toastSuccess(t('salesOrders.cancelled'), so.soNumber)
        setCancelOpen(false)
        loadSO()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally { setCancelling(false) }
  }

  function openInvoiceModal() {
    if (!so) return
    const defaults: Record<string, string> = {}
    for (const item of so.items) {
      const remaining = item.quantity - item.invoicedQty
      if (remaining > 0) defaults[item.id] = String(remaining)
    }
    setInvoiceQty(defaults)
    setInvoiceOpen(true)
  }

  async function handleCreateInvoice() {
    if (!so) return
    const lines = Object.entries(invoiceQty)
      .map(([salesOrderItemId, qty]) => ({ salesOrderItemId, quantity: parseFloat(qty) }))
      .filter(l => l.quantity > 0)
    if (lines.length === 0) { toastError(t('salesOrders.nothingToInvoice'), t('salesOrders.enterAtLeastOneQty')); return }
    setInvoicing(true)
    try {
      const res = await window.api.salesOrders.createInvoice({ salesOrderId: so.id, lines })
      if (res.success) {
        const inv = res.data as { id: string; invoiceNumber: string }
        toastSuccess(t('salesOrders.invoiceCreated'), inv.invoiceNumber)
        setInvoiceOpen(false)
        loadSO()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally { setInvoicing(false) }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        <div className="h-40 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (error || !so) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
        <ClipboardList size={40} className="text-slate-200 mb-4" />
        <p className="text-slate-500 dark:text-slate-400 text-sm">{error ?? t('salesOrders.notFound')}</p>
        <button onClick={() => navigate('/sales-orders')} className="mt-4 text-brand text-sm font-medium hover:underline">
          {t('salesOrders.backToOrders')}
        </button>
      </div>
    )
  }

  const canConfirmNow = canCreate && (so.status === 'DRAFT' || so.status === 'PENDING_APPROVAL')
  const canCancelNow = canCancel && so.status !== 'INVOICED' && so.status !== 'CANCELLED'
  const canInvoiceNow = canInvoice && (so.status === 'CONFIRMED' || so.status === 'PARTIALLY_INVOICED')

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/sales-orders')}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
            <ClipboardList size={20} className="text-brand" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-dark dark:text-slate-100 font-mono">{so.soNumber}</h1>
              <Badge variant={STATUS_VARIANT[so.status] ?? 'neutral'} size="sm">{so.status.replace(/_/g, ' ')}</Badge>
            </div>
            <p className="text-sm text-slate-400">{formatDate(so.orderDate)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handlePrint} loading={printing}>
            <Printer size={14} className="me-1.5" /> {t('billing.print')}
          </Button>
          {canConfirmNow && (
            <Button size="sm" onClick={handleConfirm} loading={confirming}>
              <CheckCircle2 size={14} className="me-1.5" /> {so.status === 'PENDING_APPROVAL' ? t('salesOrders.checkApproval') : t('salesOrders.confirmOrder')}
            </Button>
          )}
          {canInvoiceNow && (
            <Button size="sm" onClick={openInvoiceModal}>
              <FileText size={14} className="me-1.5" /> {t('salesOrders.createInvoice')}
            </Button>
          )}
          {canCancelNow && (
            <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>
              <XCircle size={14} className="me-1.5" /> {t('salesOrders.cancelOrder')}
            </Button>
          )}
        </div>
      </div>

      <ApprovalPanel documentType="SALES_ORDER" documentId={so.id} refreshSignal={so.status} onActioned={loadSO} />

      <div className="grid grid-cols-2 gap-4">
        <Card padding="md" className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('salesOrders.customer')}</p>
          <p className="text-sm font-semibold text-dark dark:text-slate-100">{so.customer.customerName}</p>
          <p className="text-xs text-slate-400">{so.customer.customerCode}</p>
          {so.customer.phone && <p className="text-xs text-slate-500 dark:text-slate-400">{so.customer.phone}</p>}
        </Card>
        <Card padding="md" className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('salesOrders.orderDetails')}</p>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">{t('common.date')}</span>
            <span className="text-dark dark:text-slate-100">{formatDate(so.orderDate)}</span>
          </div>
          {so.expectedDate && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-400">{t('salesOrders.expectedDate')}</span>
              <span className="text-dark dark:text-slate-100">{formatDate(so.expectedDate)}</span>
            </div>
          )}
          {so.notes && (
            <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-400 mb-0.5">{t('common.notes')}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{so.notes}</p>
            </div>
          )}
        </Card>
      </div>

      <Card padding="none">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <p className="text-sm font-semibold text-dark dark:text-slate-100">{t('purchaseOrders.items')}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                <th className="px-5 py-3 text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('reports.col.item')}</th>
                <th className="px-5 py-3 text-end text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('billing.qty')}</th>
                <th className="px-5 py-3 text-end text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('salesOrders.invoicedQty')}</th>
                <th className="px-5 py-3 text-end text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('salesOrders.unitPrice')}</th>
                <th className="px-5 py-3 text-end text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('common.total')}</th>
              </tr>
            </thead>
            <tbody>
              {so.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-3">
                    {item.product ? (
                      <>
                        <p className="font-medium text-dark dark:text-slate-100">{item.product.productName}</p>
                        {item.product.sku && <p className="text-xs text-slate-400">SKU: {item.product.sku}</p>}
                      </>
                    ) : (
                      <>
                        <p className="font-medium text-dark dark:text-slate-100">{item.serviceDescription}</p>
                        {item.serviceCategory && <p className="text-xs text-slate-400">{item.serviceCategory.categoryName}</p>}
                      </>
                    )}
                  </td>
                  <td className="px-5 py-3 text-end text-slate-700 dark:text-slate-300">{item.quantity}{item.product ? ` ${item.product.unit}` : ''}</td>
                  <td className="px-5 py-3 text-end">
                    <span className={cn('text-xs font-medium', item.invoicedQty >= item.quantity ? 'text-success' : 'text-slate-500 dark:text-slate-400')}>
                      {item.invoicedQty} / {item.quantity}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-end text-slate-700 dark:text-slate-300">{formatCurrency(item.unitPrice)}</td>
                  <td className="px-5 py-3 text-end font-medium text-dark dark:text-slate-100">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <div className="space-y-1.5 min-w-48">
            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
              <span>{t('billing.subtotal')}</span>
              <span>{formatCurrency(so.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
              <span>{t('billing.tax')}</span>
              <span>{formatCurrency(so.taxAmount)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-dark dark:text-slate-100 border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-1.5">
              <span>{t('common.total')}</span>
              <span>{formatCurrency(so.totalAmount)}</span>
            </div>
          </div>
        </div>
      </Card>

      {so.invoices.length > 0 && (
        <Card padding="none">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
            <p className="text-sm font-semibold text-dark dark:text-slate-100">{t('salesOrders.generatedInvoices')}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                  <th className="px-5 py-3 text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('bills.billNumber')}</th>
                  <th className="px-5 py-3 text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('common.date')}</th>
                  <th className="px-5 py-3 text-end text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('common.total')}</th>
                </tr>
              </thead>
              <tbody>
                {so.invoices.map(inv => (
                  <tr key={inv.id} className="border-b border-slate-50 dark:border-slate-800 last:border-0 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    onClick={() => navigate(`/billing/invoices/${inv.id}`)}>
                    <td className="px-5 py-3 font-mono text-dark dark:text-slate-100">{inv.invoiceNumber}</td>
                    <td className="px-5 py-3 text-slate-500 dark:text-slate-400">{formatDate(inv.invoiceDate)}</td>
                    <td className="px-5 py-3 text-end font-medium text-dark dark:text-slate-100">{formatCurrency(inv.totalAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Partial-invoice modal */}
      <Modal
        open={invoiceOpen}
        onClose={() => setInvoiceOpen(false)}
        title={t('salesOrders.createInvoice')}
        size="md"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setInvoiceOpen(false)} disabled={invoicing}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={handleCreateInvoice} loading={invoicing}>{t('salesOrders.createInvoice')}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('salesOrders.partialInvoiceHint')}</p>
          {so.items.map(item => {
            const remaining = item.quantity - item.invoicedQty
            if (remaining <= 0) return null
            return (
              <div key={item.id} className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-dark dark:text-slate-100 truncate">{item.product?.productName ?? item.serviceDescription}</p>
                  <p className="text-xs text-slate-400">{t('salesOrders.remainingLabel', { remaining })}</p>
                </div>
                <input
                  type="number" min="0" max={remaining} step="1"
                  value={invoiceQty[item.id] ?? ''}
                  onChange={e => setInvoiceQty(q => ({ ...q, [item.id]: e.target.value }))}
                  className="w-24 h-9 px-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand text-end"
                />
              </div>
            )
          })}
        </div>
      </Modal>

      {/* Cancel dialog */}
      <Modal
        open={cancelOpen}
        onClose={() => { setCancelOpen(false); setCancelReason('') }}
        title={t('salesOrders.cancelOrderTitle')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => { setCancelOpen(false); setCancelReason('') }} disabled={cancelling}>{t('bills.goBack')}</Button>
            <Button size="sm" className="bg-danger hover:bg-danger/90 text-white border-danger" onClick={handleCancel} loading={cancelling} disabled={!cancelReason.trim()}>
              {t('salesOrders.cancelOrder')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">{t('bills.voidReason')} *</label>
            <input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder={t('salesOrders.cancelReasonPlaceholder')}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand"
              autoFocus
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
