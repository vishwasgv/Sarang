import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { PackagePlus, Search, X, Plus, Minus, RefreshCw, CheckCircle2, User, UserPlus } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useNotificationStore } from '@app/store/notification.store'
import { useBusinessStore } from '@app/store/business.store'
import { cn } from '@shared/utils/cn'
import { Card } from '@shared/ui/molecules/Card'
import { Select } from '@shared/ui/atoms/Select'

interface Product {
  id: string; productName: string; sku?: string | null; unit: string
  sellingPrice: number; taxRate: number; productType: string
  inventory?: { quantity: number } | null
}

interface Customer { id: string; customerName: string; phone?: string | null; customerCode?: string | null }

interface BulkItem {
  productId: string; productName: string; sku?: string | null; unit: string
  quantity: number; unitPrice: number; taxRate: number; availableQty: number
}

// Volume pricing — the one feature this screen is named for and previously
// didn't implement at all (every line shipped with discountAmount hardcoded
// to 0, no way to apply one from here). Checked highest threshold first;
// ordinary retail-sized quantities (below the lowest tier) get no discount.
const VOLUME_DISCOUNT_TIERS = [
  { minQty: 100, pct: 15 },
  { minQty: 50, pct: 10 },
  { minQty: 10, pct: 5 },
] as const

function volumeDiscountPct(quantity: number): number {
  return VOLUME_DISCOUNT_TIERS.find(t => quantity >= t.minQty)?.pct ?? 0
}

export function BulkOrderScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const profile = useBusinessStore(s => s.profile)
  const sym = profile?.currencySymbol ?? '₹'

  const [items, setItems] = useState<BulkItem[]>([])
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [orderRef, setOrderRef] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'UPI' | 'CARD' | 'CREDIT'>('CASH')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  // A distributor's real day-to-day workflow is a regular wholesale customer
  // ordering in bulk on credit terms — without a customer picker, this screen
  // could only create walk-in CASH/UPI/CARD sales, completely disconnected
  // from the credit-limit-enforcement and outstanding-analytics features that
  // are supposed to work together with bulk orders for a Distributor.
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])

  // Debounced product search
  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const timer = setTimeout(async () => {
      try {
        const res = await api.products.search(query.trim())
        if (res.success && res.data) setResults(res.data as Product[])
        else toastError(t('distributor.bulkOrder.searchFailedTitle'), (res.error as { message?: string })?.message ?? t('distributor.bulkOrder.couldNotSearchProducts'))
      } catch {
        toastError(t('distributor.bulkOrder.searchFailedTitle'), t('distributor.bulkOrder.couldNotSearchProducts'))
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query, toastError, t])

  // Debounced customer search
  useEffect(() => {
    if (!customerQuery.trim()) { setCustomerResults([]); return }
    const timer = setTimeout(async () => {
      try {
        const res = await api.customers.search(customerQuery.trim())
        if (res.success && res.data) setCustomerResults(res.data as Customer[])
        else toastError(t('distributor.bulkOrder.searchFailedTitle'), (res.error as { message?: string })?.message ?? t('distributor.bulkOrder.couldNotSearchCustomers'))
      } catch {
        toastError(t('distributor.bulkOrder.searchFailedTitle'), t('distributor.bulkOrder.couldNotSearchCustomers'))
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [customerQuery, toastError, t])

  // Phase 58 §2 — Distributor customer-class/negotiated pricing. Resolved
  // fresh from the server (never computed client-side) the moment a
  // product is added, or the whole cart re-priced when the customer
  // changes — BulkOrderScreen is Distributor's own primary order-entry
  // screen, where the customer is picked before/alongside the cart, unlike
  // the generic cart-first BillingScreen/QuotationFormScreen shared by
  // every vertical (deliberately out of scope for this pass — see
  // PHASE_58_VERTICAL_COVERAGE_PLAN.md).
  async function resolvePrice(productId: string, fallback: number): Promise<number> {
    try {
      const res = await api.products.resolveCustomerPrice({ productId, customerId: customer?.id ?? null })
      if (res.success && res.data) return (res.data as { price: number }).price
    } catch {
      // fall through to list price — pricing lookup failures must never block adding an item
    }
    return fallback
  }

  async function addProduct(p: Product) {
    const unitPrice = await resolvePrice(p.id, p.sellingPrice)
    setItems(prev => {
      const existing = prev.find(i => i.productId === p.id)
      if (existing) return prev.map(i => i.productId === p.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, {
        productId: p.id, productName: p.productName, sku: p.sku, unit: p.unit,
        quantity: 1, unitPrice, taxRate: p.taxRate,
        availableQty: p.inventory?.quantity ?? 0
      }]
    })
    setQuery(''); setResults([])
  }

  // Re-price every line already in the cart when the customer changes (or
  // is cleared back to list price) — a rep might add items before picking
  // the customer, or switch customers mid-order.
  async function repriceCartForCustomer(customerId: string | null) {
    if (items.length === 0) return
    try {
      const repriced = await Promise.all(items.map(async (i) => {
        const res = await api.products.resolveCustomerPrice({ productId: i.productId, customerId })
        const unitPrice = res.success && res.data ? (res.data as { price: number }).price : i.unitPrice
        return { ...i, unitPrice }
      }))
      setItems(repriced)
    } catch {
      toastError(t('distributor.bulkOrder.pricingFailedTitle'), t('distributor.bulkOrder.pricingFailedMessage'))
    }
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) { setItems(prev => prev.filter(i => i.productId !== productId)); return }
    setItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i))
  }

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const bulkDiscount = items.reduce((s, i) => s + i.quantity * i.unitPrice * volumeDiscountPct(i.quantity) / 100, 0)
  const tax = items.reduce((s, i) => {
    const lineGross = i.quantity * i.unitPrice
    const lineDiscount = lineGross * volumeDiscountPct(i.quantity) / 100
    return s + (lineGross - lineDiscount) * i.taxRate / 100
  }, 0)
  const total = subtotal - bulkDiscount + tax

  async function handleSubmit() {
    if (!items.length) { toastError(t('distributor.bulkOrder.emptyOrderTitle'), t('distributor.bulkOrder.emptyOrderMessage')); return }
    if (paymentMethod === 'CREDIT' && !customer) { toastError(t('distributor.bulkOrder.noCustomerTitle'), t('distributor.bulkOrder.noCustomerMessage')); return }
    setSubmitting(true)
    try {
      const res = await api.billing.createInvoice({
        customerId: customer?.id,
        paymentMethod,
        items: items.map(i => ({
          productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice,
          discountAmount: i.quantity * i.unitPrice * volumeDiscountPct(i.quantity) / 100,
          taxRate: i.taxRate
        })),
        globalDiscount: 0,
        notes: `Bulk Order${orderRef ? ` — Ref: ${orderRef}` : ''}${notes ? `. ${notes}` : ''}`
      })
      if (res.success && res.data) {
        const inv = res.data as { invoiceNumber: string }
        toastSuccess(t('distributor.bulkOrder.orderCreatedTitle'), t('distributor.bulkOrder.orderCreatedMessage', { invoiceNumber: inv.invoiceNumber }))
        setDone(inv.invoiceNumber)
      } else {
        toastError(t('distributor.bulkOrder.failedTitle'), (res.error as { message?: string })?.message ?? t('distributor.bulkOrder.couldNotCreateOrder'))
      }
    } catch {
      toastError(t('distributor.bulkOrder.failedTitle'), t('distributor.bulkOrder.couldNotCreateOrder'))
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card padding="lg" className="text-center space-y-4">
          <CheckCircle2 size={40} className="text-success mx-auto" />
          <h3 className="text-base font-bold text-dark">{t('distributor.bulkOrder.createdHeading')}</h3>
          <p className="text-sm text-slate-500">{t('distributor.bulkOrder.invoiceCreatedPre')} <strong>{done}</strong> {t('distributor.bulkOrder.invoiceCreatedPost')}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setDone(null); setItems([]); setOrderRef(''); setNotes(''); setCustomer(null); setPaymentMethod('CASH') }}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:border-slate-300 transition-colors">
              {t('distributor.bulkOrder.newOrder')}
            </button>
            <button onClick={() => navigate('/billing')}
              className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors">
              {t('distributor.bulkOrder.viewInvoices')}
            </button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-bold text-dark">{t('distributor.bulkOrder.title')}</h2>
        <p className="text-sm text-slate-400">{t('distributor.bulkOrder.subtitle')}</p>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Left: Product search + list */}
        <div className="col-span-2 space-y-4">
          {/* Product search */}
          <Card padding="md" className="space-y-3">
            <div className="relative">
              <Search size={15} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('distributor.bulkOrder.searchProductsPlaceholder')}
                className="w-full ps-9 pe-4 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:border-brand"
              />
            </div>
            {results.length > 0 && (
              <div className="border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden divide-y divide-slate-50 dark:divide-slate-800">
                {results.slice(0, 6).map(p => (
                  <button key={p.id} onClick={() => addProduct(p)}
                    className="w-full flex items-center justify-between px-4 py-3 text-start hover:bg-brand/5 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-dark">{p.productName}</p>
                      <p className="text-xs text-slate-400">{p.sku ?? ''} · {p.unit}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-sm font-semibold text-dark">{sym}{p.sellingPrice.toFixed(2)}</p>
                      <p className={cn('text-xs', (p.inventory?.quantity ?? 0) <= 0 ? 'text-danger' : 'text-slate-400')}>
                        {t('distributor.bulkOrder.stockLabel', { qty: p.inventory?.quantity ?? 0 })}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Item list */}
          {items.length > 0 && (
            <Card padding="none" className="overflow-hidden">
              <div className="grid grid-cols-12 gap-2 px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase">
                <div className="col-span-5">{t('distributor.bulkOrder.columnProduct')}</div>
                <div className="col-span-3 text-center">{t('distributor.bulkOrder.columnQty')}</div>
                <div className="col-span-2 text-end">{t('distributor.bulkOrder.columnUnitPrice')}</div>
                <div className="col-span-2 text-end">{t('common.total')}</div>
              </div>
              <div className="divide-y divide-slate-50 dark:divide-slate-800">
                {items.map(item => {
                  const pct = volumeDiscountPct(item.quantity)
                  const lineGross = item.quantity * item.unitPrice
                  const lineTotal = lineGross * (1 - pct / 100)
                  return (
                    <div key={item.productId} className="grid grid-cols-12 gap-2 px-5 py-3 items-center dark:bg-slate-900">
                      <div className="col-span-5">
                        <p className="text-sm font-medium text-dark">{item.productName}</p>
                        <p className="text-xs text-slate-400">{item.unit}</p>
                      </div>
                      <div className="col-span-3 flex flex-col items-center gap-1">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => updateQty(item.productId, item.quantity - 1)}
                            className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:border-brand transition-colors">
                            <Minus size={10} />
                          </button>
                          <input type="number" min="1" value={item.quantity}
                            onChange={e => updateQty(item.productId, parseInt(e.target.value) || 1)}
                            className="w-14 text-center text-sm font-semibold h-6 rounded border border-slate-200 focus:outline-none focus:border-brand" />
                          <button onClick={() => updateQty(item.productId, item.quantity + 1)}
                            className="w-6 h-6 rounded border border-slate-200 flex items-center justify-center text-slate-500 hover:border-brand transition-colors">
                            <Plus size={10} />
                          </button>
                        </div>
                        {pct > 0 && (
                          <span className="text-[10px] font-semibold text-success bg-success/10 px-1.5 py-0.5 rounded">
                            {t('distributor.bulkOrder.bulkDiscountBadge', { pct })}
                          </span>
                        )}
                        {item.quantity > item.availableQty && (
                          <span className="text-[10px] font-semibold text-danger bg-danger/10 px-1.5 py-0.5 rounded">
                            {t('distributor.bulkOrder.exceedsStock', { available: item.availableQty })}
                          </span>
                        )}
                      </div>
                      <div className="col-span-2 text-end text-xs text-slate-500">
                        {sym}{item.unitPrice.toFixed(2)}
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <div className="text-end">
                          {pct > 0 && (
                            <p className="text-xs text-slate-400 line-through">{sym}{lineGross.toFixed(2)}</p>
                          )}
                          <span className="text-sm font-semibold text-dark">
                            {sym}{lineTotal.toFixed(2)}
                          </span>
                        </div>
                        <button onClick={() => updateQty(item.productId, 0)}
                          className="text-slate-300 hover:text-danger transition-colors">
                          <X size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p className="px-5 py-2 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
                {t('distributor.bulkOrder.volumePricingLabel')} {VOLUME_DISCOUNT_TIERS.slice().reverse().map(tier => t('distributor.bulkOrder.volumePricingTier', { minQty: tier.minQty, pct: tier.pct })).join(' · ')}
              </p>
            </Card>
          )}
        </div>

        {/* Right: Order summary */}
        <div className="space-y-4">
          <Card padding="lg" className="space-y-4">
            <h3 className="text-sm font-semibold text-dark dark:text-slate-100">{t('distributor.bulkOrder.orderDetailsTitle')}</h3>

            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">{t('distributor.bulkOrder.customerLabel')}</label>
              {customer ? (
                <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-brand/30 bg-brand/5">
                  <div className="flex items-center gap-2 min-w-0">
                    <User size={14} className="text-brand shrink-0" />
                    <span className="text-sm text-dark truncate">{customer.customerName}</span>
                  </div>
                  <button onClick={() => { setCustomer(null); if (paymentMethod === 'CREDIT') setPaymentMethod('CASH'); void repriceCartForCustomer(null) }}
                    className="text-slate-400 hover:text-danger transition-colors shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <UserPlus size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={customerQuery}
                    onChange={e => setCustomerQuery(e.target.value)}
                    placeholder={t('distributor.bulkOrder.searchCustomerPlaceholder')}
                    className="w-full ps-9 pe-3 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:border-brand"
                  />
                  {customerResults.length > 0 && (
                    <div className="absolute start-0 end-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                      {customerResults.map(c => (
                        <button key={c.id}
                          onClick={() => { setCustomer(c); setCustomerQuery(''); setCustomerResults([]); void repriceCartForCustomer(c.id) }}
                          className="w-full flex items-center justify-between px-3 py-2 text-start hover:bg-brand/5 dark:hover:bg-brand/10 text-sm border-b border-slate-50 dark:border-slate-800 last:border-0">
                          <span className="text-dark">{c.customerName}</span>
                          {c.phone && <span className="text-xs text-slate-400">{c.phone}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs font-medium text-slate-500 mb-1 block">{t('distributor.bulkOrder.orderReferenceLabel')}</label>
              <input value={orderRef} onChange={e => setOrderRef(e.target.value)}
                placeholder={t('distributor.bulkOrder.orderReferencePlaceholder')}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:border-brand" />
            </div>
            <div>
              <Select label={t('distributor.bulkOrder.paymentMethodLabel')} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as typeof paymentMethod)}>
                <option value="CASH">{t('distributor.bulkOrder.cash')}</option>
                <option value="UPI">{t('distributor.bulkOrder.upi')}</option>
                <option value="CARD">{t('distributor.bulkOrder.card')}</option>
                {customer && <option value="CREDIT">{t('distributor.bulkOrder.creditPayLater')}</option>}
              </Select>
              <p className="text-xs text-slate-400 mt-1">{customer ? t('distributor.bulkOrder.creditHintWithCustomer') : t('distributor.bulkOrder.creditHintNoCustomer')}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">{t('common.notes')}</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder={t('distributor.bulkOrder.notesPlaceholder')}
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:border-brand resize-none" />
            </div>
          </Card>

          <Card padding="lg" className="space-y-3">
            <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>{t('common.subtotal')}</span><span>{sym}{subtotal.toFixed(2)}</span>
            </div>
            {bulkDiscount > 0 && (
              <div className="flex justify-between text-sm text-success">
                <span>{t('distributor.bulkOrder.bulkDiscountLabel')}</span><span>−{sym}{bulkDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>{t('common.tax')}</span><span>{sym}{tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-dark dark:text-slate-100 border-t border-slate-100 dark:border-slate-800 pt-3">
              <span>{t('common.total')}</span><span>{sym}{total.toFixed(2)}</span>
            </div>
            <p className="text-xs text-slate-400">{t('distributor.bulkOrder.productCount', { count: items.length })} · {t('distributor.bulkOrder.unitsCount', { count: items.reduce((s, i) => s + i.quantity, 0) })}</p>

            <button onClick={handleSubmit} disabled={submitting || items.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
              {submitting ? <RefreshCw size={14} className="animate-spin" /> : <PackagePlus size={14} />}
              {submitting ? t('distributor.bulkOrder.creating') : t('distributor.bulkOrder.createBulkOrder')}
            </button>
          </Card>
        </div>
      </div>
    </div>
  )
}
