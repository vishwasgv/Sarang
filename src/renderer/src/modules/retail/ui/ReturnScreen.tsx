import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { RotateCcw, Search, RefreshCw, XCircle, CheckCircle2, Minus, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'
import { formatCurrency } from '@shared/utils/currency.util'
import { Card } from '@shared/ui/molecules/Card'
import { useNotificationStore } from '@app/store/notification.store'

interface InvoiceItem {
  id: string
  productId: string
  productName: string
  quantity: number
  unitPrice: number
  product: { unit: string }
}

interface Invoice {
  id: string
  invoiceNumber: string
  invoiceDate: string
  totalAmount: number
  customer?: { customerName: string } | null
  items: InvoiceItem[]
}

interface ReturnItem {
  productId: string
  productName: string
  unit: string
  maxQty: number
  returnQty: number
}

export function ReturnScreen() {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([])
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ invoiceNumber: string } | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function handleSearch() {
    if (!invoiceNumber.trim()) return
    setSearching(true)
    setSearchError(null)
    setInvoice(null)
    setReturnItems([])

    try {
      // listInvoices only returns a lightweight { id } per item (for list-view
      // performance) — it cannot supply productName/unit/quantity. Resolve the
      // matching invoice's id here, then fetch the full record via getInvoice(),
      // which eager-loads product.unit and carries productName/quantity directly
      // on InvoiceItem.
      const searchRes = await api.billing.listInvoices({ search: invoiceNumber.trim() })
      if (!searchRes.success || !searchRes.data) {
        setSearchError('Could not search invoices.')
        return
      }
      const searchData = searchRes.data as { invoices: Array<{ id: string; invoiceNumber: string }> }
      const match = searchData.invoices?.find(i => i.invoiceNumber === invoiceNumber.trim())
      if (!match) {
        setSearchError('Invoice not found or cannot be returned.')
        return
      }

      const res = await api.billing.getInvoice(match.id)
      if (!res.success || !res.data) {
        setSearchError('Invoice not found or cannot be returned.')
        return
      }
      const found = res.data as Invoice

      // Sum quantities already returned across prior return transactions for
      // this invoice, so "Max Return" reflects what's actually still
      // returnable — without this, the same items could be returned again
      // on a second visit (the backend now rejects it, but the UI would let
      // a cashier select the full original quantity again and only find out
      // it's rejected after submitting).
      const priorRes = await api.returns.list({ originalInvoiceId: found.id })
      if (!priorRes.success || !priorRes.data) {
        // Do NOT fall through and treat this invoice as if it had zero prior
        // returns — that would silently defeat the double-return guard above
        // by letting a cashier select the full original quantity again.
        // Block the return entirely until the prior-returns lookup succeeds,
        // and do not populate invoice/returnItems so the selection UI can't render.
        setSearchError('Could not verify prior returns for this invoice. Please try again before processing a return.')
        toastError(t('common.error'), 'Could not verify prior returns for this invoice.')
        return
      }
      const alreadyReturned = new Map<string, number>()
      const priorReturns = priorRes.data as Array<{ items: Array<{ productId: string; quantity: number }> }>
      for (const pr of priorReturns) {
        for (const it of pr.items) {
          alreadyReturned.set(it.productId, (alreadyReturned.get(it.productId) ?? 0) + it.quantity)
        }
      }

      setInvoice(found)
      setReturnItems(found.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        unit: item.product.unit,
        maxQty: Math.max(0, item.quantity - (alreadyReturned.get(item.productId) ?? 0)),
        returnQty: 0
      })))
    } catch {
      setSearchError('Could not search invoices. Please try again.')
      toastError(t('common.error'), t('common.error'))
    } finally {
      setSearching(false)
    }
  }

  function updateQty(productId: string, delta: number) {
    setReturnItems(prev => prev.map(item =>
      item.productId === productId
        ? { ...item, returnQty: Math.max(0, Math.min(item.maxQty, item.returnQty + delta)) }
        : item
    ))
  }

  async function handleReturn() {
    if (!invoice) return
    const selected = returnItems.filter(i => i.returnQty > 0)
    if (!selected.length) { setSubmitError('Select at least one item to return.'); return }
    if (!reason.trim()) { setSubmitError('Return reason is required.'); return }

    setSubmitting(true)
    setSubmitError(null)
    const res = await api.returns.create({
      originalInvoiceId: invoice.id,
      items: selected.map(i => ({ productId: i.productId, quantity: i.returnQty })),
      reason: reason.trim()
    })
    setSubmitting(false)
    if (res.success && res.data) {
      setResult(res.data as { invoiceNumber: string })
    } else {
      setSubmitError((res.error as { message?: string })?.message ?? 'Could not process return.')
    }
  }

  function reset() {
    setInvoiceNumber(''); setInvoice(null); setReturnItems([])
    setReason(''); setResult(null); setSubmitError(null); setSearchError(null)
  }

  // Result screen
  if (result) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card padding="lg" className="text-center space-y-4">
          <CheckCircle2 size={40} className="text-success mx-auto" />
          <h3 className="text-base font-bold text-dark dark:text-slate-100">{t('returns.returnProcessed')}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('returns.returnProcessedMsg', { number: result.invoiceNumber })}</p>
          <button onClick={reset}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors mx-auto">
            <RotateCcw size={14} /> {t('returns.processAnother')}
          </button>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('returns.processReturn')}</h2>
        <p className="text-sm text-slate-400">{t('returns.findInvoice')}</p>
      </div>

      {/* Invoice search */}
      <Card padding="lg" className="space-y-3">
        <label className="text-sm font-semibold text-dark dark:text-slate-100 block">{t('returns.invoiceNumberLabel')}</label>
        <div className="flex gap-2">
          <input
            value={invoiceNumber}
            onChange={e => setInvoiceNumber(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder={t('returns.searchPlaceholder')}
            className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-brand"
          />
          <button onClick={handleSearch} disabled={searching || !invoiceNumber.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
            {searching ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
            {t('common.search')}
          </button>
        </div>
        {searchError && (
          <div className="flex items-center gap-2 text-sm text-danger">
            <XCircle size={14} />{searchError}
          </div>
        )}
      </Card>

      {/* Invoice found */}
      {invoice && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-semibold text-dark dark:text-slate-100">{invoice.invoiceNumber}</span>
              <span className="text-slate-500 dark:text-slate-400">{new Date(invoice.invoiceDate).toLocaleDateString()}</span>
            </div>
            {invoice.customer && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('returns.customer')}: {invoice.customer.customerName}</p>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400">{t('returns.total')}: {formatCurrency(invoice.totalAmount)}</p>
          </div>

          <Card padding="none" className="overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
              <p className="text-sm font-semibold text-dark dark:text-slate-100">{t('returns.selectItems')}</p>
            </div>
            <div className="divide-y divide-slate-50">
              {returnItems.map(item => (
                <div key={item.productId} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-dark dark:text-slate-100">{item.productName}</p>
                    <p className="text-xs text-slate-400">{t('returns.maxReturn')}: {item.maxQty} {item.unit}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => updateQty(item.productId, -1)}
                      disabled={item.returnQty === 0}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-brand hover:text-brand transition-colors disabled:opacity-30">
                      <Minus size={12} />
                    </button>
                    <span className={cn('w-8 text-center text-sm font-semibold', item.returnQty > 0 ? 'text-brand' : 'text-slate-300')}>
                      {item.returnQty}
                    </span>
                    <button onClick={() => updateQty(item.productId, 1)}
                      disabled={item.returnQty >= item.maxQty}
                      className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-brand hover:text-brand transition-colors disabled:opacity-30">
                      <Plus size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">{t('returns.reason')} *</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={2}
              placeholder={t('returns.returnReasonPlaceholder')}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:border-brand resize-none"
            />
          </div>

          {submitError && (
            <div className="bg-danger/5 border border-danger/20 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-danger">
              <XCircle size={14} />{submitError}
            </div>
          )}

          <div className="flex justify-between">
            <button onClick={reset}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-500 dark:text-slate-400 hover:border-slate-300 transition-colors">
              {t('common.cancel')}
            </button>
            <button onClick={handleReturn} disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
              {submitting && <RefreshCw size={14} className="animate-spin" />}
              {t('returns.processReturn')}
            </button>
          </div>
        </motion.div>
      )}
    </div>
  )
}
