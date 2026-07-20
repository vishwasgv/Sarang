import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer, XCircle, PlusCircle, RotateCcw, Receipt, UtensilsCrossed } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DocumentPanel } from '@renderer/modules/documents/ui/DocumentPanel'
import { Button } from '@shared/ui/atoms/Button'
import { useNotificationStore } from '@app/store/notification.store'
import { useIndustryStore } from '@app/store/industry.store'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'
import { Skeleton } from '@shared/ui/Skeleton'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDateTime } from '@shared/utils/locale.util'
import { useBusinessStore } from '@app/store/business.store'
import { splitTaxLines } from '@shared/utils/tax.util'
import { useAuthStore } from '@app/store/auth.store'
import { Badge } from '@shared/ui/atoms/Badge'

interface InvoiceItem {
  id: string
  product: { id: string; productName: string; sku?: string | null; unit: string }
  quantity: number; unitPrice: number; discountAmount: number; taxRate: number; taxAmount: number; lineTotal: number
}
interface Payment {
  id: string; paymentMethod: string; amount: number; referenceNumber?: string | null
  remarks?: string | null; isReversed: boolean; paymentDate: string
  recordedBy: { id: string; fullName: string } | null
}
interface Invoice {
  id: string; invoiceNumber: string; invoiceType: string; status: string; createdAt: string
  subtotal: number; discountAmount: number; taxAmount: number; roundingAmount: number
  totalAmount: number; paidAmount: number; balanceAmount: number; paymentStatus: string
  // Phase 58 §2 — optional payment due date on CREDIT sales (e.g. Agri
  // Inputs' harvest-tied credit terms).
  dueDate?: string | null
  notes?: string | null
  gstType?: string | null
  customer: { id: string; customerName: string; phone?: string | null; customerCode?: string | null } | null
  createdBy: { id: string; fullName: string } | null
  items: InvoiceItem[]
  payments: Payment[]
  kot?: { id: string; status: string } | null
}

// Real values produced by billing/payment.service.ts: UNPAID (default on create),
// PAID (fully paid), PARTIAL (partial payment recorded), CANCELLED (invoice cancelled).
const PAYMENT_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  PAID: 'success',
  PARTIAL: 'warning',
  UNPAID: 'danger',
  CANCELLED: 'neutral'
}

const formatDate = formatDateTime

export function InvoiceDetailScreen() {
  const { t } = useTranslation()
  const currSym = useBusinessStore(s => s.profile?.currencySymbol ?? '₹')
  const taxModel = useBusinessStore(s => s.profile?.taxModel ?? 'NONE')
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { isModuleEnabled } = useIndustryStore()
  const { hasPermission } = useAuthStore()
  const kotEnabled = isModuleEnabled('kot')
  const canRecordPayment = hasPermission('payments.record')
  const canCancel = hasPermission('billing.cancelInvoice')
  const canReverse = hasPermission('payments.reverse')
  const canPrint = hasPermission('billing.printInvoice')

  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [loading, setLoading] = useState(true)
  const [sendingToKitchen, setSendingToKitchen] = useState(false)

  // Record payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentRef, setPaymentRef] = useState('')
  const [paymentRemarks, setPaymentRemarks] = useState('')
  const [recordingPayment, setRecordingPayment] = useState(false)

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // Reverse payment modal
  const [reversingPaymentId, setReversingPaymentId] = useState<string | null>(null)
  const [reverseReason, setReverseReason] = useState('')

  const [printing, setPrinting] = useState(false)

  // Print preview — shows the rendered HTML before committing to the OS print
  // dialog, instead of printing straight away with no chance to review it.
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewIsReceipt, setPreviewIsReceipt] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)

  async function loadInvoice() {
    if (!id) return
    setLoading(true)
    try {
      const res = await window.api.billing.getInvoice(id)
      if (res.success) setInvoice(res.data as Invoice)
      else toastError('Error', res.error?.message ?? 'Could not load invoice.')
    } catch {
      toastError('Error', 'Could not load invoice.')
    } finally { setLoading(false) }
  }

  useEffect(() => { loadInvoice() }, [id])

  async function handleRecordPayment() {
    if (!invoice) return
    const amount = parseFloat(paymentAmount)
    if (!amount || amount <= 0) { toastError('Invalid Amount', 'Enter a valid payment amount.'); return }
    setRecordingPayment(true)
    try {
      const res = await window.api.payments.record({
        invoiceId: invoice.id,
        paymentMethod,
        amount,
        referenceNumber: paymentRef.trim() || undefined,
        remarks: paymentRemarks.trim() || undefined
      })
      if (res.success) {
        toastSuccess('Payment Recorded', `${formatCurrency(amount)} recorded for ${invoice.invoiceNumber}.`)
        setShowPaymentModal(false)
        setPaymentAmount(''); setPaymentRef(''); setPaymentRemarks('')
        loadInvoice()
      } else {
        toastError('Failed', res.error?.message ?? 'Could not record payment.')
      }
    } catch {
      toastError('Failed', 'Could not record payment.')
    } finally { setRecordingPayment(false) }
  }

  async function handleCancel() {
    if (!invoice || !cancelReason.trim()) { toastError('Reason Required', 'Enter a cancellation reason.'); return }
    setCancelling(true)
    try {
      const res = await window.api.billing.cancelInvoice({ invoiceId: invoice.id, reason: cancelReason.trim() })
      if (res.success) {
        toastSuccess('Cancelled', `Invoice ${invoice.invoiceNumber} has been cancelled.`)
        setShowCancelModal(false)
        loadInvoice()
      } else {
        toastError('Failed', res.error?.message ?? 'Could not cancel invoice.')
      }
    } catch {
      toastError('Failed', 'Could not cancel invoice.')
    } finally { setCancelling(false) }
  }

  async function handleReversePayment() {
    if (!reversingPaymentId || !reverseReason.trim()) { toastError('Reason Required', 'Enter a reversal reason.'); return }
    try {
      const res = await window.api.payments.reverse({ paymentId: reversingPaymentId, reason: reverseReason.trim() })
      if (res.success) {
        toastSuccess('Reversed', 'Payment has been reversed.')
        setReversingPaymentId(null); setReverseReason('')
        loadInvoice()
      } else {
        toastError('Failed', res.error?.message ?? 'Could not reverse payment.')
      }
    } catch {
      toastError('Failed', 'Could not reverse payment.')
    }
  }

  async function handleSendToKitchen() {
    if (!invoice) return
    setSendingToKitchen(true)
    try {
      const res = await api.restaurant.createKOT({ invoiceId: invoice.id })
      if (res.success) {
        toastSuccess('Sent to Kitchen', `KOT created for ${invoice.invoiceNumber}.`)
        loadInvoice()
      } else {
        toastError('Failed', (res.error as { message?: string })?.message ?? 'Could not send to kitchen.')
      }
    } catch {
      toastError('Failed', 'Could not send to kitchen.')
    } finally { setSendingToKitchen(false) }
  }

  async function handleOpenPreview(receipt = false) {
    if (!invoice) return
    setPreviewLoading(true)
    setPreviewIsReceipt(receipt)
    try {
      const res = receipt
        ? await window.api.print.previewReceipt({ invoiceId: invoice.id })
        : await window.api.print.previewInvoice({ invoiceId: invoice.id })
      if (res.success) {
        setPreviewHtml(res.data as string)
      } else {
        toastError('Preview Failed', res.error?.message ?? 'Could not generate preview.')
      }
    } catch {
      toastError('Preview Failed', 'Could not generate preview.')
    } finally { setPreviewLoading(false) }
  }

  async function handlePrintNow() {
    if (!invoice) return
    setPrinting(true)
    try {
      const res = previewIsReceipt
        ? await window.api.print.receipt({ invoiceId: invoice.id })
        : await window.api.print.invoice({ invoiceId: invoice.id })
      if (!res.success) toastError('Print Failed', res.error?.message ?? 'Could not print.')
      else setPreviewHtml(null)
    } catch {
      toastError('Print Failed', 'Could not print.')
    } finally { setPrinting(false) }
  }

  if (loading) return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-64" />
      <Skeleton className="h-32" />
    </div>
  )

  if (!invoice) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3">
      <p className="text-slate-400">{t('billing.invoiceNotFound')}</p>
      <Button size="sm" onClick={() => navigate('/billing')}>{t('billing.backToInvoices')}</Button>
    </div>
  )

  const isCancelled = invoice.status === 'CANCELLED'

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/billing')} className="w-8 h-8 flex items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:text-brand hover:border-brand transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-dark">{invoice.invoiceNumber}</h1>
              <Badge variant={PAYMENT_STATUS_VARIANT[invoice.paymentStatus] ?? 'neutral'} size="sm">{invoice.paymentStatus}</Badge>
              {isCancelled && <Badge variant="neutral" size="sm">CANCELLED</Badge>}
              {invoice.dueDate && invoice.balanceAmount > 0.01 && (
                <Badge variant={new Date(invoice.dueDate) < new Date() ? 'danger' : 'neutral'} size="sm">
                  {new Date(invoice.dueDate) < new Date() ? t('billing.overdueSince', { date: formatDate(invoice.dueDate) }) : t('billing.dueOn', { date: formatDate(invoice.dueDate) })}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{formatDate(invoice.createdAt)}{invoice.createdBy ? ` · ${t('billing.createdBy')} ${invoice.createdBy.fullName}` : ''}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Send to Kitchen — Restaurant template only, RETAIL invoices only, no existing KOT */}
          {kotEnabled && !isCancelled && invoice.invoiceType !== 'RETURN' && !invoice.kot && (
            <Button size="sm" variant="outline" onClick={handleSendToKitchen} loading={sendingToKitchen}>
              <UtensilsCrossed size={14} className="mr-1" /> {t('billing.sendToKitchen')}
            </Button>
          )}
          {kotEnabled && invoice.kot && (
            <span className="text-xs font-medium bg-warning/10 text-warning px-3 py-1.5 rounded-xl border border-warning/20">
              KOT: {invoice.kot.status.replace('_', ' ')}
            </span>
          )}
          {!isCancelled && invoice.balanceAmount > 0.01 && canRecordPayment && (
            <Button size="sm" variant="outline" onClick={() => setShowPaymentModal(true)}>
              <PlusCircle size={14} className="mr-1" /> {t('billing.recordPayment')}
            </Button>
          )}
          {canPrint && (
            <>
              <Button size="sm" variant="outline" onClick={() => handleOpenPreview(false)} loading={previewLoading && !previewIsReceipt}>
                <Printer size={14} className="mr-1" /> {t('billing.print')}
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleOpenPreview(true)} loading={previewLoading && previewIsReceipt}>
                <Receipt size={14} className="mr-1" /> {t('billing.printReceipt')}
              </Button>
            </>
          )}
          {!isCancelled && canCancel && (
            <Button size="sm" variant="danger" onClick={() => setShowCancelModal(true)}>
              <XCircle size={14} className="mr-1" /> {t('billing.cancelInvoice')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Customer info */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase mb-3">{t('billing.billTo')}</p>
          {invoice.customer ? (
            <div>
              <p className="font-semibold text-dark">{invoice.customer.customerName}</p>
              {invoice.customer.phone && <p className="text-sm text-slate-500 mt-1">{invoice.customer.phone}</p>}
              {invoice.customer.customerCode && <p className="text-xs text-slate-400 mt-0.5">{invoice.customer.customerCode}</p>}
            </div>
          ) : <p className="text-slate-400 italic text-sm">{t('billing.walkIn')}</p>}
        </div>

        {/* Totals summary */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase mb-3">{t('billing.summary')}</p>
          <div className="flex justify-between text-sm text-slate-500"><span>{t('billing.subtotal')}</span><span>{formatCurrency(invoice.subtotal)}</span></div>
          {invoice.discountAmount > 0 && <div className="flex justify-between text-sm text-danger"><span>{t('billing.discount')}</span><span>– {formatCurrency(invoice.discountAmount)}</span></div>}
          {splitTaxLines(taxModel, invoice.taxAmount, invoice.gstType).map(line => (
            <div key={line.label} className="flex justify-between text-sm text-slate-500">
              <span>{line.label}</span><span>{formatCurrency(line.amount)}</span>
            </div>
          ))}
          {Math.abs(invoice.roundingAmount) > 0.001 && <div className="flex justify-between text-sm text-slate-400"><span>{t('billing.rounding')}</span><span>{invoice.roundingAmount > 0 ? '+' : ''}{formatCurrency(Math.abs(invoice.roundingAmount))}</span></div>}
          <div className="flex justify-between font-bold text-dark border-t border-slate-100 pt-2"><span>{t('common.total')}</span><span>{formatCurrency(invoice.totalAmount)}</span></div>
          {invoice.paidAmount > 0 && <div className="flex justify-between text-sm text-success"><span>{t('common.paid')}</span><span>{formatCurrency(invoice.paidAmount)}</span></div>}
          {invoice.balanceAmount > 0.01 && <div className="flex justify-between font-semibold text-danger"><span>{t('billing.balanceDue')}</span><span>{formatCurrency(invoice.balanceAmount)}</span></div>}
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-50 dark:border-slate-800">
          <p className="text-sm font-semibold text-dark">{t('billing.items', { count: invoice.items.length })}</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-700">
              <th className="text-left px-5 py-2 text-xs font-semibold text-slate-500 uppercase">{t('billing.product')}</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">{t('billing.qty')}</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">{t('billing.unitPrice')}</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">{t('billing.discount')}</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-slate-500 uppercase">{t('billing.tax')}</th>
              <th className="text-right px-5 py-2 text-xs font-semibold text-slate-500 uppercase">{t('billing.lineTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map(item => (
              <tr key={item.id} className="border-b border-slate-50 dark:border-slate-800">
                <td className="px-5 py-3">
                  <p className="font-medium text-dark">{item.product.productName}</p>
                  {item.product.sku && <p className="text-xs text-slate-400">{item.product.sku}</p>}
                </td>
                <td className="px-4 py-3 text-right text-slate-600">{item.quantity} {item.product.unit}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCurrency(item.unitPrice)}</td>
                <td className="px-4 py-3 text-right text-slate-500">{item.discountAmount > 0 ? `– ${formatCurrency(item.discountAmount)}` : '—'}</td>
                <td className="px-4 py-3 text-right text-slate-500">{item.taxRate > 0 ? `${item.taxRate}%` : '—'}</td>
                <td className="px-5 py-3 text-right font-semibold text-dark">{formatCurrency(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payments */}
      {invoice.payments.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-50 dark:border-slate-800">
            <p className="text-sm font-semibold text-dark dark:text-slate-100">{t('billing.paymentHistory')}</p>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {invoice.payments.map(pmt => (
              <div key={pmt.id} className={cn('flex items-center justify-between px-5 py-3', pmt.isReversed && 'opacity-40')}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-dark">{pmt.paymentMethod}</span>
                    {pmt.isReversed && <Badge variant="danger" size="sm">{t('billing.reversed')}</Badge>}
                    {pmt.referenceNumber && <span className="text-xs text-slate-400">{t('billing.ref')}: {pmt.referenceNumber}</span>}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDate(pmt.paymentDate)}{pmt.recordedBy ? ` · ${pmt.recordedBy.fullName}` : ''}
                  </p>
                  {pmt.remarks && <p className="text-xs text-slate-400 italic">{pmt.remarks}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn('font-semibold', pmt.isReversed ? 'text-slate-400 line-through' : 'text-success')}>
                    {formatCurrency(pmt.amount)}
                  </span>
                  {!pmt.isReversed && !isCancelled && canReverse && (
                    <button onClick={() => { setReversingPaymentId(pmt.id); setReverseReason('') }}
                      className="text-slate-300 hover:text-danger transition-colors">
                      <RotateCcw size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {invoice.notes && (
        <div className="bg-warning/5 border border-warning/20 rounded-2xl px-5 py-4">
          <p className="text-xs font-semibold text-warning uppercase mb-1">{t('billing.notes')}</p>
          <p className="text-sm text-slate-600 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      {/* Attached documents */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
        <DocumentPanel entityType="INVOICE" entityId={invoice.id} />
      </div>

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('billing.recordPayment')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('billing.invoiceNumber')}: <strong className="dark:text-slate-200">{invoice.invoiceNumber}</strong> · {t('billing.outstanding')}: <strong className="text-danger">{formatCurrency(invoice.balanceAmount)}</strong>
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">{t('billing.paymentMethod')}</label>
              <div className="grid grid-cols-3 gap-2">
                {/* CREDIT excluded — recording a payment asserts real money was
                    received, which CREDIT (deferred / no money yet) contradicts */}
                {['CASH', 'UPI', 'CARD', 'WALLET'].map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m)}
                    className={cn('h-9 rounded-lg text-xs font-semibold border transition-colors', paymentMethod === m ? 'bg-brand text-white border-brand' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand')}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">{t('billing.amountLabel', { symbol: currSym })}</label>
              <input type="number" min="0.01" step="0.01" value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                placeholder={invoice.balanceAmount.toFixed(2)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            {(paymentMethod === 'UPI' || paymentMethod === 'CARD') && (
              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">{t('billing.referenceNumber')}</label>
                <input value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="e.g. UTR / approval code"
                  className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">{t('billing.remarks')}</label>
              <input value={paymentRemarks} onChange={e => setPaymentRemarks(e.target.value)} placeholder="Optional note"
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowPaymentModal(false)}>{t('common.cancel')}</Button>
              <Button className="flex-1" onClick={handleRecordPayment} loading={recordingPayment}>{t('billing.recordPayment')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Invoice Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('billing.cancelInvoice')}</h2>
            <div className="p-4 bg-danger/5 border border-danger/20 rounded-xl text-sm text-slate-600 dark:text-slate-300">
              <p className="font-semibold text-danger mb-1">{t('billing.cannotUndo')}</p>
              <p>{t('billing.cancelWarning')}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">{t('billing.cancellationReason')} *</label>
              <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} placeholder={t('billing.cancellationReasonPlaceholder')}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-danger resize-none" />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setShowCancelModal(false)}>{t('billing.goBack')}</Button>
              <Button variant="danger" className="flex-1" onClick={handleCancel} loading={cancelling}>{t('billing.confirmCancel')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Reverse Payment Modal */}
      {reversingPaymentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
            <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('billing.reversePayment')}</h2>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">{t('billing.reverseReason')} *</label>
              <input value={reverseReason} onChange={e => setReverseReason(e.target.value)} placeholder={t('billing.reverseReasonPlaceholder')}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setReversingPaymentId(null); setReverseReason('') }}>{t('common.cancel')}</Button>
              <Button variant="danger" className="flex-1" onClick={handleReversePayment}>{t('billing.reverse')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Print Preview Modal — review layout/totals before committing to the OS print dialog */}
      {previewHtml !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="text-base font-bold text-dark dark:text-slate-100">
                {previewIsReceipt ? t('billing.printReceipt') : t('billing.print')} — Preview
              </h2>
              <button onClick={() => setPreviewHtml(null)} className="text-slate-400 hover:text-danger transition-colors">
                <XCircle size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden bg-slate-100 dark:bg-slate-950 p-3">
              <iframe title="Print preview" srcDoc={previewHtml} className="w-full h-full bg-white rounded-lg border border-slate-200" style={{ minHeight: '60vh' }} />
            </div>
            <div className="flex justify-end gap-3 px-5 py-4 border-t border-slate-100 dark:border-slate-700">
              <Button variant="outline" onClick={() => setPreviewHtml(null)}>{t('common.cancel')}</Button>
              <Button onClick={handlePrintNow} loading={printing}>
                <Printer size={14} className="mr-1" /> {t('billing.print')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
