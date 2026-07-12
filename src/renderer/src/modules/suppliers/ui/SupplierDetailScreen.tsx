import React, { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Building2, Phone, Mail, MapPin, TrendingUp, TrendingDown, PlusCircle, X } from 'lucide-react'
import { useAuthStore } from '@app/store/auth.store'
import { api } from '@renderer/services/ipc-client'
import { DocumentPanel } from '@renderer/modules/documents/ui/DocumentPanel'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'

interface Supplier {
  id: string; supplierCode?: string | null; supplierName: string
  phone?: string | null; email?: string | null
  address?: string | null; city?: string | null; state?: string | null; country?: string | null
  taxNumber?: string | null; notes?: string | null; isActive: boolean
}

interface LedgerEntry {
  id: string; createdAt: string; referenceType: string; remarks?: string | null
  debitAmount: number; creditAmount: number; balance: number
}

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'UPI', 'CARD', 'OTHER'] as const

export function SupplierDetailScreen() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { hasPermission } = useAuthStore()
  const [supplier, setSupplier] = useState<Supplier | null>(null)
  const [entries, setEntries] = useState<LedgerEntry[]>([])
  const [outstanding, setOutstanding] = useState(0)
  const [loading, setLoading] = useState(true)
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ledgerError, setLedgerError] = useState<string | null>(null)

  const [showPayment, setShowPayment] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<string>('CASH')
  const [payRef, setPayRef] = useState('')
  const [payRemarks, setPayRemarks] = useState('')
  const [paying, setPaying] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  const canViewLedger = hasPermission('suppliers.viewLedger')
  const canPay = hasPermission('suppliers.recordPayment')

  const loadSupplier = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await api.suppliers.get(id)
      if (res.success) setSupplier(res.data as Supplier)
      else setError(res.error?.message ?? t('suppliers.notFound'))
    } finally { setLoading(false) }
  }, [id])

  const loadLedger = useCallback(async () => {
    if (!id || !canViewLedger) return
    setLedgerLoading(true)
    setLedgerError(null)
    try {
      const res = await api.suppliers.getLedger(id)
      if (res.success) {
        const d = res.data as { ledger: LedgerEntry[]; outstanding: number }
        setEntries(d.ledger ?? [])
        setOutstanding(d.outstanding ?? 0)
      } else {
        setLedgerError(res.error?.message ?? t('common.error'))
      }
    } catch {
      setLedgerError(t('common.error'))
    } finally { setLedgerLoading(false) }
  }, [id, canViewLedger, t])

  useEffect(() => {
    loadSupplier()
    loadLedger()
  }, [loadSupplier, loadLedger])

  async function handleRecordPayment(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setPayError(null)
    const amount = parseFloat(payAmount)
    if (!payAmount || isNaN(amount) || amount <= 0) {
      setPayError(t('billing.invalidAmount'))
      return
    }
    setPaying(true)
    try {
      const res = await api.suppliers.recordPayment({
        supplierId: id,
        amount,
        paymentMethod: payMethod,
        referenceNumber: payRef.trim() || undefined,
        remarks: payRemarks.trim() || undefined
      })
      if (res.success) {
        setShowPayment(false)
        setPayAmount(''); setPayRef(''); setPayRemarks(''); setPayMethod('CASH')
        loadLedger()
      } else {
        setPayError(res.error?.message ?? t('common.error'))
      }
    } finally { setPaying(false) }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-slate-100 dark:bg-slate-800 rounded-lg animate-pulse" />
        <div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
        <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
      </div>
    )
  }

  if (error || !supplier) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
        <Building2 size={40} className="text-slate-200 mb-4" />
        <p className="text-slate-500 dark:text-slate-400 text-sm">{error ?? t('suppliers.notFound')}</p>
        <button onClick={() => navigate('/suppliers')} className="mt-4 text-brand text-sm font-medium hover:underline">
          {t('suppliers.backToSuppliers')}
        </button>
      </div>
    )
  }

  const location = [supplier.city, supplier.state, supplier.country].filter(Boolean).join(', ')

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/suppliers')}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
            <Building2 size={20} className="text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark dark:text-slate-100">{supplier.supplierName}</h1>
            <p className="text-sm text-slate-400">{supplier.supplierCode ?? t('suppliers.noCode')}</p>
          </div>
        </div>
        {!supplier.isActive && (
          <Badge variant="neutral" size="sm" className="ml-auto">{t('suppliers.archived')}</Badge>
        )}
        {canPay && supplier.isActive && outstanding > 0 && (
          <button
            onClick={() => setShowPayment(true)}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors"
          >
            <PlusCircle size={15} /> {t('suppliers.recordPayment')}
          </button>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card padding="md" className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('suppliers.contact')}</p>
          {supplier.phone && (
            <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <Phone size={14} className="text-slate-400 shrink-0" /><span>{supplier.phone}</span>
            </div>
          )}
          {supplier.email && (
            <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <Mail size={14} className="text-slate-400 shrink-0" /><span>{supplier.email}</span>
            </div>
          )}
          {(supplier.address || location) && (
            <div className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
              <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
              <div>
                {supplier.address && <p>{supplier.address}</p>}
                {location && <p className="text-slate-500 dark:text-slate-400">{location}</p>}
              </div>
            </div>
          )}
          {!supplier.phone && !supplier.email && !supplier.address && (
            <p className="text-sm text-slate-300">{t('suppliers.noContactDetails')}</p>
          )}
        </Card>

        <Card padding="md" className="space-y-3">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('suppliers.account')}</p>
          {supplier.taxNumber && (
            <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <span className="text-xs text-slate-400 font-medium w-14">{t('suppliers.taxNo')}</span>
              <span>{supplier.taxNumber}</span>
            </div>
          )}
          {canViewLedger && (
            <div className="flex items-center gap-2">
              {outstanding > 0 ? (
                <TrendingUp size={14} className="text-danger shrink-0" />
              ) : (
                <TrendingDown size={14} className="text-success shrink-0" />
              )}
              <span className="text-sm text-slate-600 dark:text-slate-300">{t('suppliers.balancePayable')}</span>
              <span className={`ml-auto text-sm font-semibold ${outstanding > 0 ? 'text-danger' : 'text-success'}`}>
                {outstanding > 0 ? formatCurrency(outstanding) : outstanding < 0 ? `${t('suppliers.advance')} ${formatCurrency(Math.abs(outstanding))}` : '—'}
              </span>
            </div>
          )}
          {supplier.notes && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-400 mb-1">{t('suppliers.notes')}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{supplier.notes}</p>
            </div>
          )}
        </Card>
      </div>

      {/* Ledger */}
      {canViewLedger && (
        <Card padding="none">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-dark dark:text-slate-100">{t('suppliers.supplierLedger')}</p>
              <p className="text-xs text-slate-400 mt-0.5">{t('suppliers.ledgerHint')}</p>
            </div>
            {outstanding !== 0 && (
              <div className={`text-sm font-bold px-3 py-1 rounded-lg ${outstanding > 0 ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'}`}>
                {outstanding > 0 ? `${t('suppliers.payable')}: ${formatCurrency(outstanding)}` : `${t('suppliers.advance')}: ${formatCurrency(Math.abs(outstanding))}`}
              </div>
            )}
          </div>

          {ledgerLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />
              ))}
            </div>
          ) : ledgerError ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <p className="text-sm text-danger">{ledgerError}</p>
              <button onClick={loadLedger} className="text-sm text-brand hover:underline">{t('common.refresh')}</button>
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-sm text-slate-400">{t('suppliers.noTransactions')}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('common.date')}</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('common.reference')}</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('common.debit')}</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('common.credit')}</th>
                    <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">{t('common.balance')}</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDate(entry.createdAt)}
                      </td>
                      <td className="px-5 py-3 text-slate-700 dark:text-slate-300">{entry.remarks ?? entry.referenceType}</td>
                      <td className="px-5 py-3 text-right text-danger font-medium">
                        {entry.debitAmount > 0 ? entry.debitAmount.toFixed(2) : '—'}
                      </td>
                      <td className="px-5 py-3 text-right text-success font-medium">
                        {entry.creditAmount > 0 ? entry.creditAmount.toFixed(2) : '—'}
                      </td>
                      <td className={`px-5 py-3 text-right font-semibold ${entry.balance > 0 ? 'text-danger' : entry.balance < 0 ? 'text-success' : 'text-slate-500 dark:text-slate-400'}`}>
                        {entry.balance.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Record Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowPayment(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-semibold text-dark dark:text-slate-100">{t('suppliers.recordPaymentTitle')}</h2>
              <button onClick={() => setShowPayment(false)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleRecordPayment} className="px-6 py-5 space-y-4">
              <div>
                <p className="text-xs text-slate-400 mb-1">{t('suppliers.supplierName')}</p>
                <p className="text-sm font-semibold text-dark dark:text-slate-100">{supplier.supplierName}</p>
                {outstanding > 0 && (
                  <p className="text-xs text-danger mt-0.5">{t('suppliers.balancePayableLower')}: {formatCurrency(outstanding)}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">{t('common.amount')} <span className="text-danger">*</span></label>
                <input
                  type="number" step="0.01" min="0.01" value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder="0.00" required autoFocus
                />
              </div>

              <Select label={t('suppliers.paymentMethod')} required value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                {PAYMENT_METHODS.map(m => (
                  <option key={m} value={m}>{m.replace('_', ' ')}</option>
                ))}
              </Select>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">{t('suppliers.referenceNo')}</label>
                <input type="text" value={payRef} onChange={e => setPayRef(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder={t('common.optional')} />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">{t('common.notes')}</label>
                <input type="text" value={payRemarks} onChange={e => setPayRemarks(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder={t('common.optional')} />
              </div>

              {payError && (
                <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">{payError}</p>
              )}

              <p className="text-xs text-slate-400">{t('suppliers.paymentDisclaimer')}</p>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPayment(false)}
                  className="flex-1 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={paying}
                  className="flex-1 bg-brand text-white rounded-lg px-4 py-2 text-sm font-semibold hover:bg-brand/90 disabled:opacity-50 transition-colors">
                  {paying ? t('suppliers.recording') : t('suppliers.recordPayment')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attached documents */}
      <Card padding="lg">
        <DocumentPanel entityType="SUPPLIER" entityId={supplier.id} />
      </Card>
    </div>
  )
}
