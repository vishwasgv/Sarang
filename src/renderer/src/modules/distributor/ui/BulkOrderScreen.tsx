import React, { useState, useEffect } from 'react'
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
    const t = setTimeout(async () => {
      try {
        const res = await api.products.search(query.trim())
        if (res.success && res.data) setResults(res.data as Product[])
        else toastError('Search Failed', (res.error as { message?: string })?.message ?? 'Could not search products.')
      } catch {
        toastError('Search Failed', 'Could not search products.')
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query, toastError])

  // Debounced customer search
  useEffect(() => {
    if (!customerQuery.trim()) { setCustomerResults([]); return }
    const t = setTimeout(async () => {
      try {
        const res = await api.customers.search(customerQuery.trim())
        if (res.success && res.data) setCustomerResults(res.data as Customer[])
        else toastError('Search Failed', (res.error as { message?: string })?.message ?? 'Could not search customers.')
      } catch {
        toastError('Search Failed', 'Could not search customers.')
      }
    }, 250)
    return () => clearTimeout(t)
  }, [customerQuery, toastError])

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
    const repriced = await Promise.all(items.map(async (i) => {
      const res = await api.products.resolveCustomerPrice({ productId: i.productId, customerId })
      const unitPrice = res.success && res.data ? (res.data as { price: number }).price : i.unitPrice
      return { ...i, unitPrice }
    }))
    setItems(repriced)
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
    if (!items.length) { toastError('Empty Order', 'Add at least one product.'); return }
    if (paymentMethod === 'CREDIT' && !customer) { toastError('No Customer', 'Select a customer for a credit order.'); return }
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
        toastSuccess('Order Created', `Bulk order ${inv.invoiceNumber} created.`)
        setDone(inv.invoiceNumber)
      } else {
        toastError('Failed', (res.error as { message?: string })?.message ?? 'Could not create order.')
      }
    } catch {
      toastError('Failed', 'Could not create order.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="p-6 max-w-xl mx-auto">
        <Card padding="lg" className="text-center space-y-4">
          <CheckCircle2 size={40} className="text-success mx-auto" />
          <h3 className="text-base font-bold text-dark">Bulk Order Created</h3>
          <p className="text-sm text-slate-500">Invoice <strong>{done}</strong> has been created.</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setDone(null); setItems([]); setOrderRef(''); setNotes(''); setCustomer(null); setPaymentMethod('CASH') }}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:border-slate-300 transition-colors">
              New Order
            </button>
            <button onClick={() => navigate('/billing')}
              className="px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors">
              View Invoices
            </button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-bold text-dark">Bulk Order Entry</h2>
        <p className="text-sm text-slate-400">Add multiple products quickly for large distributor orders</p>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Left: Product search + list */}
        <div className="col-span-2 space-y-4">
          {/* Product search */}
          <Card padding="md" className="space-y-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search products by name or SKU…"
                className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:border-brand"
              />
            </div>
            {results.length > 0 && (
              <div className="border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden divide-y divide-slate-50 dark:divide-slate-800">
                {results.slice(0, 6).map(p => (
                  <button key={p.id} onClick={() => addProduct(p)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-brand/5 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-dark">{p.productName}</p>
                      <p className="text-xs text-slate-400">{p.sku ?? ''} · {p.unit}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-dark">{sym}{p.sellingPrice.toFixed(2)}</p>
                      <p className={cn('text-xs', (p.inventory?.quantity ?? 0) <= 0 ? 'text-danger' : 'text-slate-400')}>
                        Stock: {p.inventory?.quantity ?? 0}
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
                <div className="col-span-5">Product</div>
                <div className="col-span-3 text-center">Qty</div>
                <div className="col-span-2 text-right">Unit Price</div>
                <div className="col-span-2 text-right">Total</div>
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
                            {pct}% bulk discount
                          </span>
                        )}
                      </div>
                      <div className="col-span-2 text-right text-xs text-slate-500">
                        {sym}{item.unitPrice.toFixed(2)}
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <div className="text-right">
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
                Volume pricing: {VOLUME_DISCOUNT_TIERS.slice().reverse().map(t => `${t.minQty}+ units → ${t.pct}% off`).join(' · ')}
              </p>
            </Card>
          )}
        </div>

        {/* Right: Order summary */}
        <div className="space-y-4">
          <Card padding="lg" className="space-y-4">
            <h3 className="text-sm font-semibold text-dark dark:text-slate-100">Order Details</h3>

            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Customer (optional — required for credit)</label>
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
                  <UserPlus size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={customerQuery}
                    onChange={e => setCustomerQuery(e.target.value)}
                    placeholder="Search wholesale customer…"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:border-brand"
                  />
                  {customerResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                      {customerResults.map(c => (
                        <button key={c.id}
                          onClick={() => { setCustomer(c); setCustomerQuery(''); setCustomerResults([]); void repriceCartForCustomer(c.id) }}
                          className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-brand/5 dark:hover:bg-brand/10 text-sm border-b border-slate-50 dark:border-slate-800 last:border-0">
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
              <label className="text-xs font-medium text-slate-500 mb-1 block">Order Reference</label>
              <input value={orderRef} onChange={e => setOrderRef(e.target.value)}
                placeholder="e.g. PO-2026-001"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:border-brand" />
            </div>
            <div>
              <Select label="Payment Method" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as typeof paymentMethod)}>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="CARD">Card</option>
                {customer && <option value="CREDIT">Credit (Pay Later)</option>}
              </Select>
              <p className="text-xs text-slate-400 mt-1">{customer ? 'Credit orders count against the customer\'s credit limit.' : 'Select a customer above to enable credit orders.'}</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Delivery instructions, special notes…"
                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 rounded-xl focus:outline-none focus:border-brand resize-none" />
            </div>
          </Card>

          <Card padding="lg" className="space-y-3">
            <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>Subtotal</span><span>{sym}{subtotal.toFixed(2)}</span>
            </div>
            {bulkDiscount > 0 && (
              <div className="flex justify-between text-sm text-success">
                <span>Bulk Discount</span><span>−{sym}{bulkDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>Tax</span><span>{sym}{tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-dark dark:text-slate-100 border-t border-slate-100 dark:border-slate-800 pt-3">
              <span>Total</span><span>{sym}{total.toFixed(2)}</span>
            </div>
            <p className="text-xs text-slate-400">{items.length} product{items.length !== 1 ? 's' : ''} · {items.reduce((s, i) => s + i.quantity, 0)} units</p>

            <button onClick={handleSubmit} disabled={submitting || items.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
              {submitting ? <RefreshCw size={14} className="animate-spin" /> : <PackagePlus size={14} />}
              {submitting ? 'Creating…' : 'Create Bulk Order'}
            </button>
          </Card>
        </div>
      </div>
    </div>
  )
}
