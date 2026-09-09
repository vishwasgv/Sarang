import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { PackagePlus, Plus, RefreshCw, Trash2, Search, Receipt, CheckCircle2, BellRing } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Badge } from '@shared/ui/atoms/Badge'
import { CustomerPicker, type CustomerLite } from '@shared/ui/molecules/CustomerPicker'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'
import { cn } from '@shared/utils/cn'
import { formatCurrency } from '@shared/utils/currency.util'

interface Product { id: string; productName: string; sku?: string | null; sellingPrice: number }

interface ReorderReminderRow {
  customerId: string | null; institutionName: string
  lastOrderId: string; lastOrderNumber: string; lastOrderDate: string
  monthsSinceLastOrder: number; status: 'DUE_SOON' | 'OVERDUE'
}

interface BulkListOrderItem {
  id: string
  itemLabel: string
  requestedQty: number
  productId: string | null
  unitPrice: number | null
  product: { id: string; productName: string } | null
}

interface BulkListOrder {
  id: string
  orderNumber: string
  customerId: string | null
  customerName: string | null
  listName: string
  status: string
  invoiceId: string | null
  createdAt: string
  customer: { id: string; customerName: string; phone: string | null } | null
  items: BulkListOrderItem[]
}

function ProductPicker({ products, value, onChange }: { products: Product[]; value: string; onChange: (id: string, price: number) => void }) {
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
          placeholder={t('stationery.bulkListOrder.searchProductPlaceholder')}
          className="w-full h-8 ps-6 pe-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand text-slate-700 dark:text-slate-300"
        />
      </div>
      {open && (
        <div className="absolute start-0 end-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">{t('stationery.bulkListOrder.noProductsMatch')}</p>
          ) : results.map(p => (
            <button key={p.id} type="button" onClick={() => { onChange(p.id, p.sellingPrice); setQuery(''); setOpen(false) }}
              className={cn('w-full text-start px-3 py-2 text-sm hover:bg-brand/5 transition-colors', p.id === value && 'bg-brand/5')}>
              {p.productName}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function BulkListOrderScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canManage = hasPermission('bulkListOrder.manage')

  const [orders, setOrders] = useState<BulkListOrder[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [customer, setCustomer] = useState<CustomerLite | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [listName, setListName] = useState('')
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Array<{ key: string; itemLabel: string; requestedQty: string }>>([])
  const [draftLabel, setDraftLabel] = useState('')
  const [draftQty, setDraftQty] = useState('1')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [matchDraft, setMatchDraft] = useState<Record<string, { productId: string; unitPrice: string }>>({})
  const [matchingId, setMatchingId] = useState<string | null>(null)
  const [billingId, setBillingId] = useState<string | null>(null)
  const [billPaymentMethod, setBillPaymentMethod] = useState<Record<string, string>>({})
  // Phase 69 wow feature — Annual Reorder Reminder for Institutional Clients.
  const [reminders, setReminders] = useState<ReorderReminderRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [oRes, pRes, rRes] = await Promise.all([
        window.api.bulkListOrder.list(),
        window.api.products.list({ isActive: true, limit: 500 }),
        window.api.bulkListOrder.reorderReminders(),
      ])
      if (oRes.success) setOrders((oRes.data as BulkListOrder[]) ?? [])
      else toastError(t('common.error'), oRes.error?.message ?? t('stationery.bulkListOrder.couldNotLoad'))
      if (pRes.success) setProducts((pRes.data as { products?: Product[] })?.products ?? [])
      if (rRes.success) setReminders((rRes.data as ReorderReminderRow[]) ?? [])
    } catch {
      toastError(t('common.error'), t('stationery.bulkListOrder.couldNotLoad'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { void load() }, [load])

  function resetForm() {
    setCustomer(null)
    setCustomerName('')
    setListName('')
    setNotes('')
    setLines([])
    setDraftLabel('')
    setDraftQty('1')
    setError('')
  }

  function addLine() {
    if (!draftLabel.trim()) return
    const qty = Number(draftQty)
    if (!Number.isFinite(qty) || qty <= 0) return
    setLines((prev) => [...prev, { key: `${Date.now()}-${Math.random()}`, itemLabel: draftLabel.trim(), requestedQty: draftQty }])
    setDraftLabel('')
    setDraftQty('1')
  }

  async function handleCreate() {
    setError('')
    if (!customer && !customerName.trim()) { setError(t('stationery.bulkListOrder.selectCustomerOrInstitution')); return }
    if (!listName.trim()) { setError(t('stationery.bulkListOrder.listNameRequired')); return }
    if (lines.length === 0) { setError(t('stationery.bulkListOrder.addAtLeastOneLine')); return }
    setSaving(true)
    try {
      const res = await window.api.bulkListOrder.create({
        customerId: customer?.id,
        customerName: customer ? undefined : customerName.trim(),
        listName: listName.trim(),
        notes: notes.trim() || undefined,
        items: lines.map(l => ({ itemLabel: l.itemLabel, requestedQty: Number(l.requestedQty) })),
      })
      if (res.success) {
        const data = res.data as BulkListOrder
        toastSuccess(t('stationery.bulkListOrder.orderCreatedTitle'), data.orderNumber)
        setShowForm(false)
        resetForm()
        await load()
      } else {
        setError(res.error?.message ?? t('stationery.bulkListOrder.couldNotCreateOrder'))
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleMatch(itemId: string) {
    const d = matchDraft[itemId]
    if (!d?.productId) return
    const unitPrice = Number(d.unitPrice)
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return
    setMatchingId(itemId)
    try {
      const res = await window.api.bulkListOrder.matchItem({ itemId, productId: d.productId, unitPrice })
      if (res.success) await load()
      else toastError(t('common.error'), res.error?.message ?? t('stationery.bulkListOrder.couldNotMatchItem'))
    } finally {
      setMatchingId(null)
    }
  }

  async function handleBill(orderId: string) {
    setBillingId(orderId)
    try {
      const paymentMethod = (billPaymentMethod[orderId] ?? 'CREDIT') as 'CASH' | 'UPI' | 'CARD' | 'WALLET' | 'CREDIT' | 'SPLIT'
      const res = await window.api.bulkListOrder.bill({ orderId, paymentMethod })
      if (res.success) { toastSuccess(t('stationery.bulkListOrder.orderBilledTitle'), t('stationery.bulkListOrder.orderBilledMessage')); await load() }
      else toastError(t('common.error'), res.error?.message ?? t('stationery.bulkListOrder.couldNotBillOrder'))
    } finally {
      setBillingId(null)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark flex items-center gap-2"><PackagePlus size={20} /> {t('stationery.bulkListOrder.title')}</h2>
          <p className="text-sm text-slate-400">{t('stationery.bulkListOrder.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:border-slate-300 transition-colors">
            <RefreshCw size={14} /> {t('common.refresh')}
          </button>
          {canManage && (
            <Button size="sm" onClick={() => setShowForm((s) => !s)} icon={<Plus size={14} />}>{t('stationery.bulkListOrder.newOrder')}</Button>
          )}
        </div>
      </div>

      {/* Phase 69 wow feature — Annual Reorder Reminder for Institutional
          Clients. Institutions reorder on a roughly annual cycle; this
          flags whoever's last billed order is old enough to likely be due
          again, so the shop can proactively reach out. */}
      {reminders.length > 0 && (
        <Card padding="md" className="space-y-2 border-warning/30 bg-warning/5">
          <p className="text-sm font-semibold text-dark dark:text-slate-100 flex items-center gap-2"><BellRing size={16} className="text-warning" /> {t('stationery.bulkListOrder.reorderRemindersTitle')}</p>
          <div className="space-y-1.5">
            {reminders.map(r => (
              <div key={r.lastOrderId} className="flex items-center justify-between text-sm gap-2">
                <span className="text-dark dark:text-slate-200">{r.institutionName}</span>
                <span className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-shrink-0">
                  {t('stationery.bulkListOrder.lastOrderMonthsAgo', { orderNumber: r.lastOrderNumber, months: r.monthsSinceLastOrder })}
                  <Badge variant={r.status === 'OVERDUE' ? 'danger' : 'warning'} size="sm">{r.status === 'OVERDUE' ? t('stationery.bulkListOrder.overdue') : t('stationery.bulkListOrder.dueSoon')}</Badge>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {showForm && canManage && (
        <Card padding="md" className="space-y-3">
          {customer ? (
            <CustomerPicker value={customer} onChange={setCustomer} label={t('stationery.bulkListOrder.customerLabel')} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <CustomerPicker value={customer} onChange={setCustomer} label={t('stationery.bulkListOrder.customerOptionalLabel')} />
              <Input label={t('stationery.bulkListOrder.institutionNameLabel')} placeholder={t('stationery.bulkListOrder.institutionNamePlaceholder')} value={customerName} onChange={(e) => setCustomerName(e.target.value)} disabled={!!customer} />
            </div>
          )}
          <Input label={t('stationery.bulkListOrder.listNameLabel')} placeholder={t('stationery.bulkListOrder.listNamePlaceholder')} value={listName} onChange={(e) => setListName(e.target.value)} />

          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
            <p className="text-xs font-semibold text-slate-500">{t('stationery.bulkListOrder.supplyListLines')}</p>
            <div className="grid grid-cols-6 gap-2 items-end">
              <div className="col-span-4"><Input label={t('stationery.bulkListOrder.itemLabel')} placeholder={t('stationery.bulkListOrder.itemLabelPlaceholder')} value={draftLabel} onChange={(e) => setDraftLabel(e.target.value)} /></div>
              <Input label={t('stationery.bulkListOrder.qty')} type="number" min="1" step="1" value={draftQty} onChange={(e) => setDraftQty(e.target.value)} />
              <Button size="sm" variant="secondary" onClick={addLine} disabled={!draftLabel.trim()}>{t('common.add')}</Button>
            </div>
            {lines.length > 0 && (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {lines.map((l, idx) => (
                  <div key={l.key} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-dark dark:text-slate-200">{l.itemLabel} × {l.requestedQty}</span>
                    <button onClick={() => setLines(prev => prev.filter((_, x) => x !== idx))} className="text-slate-400 hover:text-red-600"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Input label={t('common.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
          {error && <p className="text-xs text-danger bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setShowForm(false); resetForm() }}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={() => void handleCreate()} loading={saving}>{t('common.create')}</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">{t('common.loading')}</div>
      ) : orders.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <PackagePlus size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('stationery.bulkListOrder.empty')}</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const unmatched = o.items.filter(i => !i.productId || i.unitPrice == null)
            const allMatched = unmatched.length === 0
            return (
              <Card key={o.id} padding="md" className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm dark:text-slate-100">{o.orderNumber}</span>
                      <Badge variant={o.status === 'BILLED' ? 'success' : o.status === 'CANCELLED' ? 'neutral' : 'warning'} size="sm">{o.status}</Badge>
                    </div>
                    <div className="text-sm text-gray-800 mt-1 dark:text-slate-200">{o.listName} — {o.customer?.customerName ?? o.customerName ?? t('stationery.bulkListOrder.walkIn')}</div>
                  </div>
                  {o.status === 'DRAFT' && canManage && (
                    <div className="flex items-center gap-2">
                      <Select value={billPaymentMethod[o.id] ?? 'CREDIT'} onChange={(e) => setBillPaymentMethod(prev => ({ ...prev, [o.id]: e.target.value }))}>
                        <option value="CREDIT">{t('stationery.bulkListOrder.paymentCredit')}</option>
                        <option value="CASH">{t('stationery.bulkListOrder.paymentCash')}</option>
                        <option value="UPI">{t('stationery.bulkListOrder.paymentUpi')}</option>
                        <option value="CARD">{t('stationery.bulkListOrder.paymentCard')}</option>
                      </Select>
                      <button onClick={() => void handleBill(o.id)} disabled={!allMatched || billingId === o.id} className="text-xs px-3 py-1.5 rounded-lg bg-brand/5 text-brand border border-brand/20 hover:bg-brand/10 flex items-center gap-1 font-medium disabled:opacity-40">
                        <Receipt size={12} /> {billingId === o.id ? t('stationery.bulkListOrder.billing') : t('stationery.bulkListOrder.billOrder')}
                      </button>
                    </div>
                  )}
                </div>
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                  {o.items.map((item) => (
                    <div key={item.id} className="py-2 flex items-center gap-3 text-sm">
                      <div className="flex-1 min-w-0">
                        <span className="text-dark dark:text-slate-200">{item.itemLabel} × {item.requestedQty}</span>
                        {item.productId && item.unitPrice != null ? (
                          <span className="ms-2 text-xs text-success flex items-center gap-1 inline-flex"><CheckCircle2 size={12} /> {item.product?.productName} @ {formatCurrency(item.unitPrice ?? 0)}</span>
                        ) : o.status === 'DRAFT' && canManage ? (
                          <div className="mt-1 grid grid-cols-4 gap-2 items-end">
                            <div className="col-span-2"><ProductPicker products={products} value={matchDraft[item.id]?.productId ?? ''} onChange={(id, price) => setMatchDraft(prev => ({ ...prev, [item.id]: { productId: id, unitPrice: String(price) } }))} /></div>
                            <Input placeholder={t('common.price')} type="number" min="0" step="0.01" value={matchDraft[item.id]?.unitPrice ?? ''} onChange={(e) => setMatchDraft(prev => ({ ...prev, [item.id]: { productId: prev[item.id]?.productId ?? '', unitPrice: e.target.value } }))} />
                            <Button size="sm" variant="secondary" onClick={() => void handleMatch(item.id)} disabled={!matchDraft[item.id]?.productId || matchingId === item.id}>{matchingId === item.id ? t('stationery.bulkListOrder.matching') : t('stationery.bulkListOrder.match')}</Button>
                          </div>
                        ) : (
                          <span className="ms-2 text-xs text-slate-400">{t('stationery.bulkListOrder.notMatched')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
