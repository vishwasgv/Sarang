import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { RotateCcw, Search, RefreshCw, XCircle, CheckCircle2, Minus, Plus, Shuffle } from 'lucide-react'
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
  // Real bug fix 2026-07-16 — see returns.service.ts. Present only for
  // variant-sold products (Clothing/Footwear); undefined/null otherwise.
  variantId?: string | null
  variantInfo?: string | null
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
  variantId?: string
  variantInfo?: string | null
}

// Same product can appear twice on one invoice as two different variants
// (e.g. Black-M and Red-L of the same T-shirt) — a plain productId key
// would collide the two rows together. This is the fix for that.
function rowKey(productId: string, variantId?: string | null): string {
  return `${productId}|${variantId ?? ''}`
}

// Phase 67 §9.1 — Clothing item 4: size/color exchange workflow.
interface VariantOption {
  id: string
  size: string | null
  color: string | null
  // Phase 67 §9.1 — Footwear item 1: half-size/width matrix. Null for
  // every non-Footwear variant.
  width: string | null
  stockQty: number
  isActive: boolean
}

function variantLabel(v: { size: string | null; color: string | null; width?: string | null }): string {
  return [v.size, v.width, v.color].filter(Boolean).join(' / ') || '—'
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

  // Phase 67 §9.1 — Clothing item 4: size/color exchange workflow. A
  // per-item action distinct from the return flow above (own quantity, own
  // reason, own result state) — only one row's panel open at a time.
  const [exchangingKey, setExchangingKey] = useState<string | null>(null)
  const [exchangeVariants, setExchangeVariants] = useState<VariantOption[]>([])
  const [exchangeLoadingVariants, setExchangeLoadingVariants] = useState(false)
  const [exchangeForm, setExchangeForm] = useState<{ quantity: number; newVariantId: string; paymentMethod: string; reason: string }>({ quantity: 1, newVariantId: '', paymentMethod: 'CASH', reason: '' })
  const [exchangeSubmitting, setExchangeSubmitting] = useState(false)
  const [exchangeError, setExchangeError] = useState<string | null>(null)
  const [exchangeResult, setExchangeResult] = useState<{ returnInvoiceNumber: string; newInvoiceNumber: string; netAmountDue: number } | null>(null)

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
      const priorReturns = priorRes.data as Array<{ items: Array<{ productId: string; quantity: number; variantId?: string | null }> }>
      for (const pr of priorReturns) {
        for (const it of pr.items) {
          const key = rowKey(it.productId, it.variantId)
          alreadyReturned.set(key, (alreadyReturned.get(key) ?? 0) + it.quantity)
        }
      }

      setInvoice(found)
      setReturnItems(found.items.map(item => ({
        productId: item.productId,
        productName: item.productName,
        unit: item.product.unit,
        maxQty: Math.max(0, item.quantity - (alreadyReturned.get(rowKey(item.productId, item.variantId)) ?? 0)),
        returnQty: 0,
        variantId: item.variantId ?? undefined,
        variantInfo: item.variantInfo
      })))
    } catch {
      setSearchError('Could not search invoices. Please try again.')
      toastError(t('common.error'), t('common.error'))
    } finally {
      setSearching(false)
    }
  }

  function updateQty(productId: string, variantId: string | undefined, delta: number) {
    setReturnItems(prev => prev.map(item =>
      item.productId === productId && item.variantId === variantId
        ? { ...item, returnQty: Math.max(0, Math.min(item.maxQty, item.returnQty + delta)) }
        : item
    ))
  }

  async function openExchange(item: ReturnItem) {
    const key = rowKey(item.productId, item.variantId)
    setExchangingKey(key)
    setExchangeError(null)
    setExchangeResult(null)
    setExchangeForm({ quantity: Math.min(1, item.maxQty), newVariantId: '', paymentMethod: 'CASH', reason: '' })
    setExchangeLoadingVariants(true)
    setExchangeVariants([])
    try {
      const res = await api.variants.list({ productId: item.productId })
      if (res.success && res.data) {
        const list = res.data as VariantOption[]
        setExchangeVariants(list.filter(v => v.id !== item.variantId && v.isActive))
      }
    } catch {
      // Leave exchangeVariants empty — the panel's own "no variants" state handles it.
    } finally {
      setExchangeLoadingVariants(false)
    }
  }

  function closeExchange() {
    setExchangingKey(null)
    setExchangeError(null)
  }

  async function submitExchange(item: ReturnItem) {
    if (!invoice || !item.variantId) return
    if (!exchangeForm.newVariantId) { setExchangeError(t('returns.exchange.variantRequired')); return }
    if (!exchangeForm.reason.trim()) { setExchangeError(t('returns.exchange.reasonRequired')); return }

    setExchangeSubmitting(true)
    setExchangeError(null)
    try {
      const res = await api.exchange.create({
        originalInvoiceId: invoice.id,
        oldProductId: item.productId,
        oldVariantId: item.variantId,
        quantity: exchangeForm.quantity,
        newVariantId: exchangeForm.newVariantId,
        reason: exchangeForm.reason.trim(),
        paymentMethod: exchangeForm.paymentMethod as 'CASH' | 'UPI' | 'CARD' | 'WALLET' | 'CREDIT' | 'SPLIT'
      })
      if (res.success && res.data) {
        setExchangeResult(res.data)
        setExchangingKey(null)
      } else {
        setExchangeError((res.error as { message?: string })?.message ?? t('returns.exchange.error'))
      }
    } catch {
      setExchangeError(t('returns.exchange.error'))
      toastError(t('common.error'), t('common.error'))
    } finally {
      setExchangeSubmitting(false)
    }
  }

  async function handleReturn() {
    if (!invoice) return
    const selected = returnItems.filter(i => i.returnQty > 0)
    if (!selected.length) { setSubmitError('Select at least one item to return.'); return }
    if (!reason.trim()) { setSubmitError('Return reason is required.'); return }

    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await api.returns.create({
        originalInvoiceId: invoice.id,
        items: selected.map(i => ({ productId: i.productId, quantity: i.returnQty, ...(i.variantId ? { variantId: i.variantId } : {}) })),
        reason: reason.trim()
      })
      if (res.success && res.data) {
        setResult(res.data as { invoiceNumber: string })
      } else {
        setSubmitError((res.error as { message?: string })?.message ?? 'Could not process return.')
      }
    } catch {
      setSubmitError('Could not process return. Please try again.')
      toastError(t('common.error'), t('common.error'))
    } finally {
      setSubmitting(false)
    }
  }

  function reset() {
    setInvoiceNumber(''); setInvoice(null); setReturnItems([])
    setReason(''); setResult(null); setSubmitError(null); setSearchError(null)
    setExchangingKey(null); setExchangeResult(null); setExchangeError(null)
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

          {exchangeResult && (
            <div className="bg-success/5 border border-success/20 rounded-xl px-4 py-3 space-y-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-success">
                <CheckCircle2 size={14} />{t('returns.exchange.success')}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('returns.exchange.successMsg', { returnNumber: exchangeResult.returnInvoiceNumber, newNumber: exchangeResult.newInvoiceNumber })}</p>
              <p className="text-xs font-medium text-dark dark:text-slate-100">
                {exchangeResult.netAmountDue > 0
                  ? `${t('returns.exchange.amountDue')}: ${formatCurrency(exchangeResult.netAmountDue)}`
                  : exchangeResult.netAmountDue < 0
                    ? `${t('returns.exchange.amountRefund')}: ${formatCurrency(Math.abs(exchangeResult.netAmountDue))}`
                    : t('returns.exchange.amountEven')}
              </p>
            </div>
          )}

          <Card padding="none" className="overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
              <p className="text-sm font-semibold text-dark dark:text-slate-100">{t('returns.selectItems')}</p>
            </div>
            <div className="divide-y divide-slate-50">
              {returnItems.map(item => {
                const key = rowKey(item.productId, item.variantId)
                const isExchanging = exchangingKey === key
                return (
                  <div key={key}>
                    <div className="px-5 py-4 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-dark dark:text-slate-100">
                          {item.productName}{item.variantInfo ? <span className="text-slate-400 font-normal"> — {item.variantInfo}</span> : null}
                        </p>
                        <p className="text-xs text-slate-400">{t('returns.maxReturn')}: {item.maxQty} {item.unit}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.variantId && item.maxQty > 0 && (
                          <button onClick={() => (isExchanging ? closeExchange() : openExchange(item))}
                            className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors',
                              isExchanging ? 'border-brand text-brand bg-brand/5' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-brand hover:text-brand')}>
                            <Shuffle size={12} />{t('returns.exchange.action')}
                          </button>
                        )}
                        <button onClick={() => updateQty(item.productId, item.variantId, -1)}
                          disabled={item.returnQty === 0}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-brand hover:text-brand transition-colors disabled:opacity-30">
                          <Minus size={12} />
                        </button>
                        <span className={cn('w-8 text-center text-sm font-semibold', item.returnQty > 0 ? 'text-brand' : 'text-slate-300')}>
                          {item.returnQty}
                        </span>
                        <button onClick={() => updateQty(item.productId, item.variantId, 1)}
                          disabled={item.returnQty >= item.maxQty}
                          className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-brand hover:text-brand transition-colors disabled:opacity-30">
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                    {isExchanging && (
                      <div className="px-5 pb-4 -mt-1 bg-slate-50/60 dark:bg-slate-800/40 space-y-3">
                        <p className="text-xs font-semibold text-dark dark:text-slate-100 pt-3">{t('returns.exchange.title')}</p>
                        {exchangeLoadingVariants ? (
                          <p className="text-xs text-slate-400 flex items-center gap-1.5"><RefreshCw size={12} className="animate-spin" />{t('common.loading')}</p>
                        ) : exchangeVariants.length === 0 ? (
                          <p className="text-xs text-slate-400">{t('returns.exchange.noVariants')}</p>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">{t('returns.exchange.newVariant')}</label>
                                <select value={exchangeForm.newVariantId} onChange={e => setExchangeForm(f => ({ ...f, newVariantId: e.target.value }))}
                                  className="w-full px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:border-brand">
                                  <option value="">{t('returns.exchange.selectVariant')}</option>
                                  {exchangeVariants.map(v => (
                                    <option key={v.id} value={v.id} disabled={v.stockQty <= 0}>
                                      {variantLabel(v)} {v.stockQty <= 0 ? `(${t('returns.exchange.outOfStock')})` : `(${v.stockQty})`}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">{t('returns.exchange.quantity')}</label>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => setExchangeForm(f => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-brand hover:text-brand">
                                    <Minus size={12} />
                                  </button>
                                  <span className="w-8 text-center text-sm font-semibold text-dark dark:text-slate-100">{exchangeForm.quantity}</span>
                                  <button onClick={() => setExchangeForm(f => ({ ...f, quantity: Math.min(item.maxQty, f.quantity + 1) }))}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-brand hover:text-brand">
                                    <Plus size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">{t('returns.exchange.paymentMethod')}</label>
                              <select value={exchangeForm.paymentMethod} onChange={e => setExchangeForm(f => ({ ...f, paymentMethod: e.target.value }))}
                                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:border-brand">
                                {['CASH', 'UPI', 'CARD', 'WALLET', 'CREDIT'].map(m => <option key={m} value={m}>{m}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">{t('returns.exchange.reason')} *</label>
                              <textarea
                                value={exchangeForm.reason}
                                onChange={e => setExchangeForm(f => ({ ...f, reason: e.target.value }))}
                                rows={2}
                                placeholder={t('returns.exchange.reasonPlaceholder')}
                                className="w-full px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 focus:outline-none focus:border-brand resize-none"
                              />
                            </div>
                            {exchangeError && (
                              <div className="flex items-center gap-2 text-xs text-danger">
                                <XCircle size={12} />{exchangeError}
                              </div>
                            )}
                            <div className="flex justify-end gap-2">
                              <button onClick={closeExchange}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 hover:border-slate-300">
                                {t('returns.exchange.cancel')}
                              </button>
                              <button onClick={() => submitExchange(item)} disabled={exchangeSubmitting}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand/90 disabled:opacity-50">
                                {exchangeSubmitting && <RefreshCw size={12} className="animate-spin" />}
                                {t('returns.exchange.submit')}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
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
