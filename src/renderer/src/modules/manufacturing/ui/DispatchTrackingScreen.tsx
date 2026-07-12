import React, { useEffect, useState, useCallback } from 'react'
import { Truck, Plus, X, RefreshCw, ChevronRight, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@renderer/services/ipc-client'
import { useNotificationStore } from '@app/store/notification.store'
import { formatDate } from '@shared/utils/locale.util'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Tabs } from '@shared/ui/molecules/Tabs'

interface DispatchRecord {
  id: string
  dispatchNumber: string
  productId: string
  productName: string
  productionOrderId: string | null
  productionOrderNumber: string | null
  quantity: number
  customerId: string | null
  customerName: string | null
  destination: string | null
  status: 'READY' | 'DISPATCHED' | 'DELIVERED'
  dispatchDate: string | null
  deliveryDate: string | null
  notes: string | null
  createdAt: string
}

interface Product { id: string; productName: string; inventory: { quantity: number } | null }
interface Customer { id: string; customerName: string }

const STATUS_TABS = ['ALL', 'READY', 'DISPATCHED', 'DELIVERED'] as const

// Covers every value of DispatchRecord['status'] ('READY' | 'DISPATCHED' | 'DELIVERED') —
// the ?? 'neutral' fallback below is a safety net only, never the primary mapping.
const STATUS_VARIANT: Record<string, 'warning' | 'info' | 'success'> = {
  READY: 'warning',
  DISPATCHED: 'info',
  DELIVERED: 'success'
}

const DISPATCH_STATUS_KEY: Record<string, string> = {
  READY:      'manufacturing.statusReady',
  DISPATCHED: 'manufacturing.statusDispatched',
  DELIVERED:  'manufacturing.statusDelivered',
}

export function DispatchTrackingScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [records, setRecords] = useState<DispatchRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<typeof STATUS_TABS[number]>('ALL')
  const [showCreate, setShowCreate] = useState(false)
  const [detailTarget, setDetailTarget] = useState<DispatchRecord | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({ productId: '', quantity: '', customerId: '', destination: '', notes: '' })

  // Product/customer pickers — search-as-you-type instead of a static
  // products.list/customers.list({limit:500}) that silently missed anything
  // past the first 500 with no way to reach the rest.
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [productQuery, setProductQuery] = useState('')
  const [productResults, setProductResults] = useState<Product[]>([])
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.dispatch.list({})
      if (res.success && res.data) {
        const d = res.data as { records: DispatchRecord[] }
        setRecords(d.records ?? [])
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!productQuery.trim()) { setProductResults([]); return }
    const t = setTimeout(async () => {
      const res = await api.products.search(productQuery.trim())
      if (res.success && res.data) setProductResults(res.data as Product[])
    }, 250)
    return () => clearTimeout(t)
  }, [productQuery])

  useEffect(() => {
    if (!customerQuery.trim()) { setCustomerResults([]); return }
    const t = setTimeout(async () => {
      const res = await api.customers.search(customerQuery.trim())
      if (res.success && res.data) setCustomerResults(res.data as Customer[])
    }, 250)
    return () => clearTimeout(t)
  }, [customerQuery])

  function openCreate() {
    setForm({ productId: '', quantity: '', customerId: '', destination: '', notes: '' })
    setSelectedProduct(null); setProductQuery(''); setProductResults([])
    setSelectedCustomer(null); setCustomerQuery(''); setCustomerResults([])
    setShowCreate(true)
  }

  async function handleCreate() {
    if (!form.productId || !form.quantity) return
    setSaving(true)
    const res = await api.dispatch.create({
      productId: form.productId,
      quantity: parseFloat(form.quantity),
      customerId: form.customerId || undefined,
      destination: form.destination || undefined,
      notes: form.notes || undefined
    })
    setSaving(false)
    if (res.success) {
      toastSuccess(t('manufacturing.dispatchCreated'))
      setShowCreate(false)
      loadData()
    } else {
      toastError(res.error?.message ?? t('manufacturing.saveFailed'))
    }
  }

  async function markDispatched(record: DispatchRecord) {
    const res = await api.dispatch.updateStatus({ id: record.id, status: 'DISPATCHED' })
    if (res.success) { toastSuccess(t('manufacturing.markedDispatched')); loadData() }
    else toastError(res.error?.message ?? t('manufacturing.actionFailed'))
  }

  async function markDelivered(record: DispatchRecord) {
    const res = await api.dispatch.updateStatus({ id: record.id, status: 'DELIVERED' })
    if (res.success) { toastSuccess(t('manufacturing.markedDelivered')); loadData() }
    else toastError(res.error?.message ?? t('manufacturing.actionFailed'))
  }

  const filtered = activeTab === 'ALL' ? records : records.filter(r => r.status === activeTab)

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Truck size={24} className="text-brand" />
              {t('manufacturing.dispatch')}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">{t('manufacturing.dispatchSubtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadData} className="h-11 w-11 flex items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-hover transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={openCreate} className="h-11 px-4 flex items-center gap-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors">
              <Plus size={16} />
              {t('manufacturing.newDispatchRecord')}
            </button>
          </div>
        </div>
        {/* Status tabs */}
        <Tabs
          className="mt-4"
          tabs={STATUS_TABS.map(tab => ({
            id: tab,
            label: tab === 'ALL' ? `${t('common.all')} (${records.length})` : `${t(DISPATCH_STATUS_KEY[tab] ?? tab)} (${records.filter(r => r.status === tab).length})`
          }))}
          active={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {/* Records list */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
            <Truck size={40} className="mb-3 opacity-30" />
            <p className="text-base font-medium">{t('manufacturing.noDispatchRecords')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => (
              <Card key={r.id} padding="md" className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-mono text-sm font-bold text-brand">{r.dispatchNumber}</span>
                    <Badge variant={STATUS_VARIANT[r.status] ?? 'neutral'} size="sm">{t(DISPATCH_STATUS_KEY[r.status] ?? r.status)}</Badge>
                  </div>
                  <p className="mt-1 font-semibold text-text-primary">{r.productName}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-text-secondary">
                    <span>{t('manufacturing.quantity')}: <strong className="text-text-primary">{r.quantity}</strong></span>
                    {r.customerName && <span>{t('billing.customer')}: <strong className="text-text-primary">{r.customerName}</strong></span>}
                    {r.destination && <span>{t('manufacturing.destination')}: {r.destination}</span>}
                    {r.dispatchDate && <span>{formatDate(r.dispatchDate)}</span>}
                    {r.deliveryDate && <span>{formatDate(r.deliveryDate)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {r.status === 'READY' && (
                    <button onClick={() => markDispatched(r)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                      {t('manufacturing.markDispatched')}
                    </button>
                  )}
                  {r.status === 'DISPATCHED' && (
                    <button onClick={() => markDelivered(r)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 transition-colors">
                      {t('manufacturing.markDelivered')}
                    </button>
                  )}
                  <button onClick={() => setDetailTarget(r)} className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
              <h2 className="text-lg font-semibold text-text-primary">{t('manufacturing.newDispatchRecord')}</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">{t('billing.product')} *</label>
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    value={form.productId ? selectedProduct?.productName ?? '' : productQuery}
                    onChange={e => { setForm(f => ({ ...f, productId: '' })); setSelectedProduct(null); setProductQuery(e.target.value) }}
                    placeholder="Search product by name or SKU…"
                    className="w-full h-12 pl-10 pr-3 rounded-xl border border-border text-sm bg-white dark:bg-slate-900 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30" />
                  {productResults.length > 0 && !form.productId && (
                    <div className="absolute z-10 mt-1 w-full border border-border rounded-xl overflow-hidden divide-y divide-border bg-white dark:bg-slate-900 shadow-lg max-h-56 overflow-y-auto">
                      {productResults.map(p => (
                        <button key={p.id} type="button"
                          onClick={() => { setForm(f => ({ ...f, productId: p.id })); setSelectedProduct(p); setProductQuery(''); setProductResults([]) }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-brand/5 transition-colors text-text-primary">
                          {p.productName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {form.productId && (() => {
                  const stock = selectedProduct?.inventory?.quantity ?? 0
                  return (
                    <p className={`text-xs mt-1 ${stock > 0 ? 'text-text-secondary' : 'text-danger'}`}>
                      {t('manufacturing.availableStock')}: <span className="font-semibold">{stock}</span>
                    </p>
                  )
                })()}
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">{t('manufacturing.quantity')} *</label>
                <input type="number" min="0.01" step="0.01" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full h-12 rounded-xl border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder="0" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">{t('billing.customer')} ({t('common.optional')})</label>
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    value={form.customerId ? selectedCustomer?.customerName ?? '' : customerQuery}
                    onChange={e => { setForm(f => ({ ...f, customerId: '' })); setSelectedCustomer(null); setCustomerQuery(e.target.value) }}
                    placeholder="Search customer…"
                    className="w-full h-12 pl-10 pr-3 rounded-xl border border-border text-sm bg-white dark:bg-slate-900 text-text-primary focus:outline-none focus:ring-2 focus:ring-brand/30" />
                  {customerResults.length > 0 && !form.customerId && (
                    <div className="absolute z-10 mt-1 w-full border border-border rounded-xl overflow-hidden divide-y divide-border bg-white dark:bg-slate-900 shadow-lg max-h-56 overflow-y-auto">
                      {customerResults.map(c => (
                        <button key={c.id} type="button"
                          onClick={() => { setForm(f => ({ ...f, customerId: c.id })); setSelectedCustomer(c); setCustomerQuery(''); setCustomerResults([]) }}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-brand/5 transition-colors text-text-primary">
                          {c.customerName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">{t('manufacturing.destination')} ({t('common.optional')})</label>
                <input type="text" value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))}
                  className="w-full h-12 rounded-xl border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder="" />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">{t('common.notes')} ({t('common.optional')})</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} className="w-full rounded-xl border border-border px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand/30"
                  placeholder="" />
              </div>
            </div>
            <div className="px-6 pb-6 pt-4 border-t border-border flex gap-3 shrink-0">
              <button onClick={() => setShowCreate(false)} className="flex-1 h-12 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-surface-hover transition-colors">
                {t('common.cancel')}
              </button>
              <button onClick={handleCreate} disabled={saving || !form.productId || !form.quantity}
                className="flex-1 h-12 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {saving ? t('cashClose.saving') : t('manufacturing.createDispatch')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{detailTarget.dispatchNumber}</h2>
                <div className="mt-1">
                  <Badge variant={STATUS_VARIANT[detailTarget.status] ?? 'neutral'} size="sm">{t(DISPATCH_STATUS_KEY[detailTarget.status] ?? detailTarget.status)}</Badge>
                </div>
              </div>
              <button onClick={() => setDetailTarget(null)} className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-3 text-sm">
              {[
                { label: t('billing.product'), value: detailTarget.productName },
                { label: t('manufacturing.quantity'), value: String(detailTarget.quantity) },
                { label: t('billing.customer'), value: detailTarget.customerName ?? '—' },
                { label: t('manufacturing.destination'), value: detailTarget.destination ?? '—' },
                { label: t('manufacturing.deliveryDate'), value: detailTarget.deliveryDate ? formatDate(detailTarget.deliveryDate) : '—' },
                { label: t('common.notes'), value: detailTarget.notes ?? '—' },
                { label: t('common.createdAt'), value: formatDate(detailTarget.createdAt) },
              ].map(row => (
                <div key={row.label} className="flex justify-between gap-4">
                  <span className="text-text-secondary">{row.label}</span>
                  <span className="font-medium text-text-primary text-right">{row.value}</span>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6 flex gap-3">
              {detailTarget.status === 'READY' && (
                <button onClick={() => { markDispatched(detailTarget); setDetailTarget(null) }}
                  className="flex-1 h-12 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors">
                  {t('manufacturing.markDispatched')}
                </button>
              )}
              {detailTarget.status === 'DISPATCHED' && (
                <button onClick={() => { markDelivered(detailTarget); setDetailTarget(null) }}
                  className="flex-1 h-12 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors">
                  {t('manufacturing.markDelivered')}
                </button>
              )}
              <button onClick={() => setDetailTarget(null)} className="flex-1 h-12 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-surface-hover transition-colors">
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
