import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Receipt, PlusCircle, XCircle, RotateCcw, Printer } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Modal } from '@shared/ui/molecules/Modal'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { useBusinessStore } from '@app/store/business.store'
import { formatDate, formatDateTime } from '@shared/utils/locale.util'
import { formatCurrency } from '@shared/utils/currency.util'
import { cn } from '@shared/utils/cn'

interface Supplier { id: string; supplierName: string; supplierCode: string; phone?: string | null; email?: string | null; isMsmeRegistered?: boolean }
interface Product { id: string; productName: string; sku?: string | null; unit: string }
interface BillItem {
  id: string; quantity: number; unitCost: number; discountAmount: number; taxRate: number; total: number
  product: Product | null
  serviceDescription: string | null
  serviceCategory: { id: string; categoryName: string } | null
}
interface SupplierPaymentRow {
  id: string; paymentMethod: string; amount: number; referenceNumber?: string | null
  remarks?: string | null; isReversed: boolean; paymentDate: string
}
interface Bill {
  id: string; billNumber: string; status: string
  billDate: string; dueDate?: string | null; notes?: string | null
  subtotal: number; discountAmount: number; taxAmount: number; totalAmount: number
  paidAmount: number; balanceAmount: number
  supplier: Supplier
  purchaseOrder?: { id: string; poNumber: string } | null
  items: BillItem[]
  payments: SupplierPaymentRow[]
}

const STATUS_VARIANT: Record<string, 'neutral' | 'brand' | 'success' | 'danger' | 'warning'> = {
  OPEN: 'warning',
  PARTIALLY_PAID: 'brand',
  PAID: 'success',
  VOID: 'danger'
}

const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'BANK_TRANSFER', 'CHEQUE']

export function BillDetailScreen() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const currSym = useBusinessStore(s => s.profile?.currencySymbol ?? '₹')

  const [bill, setBill] = useState<Bill | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentRef, setPaymentRef] = useState('')
  const [paymentRemarks, setPaymentRemarks] = useState('')
  const [recordingPayment, setRecordingPayment] = useState(false)
  // Phase 62 — TDS. deductTds is a manual owner decision (applicability
  // genuinely depends on vendor PAN status, cumulative payments already
  // made this year, exemption certificates — none of which this app
  // tracks), but the suggested amount is auto-computed from the
  // configurable threshold/rate as soon as the payment amount is entered.
  const [deductTds, setDeductTds] = useState(false)
  const [tdsSection, setTdsSection] = useState('')
  const [tdsAmount, setTdsAmount] = useState('')
  const [tdsSuggestion, setTdsSuggestion] = useState<{ applicable: boolean; suggestedAmount: number; thresholdAmount: number; ratePercent: number } | null>(null)

  const [voidOpen, setVoidOpen] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)

  const [reversingId, setReversingId] = useState<string | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const [reversing, setReversing] = useState(false)

  const canRecordPayment = hasPermission('supplierPayments.record')
  const canReversePayment = hasPermission('supplierPayments.reverse')
  const canVoid = hasPermission('bills.void')
  const [printing, setPrinting] = useState(false)

  const loadBill = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await window.api.bills.get(id)
      if (res.success) setBill(res.data as Bill)
      else setError(res.error?.message ?? t('bills.billNotFound'))
    } catch {
      setError(t('common.error'))
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [id, toastError, t])

  useEffect(() => { loadBill() }, [loadBill])

  // Phase 62 — TDS suggestion, refetched from the configurable threshold/
  // rate as soon as a valid amount is entered. Purely informational until
  // the owner actually checks "Deduct TDS".
  useEffect(() => {
    const amount = parseFloat(paymentAmount)
    if (!showPaymentModal || !amount || amount <= 0) { setTdsSuggestion(null); return }
    let cancelled = false
    window.api.supplierPayments.suggestTds({ amount }).then((res) => {
      if (!cancelled && res.success) setTdsSuggestion(res.data as typeof tdsSuggestion)
    })
    return () => { cancelled = true }
  }, [paymentAmount, showPaymentModal])

  function handleToggleDeductTds(checked: boolean) {
    setDeductTds(checked)
    if (checked && tdsSuggestion?.applicable && !tdsAmount) {
      setTdsAmount(String(tdsSuggestion.suggestedAmount))
    }
  }

  async function handleRecordPayment() {
    if (!bill) return
    const amount = parseFloat(paymentAmount)
    if (!amount || amount <= 0) { toastError('Invalid Amount', 'Enter a valid payment amount.'); return }
    const parsedTdsAmount = deductTds ? parseFloat(tdsAmount) || 0 : 0
    if (parsedTdsAmount > amount) { toastError('Invalid TDS Amount', 'TDS amount cannot exceed the payment amount.'); return }
    setRecordingPayment(true)
    try {
      const res = await window.api.supplierPayments.record({
        billId: bill.id,
        paymentMethod,
        amount,
        referenceNumber: paymentRef.trim() || undefined,
        remarks: paymentRemarks.trim() || undefined,
        tdsAmount: parsedTdsAmount,
        tdsSection: deductTds ? (tdsSection.trim() || undefined) : undefined
      })
      if (res.success) {
        toastSuccess('Payment Recorded', `${formatCurrency(amount)} recorded for ${bill.billNumber}.`)
        setShowPaymentModal(false)
        setPaymentAmount(''); setPaymentRef(''); setPaymentRemarks('')
        setDeductTds(false); setTdsSection(''); setTdsAmount(''); setTdsSuggestion(null)
        loadBill()
      } else {
        toastError('Failed', res.error?.message ?? 'Could not record payment.')
      }
    } catch {
      toastError('Failed', 'Could not record payment.')
    } finally { setRecordingPayment(false) }
  }

  async function handleReverse() {
    if (!reversingId || !reverseReason.trim()) { toastError('Reason Required', 'Enter a reason for reversal.'); return }
    setReversing(true)
    try {
      const res = await window.api.supplierPayments.reverse({ paymentId: reversingId, reason: reverseReason.trim() })
      if (res.success) {
        toastSuccess('Reversed', 'Payment has been reversed.')
        setReversingId(null); setReverseReason('')
        loadBill()
      } else {
        toastError('Failed', res.error?.message ?? 'Could not reverse payment.')
      }
    } catch {
      toastError('Failed', 'Could not reverse payment.')
    } finally { setReversing(false) }
  }

  async function handleVoid() {
    if (!bill || !voidReason.trim()) { toastError('Reason Required', 'Enter a void reason.'); return }
    setVoiding(true)
    try {
      const res = await window.api.bills.void({ id: bill.id, reason: voidReason.trim() })
      if (res.success) {
        toastSuccess('Bill Voided', `${bill.billNumber} has been voided.`)
        setVoidOpen(false)
        loadBill()
      } else {
        toastError('Failed', res.error?.message ?? 'Could not void this bill.')
      }
    } catch {
      toastError('Failed', 'Could not void this bill.')
    } finally { setVoiding(false) }
  }

  async function handlePrint() {
    if (!bill) return
    setPrinting(true)
    try {
      const res = await window.api.bills.print(bill.id)
      if (!res.success) toastError('Failed', res.error?.message ?? 'Could not print this bill.')
    } catch {
      toastError('Failed', 'Could not print this bill.')
    } finally { setPrinting(false) }
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

  if (error || !bill) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
        <Receipt size={40} className="text-slate-200 mb-4" />
        <p className="text-slate-500 dark:text-slate-400 text-sm">{error ?? t('bills.billNotFound')}</p>
        <button onClick={() => navigate('/bills')} className="mt-4 text-brand text-sm font-medium hover:underline">
          {t('bills.backToBills')}
        </button>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/bills')}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
            <Receipt size={20} className="text-brand" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-dark dark:text-slate-100 font-mono">{bill.billNumber}</h1>
              <Badge variant={STATUS_VARIANT[bill.status] ?? 'neutral'} size="sm">{bill.status.replace(/_/g, ' ')}</Badge>
            </div>
            <p className="text-sm text-slate-400">{formatDate(bill.billDate)}{bill.purchaseOrder && <> · {t('bills.linkedToPO', { poNumber: bill.purchaseOrder.poNumber })}</>}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={handlePrint} loading={printing}>
            <Printer size={14} className="me-1.5" /> {t('billing.print')}
          </Button>
          {bill.status !== 'VOID' && bill.balanceAmount > 0.01 && canRecordPayment && (
            <Button size="sm" onClick={() => { setPaymentAmount(bill.balanceAmount.toFixed(2)); setShowPaymentModal(true) }}>
              <PlusCircle size={14} className="me-1.5" /> {t('bills.recordPayment')}
            </Button>
          )}
          {bill.status !== 'VOID' && canVoid && (
            <Button variant="danger" size="sm" onClick={() => setVoidOpen(true)}>
              <XCircle size={14} className="me-1.5" /> {t('bills.voidBill')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card padding="md" className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('purchaseOrders.supplier')}</p>
          <p className="text-sm font-semibold text-dark dark:text-slate-100">{bill.supplier.supplierName}</p>
          <p className="text-xs text-slate-400">{bill.supplier.supplierCode}</p>
          {bill.supplier.phone && <p className="text-xs text-slate-500 dark:text-slate-400">{bill.supplier.phone}</p>}
        </Card>
        <Card padding="md" className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('bills.billDetails')}</p>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">{t('bills.billDate')}</span>
            <span className="text-dark dark:text-slate-100">{formatDate(bill.billDate)}</span>
          </div>
          {bill.dueDate && (
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 dark:text-slate-400">{t('bills.dueDate')}</span>
              <span className="flex items-center gap-1.5">
                <span className="text-dark dark:text-slate-100">{formatDate(bill.dueDate)}</span>
                {bill.supplier.isMsmeRegistered && <Badge variant="brand" size="sm">{t('bills.msmeBadge')}</Badge>}
              </span>
            </div>
          )}
          {bill.dueDate && bill.supplier.isMsmeRegistered && (
            <p className="text-[11px] text-slate-400 text-end">{t('bills.msmeDueDateNote')}</p>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 dark:text-slate-400">{t('bills.balanceDue')}</span>
            <span className={cn('font-semibold', bill.balanceAmount > 0 ? 'text-danger' : 'text-success')}>{formatCurrency(bill.balanceAmount)}</span>
          </div>
          {bill.notes && (
            <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-400 mb-0.5">{t('common.notes')}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{bill.notes}</p>
            </div>
          )}
        </Card>
      </div>

      <Card padding="none">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <p className="text-sm font-semibold text-dark dark:text-slate-100">{t('bills.billItems')}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                <th className="px-5 py-3 text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('reports.col.item')}</th>
                <th className="px-5 py-3 text-end text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('billing.qty')}</th>
                <th className="px-5 py-3 text-end text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('purchaseOrders.unitCost')}</th>
                <th className="px-5 py-3 text-end text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('purchaseOrders.taxPercent')}</th>
                <th className="px-5 py-3 text-end text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('common.total')}</th>
              </tr>
            </thead>
            <tbody>
              {bill.items.map((item) => (
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
                  <td className="px-5 py-3 text-end text-slate-700 dark:text-slate-300">{formatCurrency(item.unitCost)}</td>
                  <td className="px-5 py-3 text-end text-slate-500 dark:text-slate-400">{item.taxRate > 0 ? `${item.taxRate}%` : '—'}</td>
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
              <span>{formatCurrency(bill.subtotal)}</span>
            </div>
            {bill.discountAmount > 0 && (
              <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
                <span>{t('bills.discount')}</span>
                <span>-{formatCurrency(bill.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
              <span>{t('billing.tax')}</span>
              <span>{formatCurrency(bill.taxAmount)}</span>
            </div>
            <div className="flex justify-between text-sm font-bold text-dark dark:text-slate-100 border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-1.5">
              <span>{t('common.total')}</span>
              <span>{formatCurrency(bill.totalAmount)}</span>
            </div>
            <div className="flex justify-between text-sm text-success">
              <span>{t('bills.paid')}</span>
              <span>{formatCurrency(bill.paidAmount)}</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Payments made against this bill */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <p className="text-sm font-semibold text-dark dark:text-slate-100">{t('bills.paymentsMade')}</p>
        </div>
        {bill.payments.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-400 text-center">{t('bills.noPaymentsYet')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                  <th className="px-5 py-3 text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('common.date')}</th>
                  <th className="px-5 py-3 text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('bills.paymentMethod')}</th>
                  <th className="px-5 py-3 text-start text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('bills.referenceNumber')}</th>
                  <th className="px-5 py-3 text-end text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('expenses.amount')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {bill.payments.map(p => (
                  <tr key={p.id} className={cn('border-b border-slate-50 dark:border-slate-800 last:border-0', p.isReversed && 'opacity-50')}>
                    <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(p.paymentDate)}</td>
                    <td className="px-5 py-3"><Badge variant="neutral" size="sm">{p.paymentMethod.replace('_', ' ')}</Badge></td>
                    <td className="px-5 py-3 text-xs text-slate-400">{p.referenceNumber ?? '—'}</td>
                    <td className="px-5 py-3 text-end">
                      <span className={cn('font-semibold', p.isReversed ? 'text-slate-400 line-through' : 'text-success')}>{formatCurrency(p.amount)}</span>
                      {p.isReversed && <span className="ms-2 text-xs text-danger font-semibold">REVERSED</span>}
                    </td>
                    <td className="px-5 py-3 text-end">
                      {!p.isReversed && canReversePayment && (
                        <button onClick={() => { setReversingId(p.id); setReverseReason('') }}
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
          </div>
        )}
      </Card>

      {/* Record Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('bills.recordPayment')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('bills.billNumber')}: <strong className="dark:text-slate-200">{bill.billNumber}</strong> · {t('bills.outstanding')}: <strong className="text-danger">{formatCurrency(bill.balanceAmount)}</strong>
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">{t('bills.paymentMethod')}</label>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button key={m} onClick={() => setPaymentMethod(m)}
                    className={cn('h-9 rounded-lg text-xs font-semibold border transition-colors', paymentMethod === m ? 'bg-brand text-white border-brand' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand')}>
                    {m.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">{t('bills.amountLabel', { symbol: currSym })}</label>
              <input type="number" min="0.01" step="0.01" value={paymentAmount}
                onChange={e => setPaymentAmount(e.target.value)}
                placeholder={bill.balanceAmount.toFixed(2)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={deductTds} onChange={e => handleToggleDeductTds(e.target.checked)} className="w-4 h-4 rounded accent-brand" />
                <span className="text-sm font-medium text-dark dark:text-slate-100">{t('bills.deductTds')}</span>
              </label>
              {tdsSuggestion?.applicable && !deductTds && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t('bills.tdsSuggestionNote', { amount: formatCurrency(tdsSuggestion.suggestedAmount), rate: tdsSuggestion.ratePercent, threshold: formatCurrency(tdsSuggestion.thresholdAmount) })}
                </p>
              )}
              {deductTds && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('bills.tdsSection')}</label>
                    <input value={tdsSection} onChange={e => setTdsSection(e.target.value)} placeholder="194C"
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('bills.tdsAmountLabel', { symbol: currSym })}</label>
                    <input type="number" min="0" step="0.01" value={tdsAmount} onChange={e => setTdsAmount(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">{t('bills.referenceNumber')}</label>
              <input value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder={t('bills.referencePlaceholder')}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">{t('bills.remarks')}</label>
              <input value={paymentRemarks} onChange={e => setPaymentRemarks(e.target.value)} placeholder={t('bills.remarksPlaceholder')}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setShowPaymentModal(false); setDeductTds(false); setTdsSection(''); setTdsAmount('') }}>{t('common.cancel')}</Button>
              <Button className="flex-1" onClick={handleRecordPayment} loading={recordingPayment}>{t('bills.recordPayment')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Reverse payment modal */}
      {reversingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
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

      {/* Void dialog */}
      <Modal
        open={voidOpen}
        onClose={() => { setVoidOpen(false); setVoidReason('') }}
        title={t('bills.voidBillTitle')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => { setVoidOpen(false); setVoidReason('') }} disabled={voiding}>{t('bills.goBack')}</Button>
            <Button size="sm" className="bg-danger hover:bg-danger/90 text-white border-danger" onClick={handleVoid} loading={voiding} disabled={!voidReason.trim()}>
              {t('bills.voidBill')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {bill.paidAmount > 0 ? t('bills.voidBillBlockedMsg') : t('bills.voidBillMsg')}
          </p>
          {bill.paidAmount === 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">{t('bills.voidReason')} *</label>
              <input
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Entered in error, duplicate bill"
                className="w-full h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand"
                autoFocus
              />
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
