import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Armchair, Plus, RefreshCw, Trash2, Search, Receipt, TrendingUp } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Badge } from '@shared/ui/atoms/Badge'
import { CustomerPicker, type CustomerLite } from '@shared/ui/molecules/CustomerPicker'
import { useAuthStore } from '@app/store/auth.store'
import { useBusinessStore } from '@app/store/business.store'
import { useNotificationStore } from '@app/store/notification.store'
import { cn } from '@shared/utils/cn'
import { formatCurrency } from '@shared/utils/currency.util'

interface Product { id: string; productName: string; sku?: string | null; sellingPrice: number }

interface CashFlowForecastMonthRow { month: string; bookingCount: number; expectedBalanceDue: number }

interface FurnitureBookingItem {
  id: string
  productId: string
  quantity: number
  unitPrice: number
  customFabric: string | null
  customColor: string | null
  customDimensions: string | null
  customFinish: string | null
  product: { id: string; productName: string }
}

interface FurnitureBooking {
  id: string
  bookingNumber: string
  customerId: string
  deliveryDate: string | null
  deliveryAddress: string | null
  advanceAmount: number
  advancePaymentMethod: string
  status: string
  invoiceId: string | null
  createdAt: string
  customer: { id: string; customerName: string; phone: string | null }
  items: FurnitureBookingItem[]
}

interface ItemDraft {
  productId: string
  productName: string
  quantity: string
  unitPrice: string
  customFabric: string
  customColor: string
  customDimensions: string
  customFinish: string
}

function ProductPicker({ products, value, onChange }: { products: Product[]; value: string; onChange: (id: string, name: string, price: number) => void }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const selected = products.find(p => p.id === value)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const results = query.trim()
    ? products.filter(p => p.productName.toLowerCase().includes(query.toLowerCase()) || (p.sku ?? '').toLowerCase().includes(query.toLowerCase())).slice(0, 50)
    : products.slice(0, 50)

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <Search size={12} className="absolute start-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={open ? query : (selected ? selected.productName : '')}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true) }}
          onFocus={() => { setQuery(''); setOpen(true) }}
          placeholder={t('furniture.booking.searchProductPlaceholder')}
          className="w-full h-8 ps-6 pe-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand text-slate-700 dark:text-slate-300"
        />
      </div>
      {open && (
        <div className="absolute start-0 end-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">{t('furniture.booking.noProductsMatch')}</p>
          ) : results.map(p => (
            <button key={p.id} type="button" onClick={() => { onChange(p.id, p.productName, p.sellingPrice); setQuery(''); setOpen(false) }}
              className={cn('w-full text-start px-3 py-2 text-sm hover:bg-brand/5 transition-colors', p.id === value && 'bg-brand/5')}>
              {p.productName}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const EMPTY_DRAFT: ItemDraft = { productId: '', productName: '', quantity: '1', unitPrice: '', customFabric: '', customColor: '', customDimensions: '', customFinish: '' }

// Phase 69 — Furniture vertical, deposit + balance booking.
export function FurnitureBookingScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const sym = useBusinessStore((s) => s.profile?.currencySymbol ?? '₹')
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canManage = hasPermission('furnitureBooking.manage')

  const [bookings, setBookings] = useState<FurnitureBooking[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [customer, setCustomer] = useState<CustomerLite | null>(null)
  const [deliveryDate, setDeliveryDate] = useState('')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [advanceAmount, setAdvanceAmount] = useState('0')
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState('CASH')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<Array<ItemDraft & { key: string }>>([])
  const [draft, setDraft] = useState<ItemDraft>(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [invoicingId, setInvoicingId] = useState<string | null>(null)
  // Phase 69 wow feature — Booked-Order Cash Flow Forecast.
  const [forecast, setForecast] = useState<CashFlowForecastMonthRow[]>([])
  const [forecastTotal, setForecastTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [bRes, pRes, fRes] = await Promise.all([
        window.api.furnitureBooking.list(),
        window.api.products.list({ isActive: true, limit: 500 }),
        window.api.furnitureBooking.cashFlowForecast(),
      ])
      if (bRes.success) setBookings((bRes.data as FurnitureBooking[]) ?? [])
      else toastError(t('furniture.booking.errorTitle'), bRes.error?.message ?? t('furniture.booking.couldNotLoadBookings'))
      if (pRes.success) setProducts((pRes.data as { products?: Product[] })?.products ?? [])
      if (fRes.success) {
        const d = fRes.data as { rows: CashFlowForecastMonthRow[]; summary: { totalExpectedBalanceDue: number } }
        setForecast(d.rows ?? [])
        setForecastTotal(d.summary?.totalExpectedBalanceDue ?? 0)
      }
    } catch {
      toastError(t('furniture.booking.errorTitle'), t('furniture.booking.couldNotLoadBookings'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { void load() }, [load])

  function resetForm() {
    setCustomer(null)
    setDeliveryDate('')
    setDeliveryAddress('')
    setAdvanceAmount('0')
    setAdvancePaymentMethod('CASH')
    setNotes('')
    setItems([])
    setDraft(EMPTY_DRAFT)
    setError('')
  }

  function addDraftItem() {
    if (!draft.productId) return
    const qty = Number(draft.quantity)
    const price = Number(draft.unitPrice)
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) return
    setItems((prev) => [...prev, { ...draft, key: `${draft.productId}-${Date.now()}` }])
    setDraft(EMPTY_DRAFT)
  }

  const bookingTotal = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unitPrice), 0)

  async function handleCreate() {
    setError('')
    if (!customer) { setError(t('furniture.booking.selectCustomerError')); return }
    if (items.length === 0) { setError(t('furniture.booking.addItemError')); return }
    const advance = Number(advanceAmount) || 0
    if (advance > bookingTotal) { setError(t('furniture.booking.advanceExceedsError')); return }
    setSaving(true)
    try {
      const res = await window.api.furnitureBooking.create({
        customerId: customer.id,
        deliveryDate: deliveryDate || undefined,
        deliveryAddress: deliveryAddress.trim() || undefined,
        advanceAmount: advance,
        advancePaymentMethod: advancePaymentMethod as 'CASH' | 'UPI' | 'CARD' | 'WALLET',
        notes: notes.trim() || undefined,
        items: items.map(i => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          customFabric: i.customFabric.trim() || undefined,
          customColor: i.customColor.trim() || undefined,
          customDimensions: i.customDimensions.trim() || undefined,
          customFinish: i.customFinish.trim() || undefined,
        })),
      })
      if (res.success) {
        const data = res.data as FurnitureBooking
        toastSuccess(t('furniture.booking.bookingCreatedTitle'), data.bookingNumber)
        setShowForm(false)
        resetForm()
        await load()
      } else {
        setError(res.error?.message ?? t('furniture.booking.couldNotCreateBooking'))
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleGenerateInvoice(id: string) {
    setInvoicingId(id)
    try {
      const res = await window.api.furnitureBooking.generateInvoice({ id })
      if (res.success) { toastSuccess(t('furniture.booking.invoiceGeneratedTitle'), t('furniture.booking.invoiceGeneratedMessage')); await load() }
      else toastError(t('furniture.booking.errorTitle'), res.error?.message ?? t('furniture.booking.couldNotGenerateInvoice'))
    } finally {
      setInvoicingId(null)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark flex items-center gap-2"><Armchair size={20} /> {t('furniture.booking.title')}</h2>
          <p className="text-sm text-slate-400">{t('furniture.booking.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:border-slate-300 transition-colors">
            <RefreshCw size={14} /> {t('common.refresh')}
          </button>
          {canManage && (
            <Button size="sm" onClick={() => setShowForm((s) => !s)} icon={<Plus size={14} />}>{t('furniture.booking.newBooking')}</Button>
          )}
        </div>
      </div>

      {/* Phase 69 wow feature — Booked-Order Cash Flow Forecast. Projects
          incoming cash from every still-BOOKED, not-yet-invoiced booking's
          balance due, bucketed by expected delivery month. */}
      {forecast.length > 0 && (
        <Card padding="md" className="space-y-2">
          <p className="text-sm font-semibold text-dark dark:text-slate-100 flex items-center gap-2"><TrendingUp size={16} className="text-brand" /> {t('furniture.booking.cashFlowForecastTitle', { amount: formatCurrency(forecastTotal) })}</p>
          <div className="space-y-1.5">
            {forecast.map(f => (
              <div key={f.month} className="flex items-center justify-between text-sm">
                <span className="text-dark dark:text-slate-200">{f.month === 'Unscheduled' ? t('furniture.booking.noDeliveryDateSet') : f.month}</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{t('furniture.booking.forecastBookingCount', { count: f.bookingCount, amount: formatCurrency(f.expectedBalanceDue) })}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {showForm && canManage && (
        <Card padding="md" className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <CustomerPicker value={customer} onChange={setCustomer} label={t('furniture.booking.customerLabel')} />
            <Input label={t('furniture.booking.deliveryDateLabel')} type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          </div>
          <Input label={t('furniture.booking.deliveryAddressLabel')} value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />

          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-500">{t('furniture.booking.itemsLabel')}</p>
            <div className="grid grid-cols-6 gap-2 items-end">
              <div className="col-span-2"><ProductPicker products={products} value={draft.productId} onChange={(id, name, price) => setDraft(d => ({ ...d, productId: id, productName: name, unitPrice: String(price) }))} /></div>
              <Input label={t('furniture.booking.qtyLabel')} type="number" min="1" step="1" value={draft.quantity} onChange={(e) => setDraft(d => ({ ...d, quantity: e.target.value }))} />
              <Input label={t('furniture.booking.priceLabel')} type="number" min="0" step="0.01" value={draft.unitPrice} onChange={(e) => setDraft(d => ({ ...d, unitPrice: e.target.value }))} />
              <Input label={t('furniture.booking.fabricColorLabel')} placeholder={t('furniture.booking.customFabricPlaceholder')} value={draft.customFabric} onChange={(e) => setDraft(d => ({ ...d, customFabric: e.target.value }))} />
              <Button size="sm" variant="secondary" onClick={addDraftItem} disabled={!draft.productId}>{t('common.add')}</Button>
            </div>
            {items.length > 0 && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((i, idx) => (
                  <div key={i.key} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-dark dark:text-slate-200">{t('furniture.booking.itemLine', { productName: i.productName, quantity: i.quantity, price: formatCurrency(Number(i.unitPrice)) })}{i.customFabric ? ` — ${i.customFabric}` : ''}</span>
                    <button onClick={() => setItems(prev => prev.filter((_, x) => x !== idx))} className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                ))}
                <div className="pt-1.5 text-sm font-semibold text-dark dark:text-slate-100">{t('furniture.booking.totalLabel', { amount: formatCurrency(bookingTotal) })}</div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label={t('furniture.booking.advanceAmountLabel', { sym })} type="number" min="0" step="0.01" value={advanceAmount} onChange={(e) => setAdvanceAmount(e.target.value)} />
            <Select label={t('furniture.booking.advancePaymentMethodLabel')} value={advancePaymentMethod} onChange={(e) => setAdvancePaymentMethod(e.target.value)}>
              <option value="CASH">{t('furniture.booking.cash')}</option>
              <option value="UPI">{t('furniture.booking.upi')}</option>
              <option value="CARD">{t('furniture.booking.card')}</option>
              <option value="WALLET">{t('furniture.booking.wallet')}</option>
            </Select>
          </div>
          <Input label={t('common.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
          {error && <p className="text-xs text-danger bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setShowForm(false); resetForm() }}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={() => void handleCreate()} loading={saving}>{t('furniture.booking.book')}</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">{t('common.loading')}</div>
      ) : bookings.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <Armchair size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('furniture.booking.emptyTitle')}</p>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {bookings.map((b) => {
              const total = b.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0)
              return (
                <div key={b.id} className="px-5 py-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm dark:text-slate-100">{b.bookingNumber}</span>
                      <Badge variant={b.status === 'DELIVERED' ? 'success' : b.status === 'CANCELLED' ? 'neutral' : 'warning'} size="sm">{b.status}</Badge>
                    </div>
                    <div className="text-sm text-gray-800 mt-1 dark:text-slate-200">{b.customer.customerName}{b.deliveryDate ? ` — ${t('furniture.booking.deliveryDateSuffix', { date: new Date(b.deliveryDate).toLocaleDateString() })}` : ''}</div>
                    <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap dark:text-slate-400">
                      <span>{t('furniture.booking.itemCount', { count: b.items.length })}</span>
                      <span className="font-semibold text-dark dark:text-slate-100">{t('furniture.booking.totalSuffix', { amount: formatCurrency(total) })}</span>
                      <span>{t('furniture.booking.advanceSuffix', { amount: formatCurrency(b.advanceAmount) })}</span>
                    </div>
                  </div>
                  {!b.invoiceId && b.status === 'BOOKED' && canManage && (
                    <button onClick={() => void handleGenerateInvoice(b.id)} disabled={invoicingId === b.id} className="text-xs px-3 py-1.5 rounded-lg bg-brand/5 text-brand border border-brand/20 hover:bg-brand/10 flex items-center gap-1 font-medium flex-shrink-0">
                      <Receipt size={12} /> {invoicingId === b.id ? t('furniture.booking.generating') : t('furniture.booking.generateInvoice')}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
