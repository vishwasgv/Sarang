import React, { useState, useEffect, useCallback } from 'react'
import { FlaskConical, Plus, RefreshCw, Trash2, Printer, X } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useAuthStore } from '@app/store/auth.store'
import { useBusinessStore } from '@app/store/business.store'
import { useNotificationStore } from '@app/store/notification.store'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { Tabs } from '@shared/ui/molecules/Tabs'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'
import { LabReportPrint } from './LabReportPrint'

type LabOrderStatus = 'ORDERED' | 'SAMPLE_COLLECTED' | 'IN_PROCESS' | 'REPORTED' | 'DELIVERED' | 'CANCELLED'
type LabItemStatus = 'PENDING' | 'COLLECTED' | 'RESULT_READY' | 'REPORTED'
type SampleType = 'BLOOD' | 'URINE' | 'STOOL' | 'SWAB' | 'IMAGING' | 'OTHER'

interface ResultParameter { parameter: string; value: string; unit?: string; referenceRange?: string; flag?: 'LOW' | 'NORMAL' | 'HIGH' | 'ABNORMAL' }

interface LabTestOrderItem {
  id: string
  testName: string
  category: string | null
  sampleType: SampleType
  price: number
  status: LabItemStatus
  resultParameters: string
  resultSummary: string | null
}

interface LabTestOrder {
  id: string
  orderNumber: string
  customerId: string | null
  patientName: string
  patientAge: string | null
  referringNotes: string | null
  notes: string | null
  status: LabOrderStatus
  totalAmount: number
  invoiceId: string | null
  createdAt: string
  items: LabTestOrderItem[]
  customer?: { customerName: string } | null
}

interface Customer { id: string; customerName: string }
interface ServiceCatalogEntry { id: string; serviceName: string; category: string | null; basePrice: number }

const STATUS_TABS: (LabOrderStatus | 'ALL')[] = ['ALL', 'ORDERED', 'SAMPLE_COLLECTED', 'IN_PROCESS', 'REPORTED', 'DELIVERED', 'CANCELLED']
const STATUS_LABEL: Record<LabOrderStatus, string> = {
  ORDERED: 'Ordered',
  SAMPLE_COLLECTED: 'Sample Collected',
  IN_PROCESS: 'In Process',
  REPORTED: 'Reported',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
}
const STATUS_VARIANT: Record<LabOrderStatus, 'info' | 'brand' | 'warning' | 'success' | 'neutral' | 'danger'> = {
  ORDERED: 'info', SAMPLE_COLLECTED: 'brand', IN_PROCESS: 'warning',
  REPORTED: 'success', DELIVERED: 'neutral', CANCELLED: 'danger',
}
const ITEM_STATUS_VARIANT: Record<LabItemStatus, 'neutral' | 'brand' | 'warning' | 'success'> = {
  PENDING: 'neutral', COLLECTED: 'brand', RESULT_READY: 'warning', REPORTED: 'success',
}

const BLANK_ITEM = { serviceCatalogId: '', testName: '', category: '', sampleType: 'BLOOD' as SampleType, price: '' }
const BLANK_FORM = { customerId: '', patientName: '', patientAge: '', referringNotes: '', notes: '' }

export function LabOrdersScreen() {
  const { hasPermission } = useAuthStore()
  const profile = useBusinessStore((s) => s.profile)
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canCreate = hasPermission('labOrders.create')
  const canManage = hasPermission('labOrders.manage')

  const [orders, setOrders] = useState<LabTestOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [catalog, setCatalog] = useState<ServiceCatalogEntry[]>([])
  const [activeTab, setActiveTab] = useState<LabOrderStatus | 'ALL'>('ALL')
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [items, setItems] = useState([{ ...BLANK_ITEM }])
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState<LabTestOrder | null>(null)
  const [editingResultFor, setEditingResultFor] = useState<string | null>(null)
  const [resultParams, setResultParams] = useState<ResultParameter[]>([{ parameter: '', value: '', unit: '', referenceRange: '', flag: 'NORMAL' }])
  const [resultSummary, setResultSummary] = useState('')
  const [showPrint, setShowPrint] = useState(false)

  // Phase 54B — once a lab has saved a normal range for a test name (Settings
  // > Normal Ranges), typing that same test + a value here auto-fills the
  // reference range and LOW/NORMAL/HIGH flag instead of the tech re-deriving
  // it by memory every single time. Only fills fields the tech hasn't
  // already typed themselves — never overwrites a manual entry.
  async function suggestFromNormalRange(pIdx: number): Promise<void> {
    const p = resultParams[pIdx]
    const testName = p.parameter.trim()
    const value = parseFloat(p.value)
    if (!testName || Number.isNaN(value)) return
    const [rangeRes, evalRes] = await Promise.all([
      api.normalRange.find({ testName }),
      api.normalRange.evaluate({ testName, value }),
    ])
    setResultParams((prev) => prev.map((x, i) => {
      if (i !== pIdx) return x
      const range = rangeRes.success ? (rangeRes.data as { minValue: number | null; maxValue: number | null; unit: string | null } | null) : null
      const flag = evalRes.success ? (evalRes.data as { flag: 'LOW' | 'NORMAL' | 'HIGH' | null }).flag : null
      return {
        ...x,
        unit: x.unit ? x.unit : (range?.unit ?? x.unit),
        referenceRange: x.referenceRange ? x.referenceRange : (range && (range.minValue != null || range.maxValue != null) ? `${range.minValue ?? '—'}-${range.maxValue ?? '—'}` : x.referenceRange),
        flag: flag ?? x.flag,
      }
    }))
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [oRes, cRes, sRes] = await Promise.all([
        api.labTestOrders.list({ limit: 200 }),
        api.customers.list({ limit: 500 }),
        api.serviceCatalog.list({ isActive: true }),
      ])
      if (oRes.success && oRes.data) {
        const d = oRes.data as { orders: LabTestOrder[]; total: number }
        setOrders(d.orders ?? [])
      } else {
        toastError('Failed', (oRes.error as { message: string })?.message ?? 'Could not load lab orders.')
      }
      if (cRes.success && cRes.data) {
        const d = cRes.data as { customers: Customer[] }
        setCustomers(d.customers ?? [])
      }
      if (sRes.success && Array.isArray(sRes.data)) {
        setCatalog(sRes.data as ServiceCatalogEntry[])
      }
    } catch {
      toastError('Failed', 'Could not load lab orders.')
    } finally {
      setLoading(false)
    }
  }, [toastError])

  useEffect(() => { load() }, [load])

  const visible = activeTab === 'ALL' ? orders : orders.filter((o) => o.status === activeTab)
  const active = orders.filter((o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED')
  const tabCounts = STATUS_TABS.slice(1).reduce<Record<string, number>>((acc, s) => {
    acc[s] = orders.filter((o) => o.status === s).length
    return acc
  }, {})

  function updateItemRow(idx: number, patch: Partial<typeof BLANK_ITEM>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }

  function pickCatalogEntry(idx: number, catalogId: string) {
    const sc = catalog.find((c) => c.id === catalogId)
    if (!sc) { updateItemRow(idx, { serviceCatalogId: '' }); return }
    updateItemRow(idx, { serviceCatalogId: sc.id, testName: sc.serviceName, category: sc.category ?? '', price: String(sc.basePrice) })
  }

  async function handleCreate() {
    if (!form.patientName.trim()) { toastError('Missing Patient Name', 'Enter the patient\'s name.'); return }
    const validItems = items.filter((i) => i.testName.trim())
    if (validItems.length === 0) { toastError('No Tests Selected', 'Add at least one test or panel.'); return }

    setSaving(true)
    const res = await api.labTestOrders.create({
      customerId: form.customerId || undefined,
      patientName: form.patientName.trim(),
      patientAge: form.patientAge || undefined,
      referringNotes: form.referringNotes || undefined,
      notes: form.notes || undefined,
      items: validItems.map((i) => ({
        serviceCatalogId: i.serviceCatalogId || undefined,
        testName: i.testName.trim(),
        category: i.category || undefined,
        sampleType: i.sampleType,
        price: i.price ? Number(i.price) : 0,
      })),
    })
    setSaving(false)
    if (res.success) {
      toastSuccess('Order Created', 'Lab test order created successfully.')
      setShowCreate(false)
      setForm({ ...BLANK_FORM })
      setItems([{ ...BLANK_ITEM }])
      load()
    } else {
      toastError('Failed', (res.error as { message: string })?.message ?? 'Could not create order.')
    }
  }

  async function refreshDetail(id: string) {
    const res = await api.labTestOrders.get({ id })
    if (res.success && res.data) setDetail(res.data as LabTestOrder)
  }

  async function handleCollectSample(id: string) {
    const res = await api.labTestOrders.markSampleCollected({ id })
    if (res.success) { toastSuccess('Sample Collected', 'Sample collection recorded.'); refreshDetail(id); load() }
    else toastError('Failed', (res.error as { message: string })?.message ?? 'Could not record sample collection.')
  }

  function openResultEditor(item: LabTestOrderItem) {
    setEditingResultFor(item.id)
    let parsed: ResultParameter[] = []
    try { parsed = JSON.parse(item.resultParameters) } catch { parsed = [] }
    setResultParams(parsed.length > 0 ? parsed : [{ parameter: '', value: '', unit: '', referenceRange: '', flag: 'NORMAL' }])
    setResultSummary(item.resultSummary ?? '')
  }

  async function handleSaveResult() {
    if (!editingResultFor || !detail) return
    const cleanParams = resultParams.filter((p) => p.parameter.trim())
    const res = await api.labTestOrders.updateResult({
      itemId: editingResultFor,
      resultParameters: cleanParams.length > 0 ? cleanParams : undefined,
      resultSummary: resultSummary || null,
    })
    if (res.success) {
      toastSuccess('Result Saved', 'Test result saved.')
      setEditingResultFor(null)
      refreshDetail(detail.id)
      load()
    } else {
      toastError('Failed', (res.error as { message: string })?.message ?? 'Could not save result.')
    }
  }

  async function handleFinalize(id: string) {
    const res = await api.labTestOrders.finalizeReport({ id })
    if (res.success) { toastSuccess('Report Finalized', 'Report finalized successfully.'); refreshDetail(id); load() }
    else toastError('Failed', (res.error as { message: string })?.message ?? 'Could not finalize report.')
  }

  async function handleMarkDelivered(id: string) {
    const res = await api.labTestOrders.markDelivered({ id })
    if (res.success) { toastSuccess('Marked Delivered', 'Report marked as delivered.'); refreshDetail(id); load() }
    else toastError('Failed', (res.error as { message: string })?.message ?? 'Could not update.')
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancel this lab test order?')) return
    const res = await api.labTestOrders.cancel({ id })
    if (res.success) { toastSuccess('Order Cancelled', 'Order cancelled.'); refreshDetail(id); load() }
    else toastError('Failed', (res.error as { message: string })?.message ?? 'Could not cancel order.')
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this lab test order? This cannot be undone.')) return
    const res = await api.labTestOrders.delete({ id })
    if (res.success) { toastSuccess('Order Deleted', 'Order deleted.'); setDetail(null); load() }
    else toastError('Failed', (res.error as { message: string })?.message ?? 'Could not delete order.')
  }

  async function handleGenerateInvoice(id: string) {
    const res = await api.labTestOrders.generateInvoice({ id })
    if (res.success) { toastSuccess('Invoice Generated', 'Invoice generated for this order.'); refreshDetail(id); load() }
    else toastError('Failed', (res.error as { message: string })?.message ?? 'Could not generate invoice.')
  }

  const allResultsReady = detail ? detail.items.every((i) => i.status === 'RESULT_READY' || i.status === 'REPORTED') : false

  return (
    <div className="flex flex-col h-full bg-surface">
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <FlaskConical size={24} className="text-brand" />
              Lab Test Orders
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">{active.length} active orders</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="h-11 w-11 flex items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-hover transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            {canCreate && (
              <button onClick={() => setShowCreate(true)} className="h-11 px-4 flex items-center gap-2 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors">
                <Plus size={16} /> New Order
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <Tabs
            tabs={STATUS_TABS.map((tab) => ({
              id: tab,
              label: tab === 'ALL' ? `All (${orders.length})` : `${STATUS_LABEL[tab]} (${tabCounts[tab] ?? 0})`,
            }))}
            active={activeTab}
            onChange={(id) => setActiveTab(id as LabOrderStatus | 'ALL')}
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-text-secondary">
            <FlaskConical size={40} className="mb-3 opacity-30" />
            <p className="text-base font-medium">No lab test orders found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((o) => (
              <button key={o.id} onClick={() => refreshDetail(o.id)}
                className="w-full text-left bg-white dark:bg-slate-900 rounded-xl border border-border p-4 hover:border-brand/40 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs text-text-secondary">{o.orderNumber}</span>
                      <Badge variant={STATUS_VARIANT[o.status]} size="sm">{STATUS_LABEL[o.status]}</Badge>
                    </div>
                    <p className="mt-1 font-semibold text-text-primary">{o.patientName}</p>
                    <p className="text-sm text-text-secondary truncate">{o.items.map((i) => i.testName).join(', ')}</p>
                    {o.customer?.customerName && <p className="text-xs text-text-secondary mt-1">{o.customer.customerName}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-text-primary">{formatCurrency(o.totalAmount)}</p>
                    <p className="text-xs text-text-secondary">{formatDate(o.createdAt)}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-bold text-text-primary">New Lab Test Order</h2>
              <button onClick={() => setShowCreate(false)} className="text-text-secondary hover:text-text-primary"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Patient Name</label>
                  <input value={form.patientName} onChange={(e) => setForm((f) => ({ ...f, patientName: e.target.value }))}
                    className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1">Age</label>
                  <input value={form.patientAge} onChange={(e) => setForm((f) => ({ ...f, patientAge: e.target.value }))}
                    placeholder="e.g. 35 years" className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
                </div>
              </div>
              <Select label="Customer (optional — needed to invoice this order)" value={form.customerId} onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}>
                <option value="">Walk-in / not linked</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.customerName}</option>)}
              </Select>
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Referring Doctor / Clinic (optional)</label>
                <input value={form.referringNotes} onChange={(e) => setForm((f) => ({ ...f, referringNotes: e.target.value }))}
                  className="w-full h-12 px-4 rounded-xl border border-border text-base focus:outline-none focus:border-brand" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-text-primary">Tests / Panels</label>
                  <button onClick={() => setItems((prev) => [...prev, { ...BLANK_ITEM }])} className="text-sm text-brand font-semibold hover:underline">+ Add Test</button>
                </div>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                      <select value={item.serviceCatalogId} onChange={(e) => pickCatalogEntry(idx, e.target.value)}
                        className="col-span-3 h-10 px-2 rounded-lg border border-border text-sm bg-white dark:bg-slate-900">
                        <option value="">Custom…</option>
                        {catalog.map((c) => <option key={c.id} value={c.id}>{c.serviceName}</option>)}
                      </select>
                      <input value={item.testName} onChange={(e) => updateItemRow(idx, { testName: e.target.value })}
                        placeholder="Test name" className="col-span-4 h-10 px-2 rounded-lg border border-border text-sm" />
                      <select value={item.sampleType} onChange={(e) => updateItemRow(idx, { sampleType: e.target.value as SampleType })}
                        className="col-span-2 h-10 px-2 rounded-lg border border-border text-sm bg-white dark:bg-slate-900">
                        {(['BLOOD', 'URINE', 'STOOL', 'SWAB', 'IMAGING', 'OTHER'] as SampleType[]).map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <input type="number" value={item.price} onChange={(e) => updateItemRow(idx, { price: e.target.value })}
                        placeholder="0" min="0" className="col-span-2 h-10 px-2 rounded-lg border border-border text-sm" />
                      <button onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))} disabled={items.length <= 1}
                        className="col-span-1 h-10 flex items-center justify-center text-red-500 disabled:opacity-30">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2} className="w-full px-4 py-3 rounded-xl border border-border text-base focus:outline-none focus:border-brand resize-none" />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => setShowCreate(false)} className="flex-1 h-12 rounded-xl border border-border text-text-secondary font-semibold hover:bg-surface-hover transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !form.patientName.trim()}
                className="flex-1 h-12 rounded-xl bg-brand text-white font-semibold hover:bg-brand-dark transition-colors disabled:opacity-50">
                {saving ? 'Saving…' : 'Create Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="px-6 py-5 border-b border-border flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <span className="font-mono text-xs text-text-secondary">{detail.orderNumber}</span>
                <h2 className="text-lg font-bold text-text-primary mt-0.5">{detail.patientName}</h2>
                {detail.patientAge && <p className="text-sm text-text-secondary">{detail.patientAge}</p>}
              </div>
              <button onClick={() => setDetail(null)} className="text-text-secondary hover:text-text-primary text-2xl leading-none shrink-0">×</button>
            </div>
            <div className="p-6 space-y-4">
              <Badge variant={STATUS_VARIANT[detail.status]} size="sm">{STATUS_LABEL[detail.status]}</Badge>

              {detail.referringNotes && (
                <div className="text-sm"><p className="text-text-secondary">Referred by</p><p className="text-text-primary mt-0.5">{detail.referringNotes}</p></div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-semibold text-text-primary">Tests</p>
                {detail.items.map((item) => (
                  <div key={item.id} className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{item.testName}</p>
                        <p className="text-xs text-text-secondary">{item.sampleType} · {formatCurrency(item.price)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={ITEM_STATUS_VARIANT[item.status]} size="sm">{item.status.replace('_', ' ')}</Badge>
                        {canManage && detail.status !== 'ORDERED' && detail.status !== 'CANCELLED' && detail.status !== 'DELIVERED' && (
                          <button onClick={() => openResultEditor(item)} className="text-xs text-brand font-semibold hover:underline">
                            {item.status === 'PENDING' || item.status === 'COLLECTED' ? 'Enter Result' : 'Edit Result'}
                          </button>
                        )}
                      </div>
                    </div>

                    {editingResultFor === item.id && (
                      <div className="mt-3 pt-3 border-t border-border space-y-2">
                        {resultParams.map((p, pIdx) => (
                          <div key={pIdx} className="grid grid-cols-12 gap-1.5">
                            <input value={p.parameter} onChange={(e) => setResultParams((prev) => prev.map((x, i) => i === pIdx ? { ...x, parameter: e.target.value } : x))}
                              placeholder="Parameter" className="col-span-3 h-9 px-2 rounded-md border border-border text-xs" />
                            <input value={p.value} onChange={(e) => setResultParams((prev) => prev.map((x, i) => i === pIdx ? { ...x, value: e.target.value } : x))}
                              onBlur={() => suggestFromNormalRange(pIdx)}
                              placeholder="Value" className="col-span-2 h-9 px-2 rounded-md border border-border text-xs" />
                            <input value={p.unit ?? ''} onChange={(e) => setResultParams((prev) => prev.map((x, i) => i === pIdx ? { ...x, unit: e.target.value } : x))}
                              placeholder="Unit" className="col-span-2 h-9 px-2 rounded-md border border-border text-xs" />
                            <input value={p.referenceRange ?? ''} onChange={(e) => setResultParams((prev) => prev.map((x, i) => i === pIdx ? { ...x, referenceRange: e.target.value } : x))}
                              placeholder="Reference range" className="col-span-3 h-9 px-2 rounded-md border border-border text-xs" />
                            <select value={p.flag ?? 'NORMAL'} onChange={(e) => setResultParams((prev) => prev.map((x, i) => i === pIdx ? { ...x, flag: e.target.value as ResultParameter['flag'] } : x))}
                              className="col-span-1 h-9 px-1 rounded-md border border-border text-xs bg-white dark:bg-slate-900">
                              {(['LOW', 'NORMAL', 'HIGH', 'ABNORMAL'] as const).map((f) => <option key={f} value={f}>{f[0]}</option>)}
                            </select>
                            <button onClick={() => setResultParams((prev) => prev.filter((_, i) => i !== pIdx))} className="col-span-1 h-9 flex items-center justify-center text-red-500">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                        <button onClick={() => setResultParams((prev) => [...prev, { parameter: '', value: '', unit: '', referenceRange: '', flag: 'NORMAL' }])}
                          className="text-xs text-brand font-semibold hover:underline">+ Add Parameter</button>
                        <textarea value={resultSummary} onChange={(e) => setResultSummary(e.target.value)} rows={2}
                          placeholder="Overall finding / impression (for imaging or summary notes)"
                          className="w-full px-3 py-2 rounded-lg border border-border text-xs resize-none" />
                        <div className="flex gap-2">
                          <button onClick={() => setEditingResultFor(null)} className="flex-1 h-9 rounded-lg border border-border text-xs font-semibold">Cancel</button>
                          <button onClick={handleSaveResult} className="flex-1 h-9 rounded-lg bg-brand text-white text-xs font-semibold">Save Result</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-between text-sm pt-2 border-t border-border">
                <span className="text-text-secondary">Total</span>
                <span className="font-semibold text-text-primary">{formatCurrency(detail.totalAmount)}</span>
              </div>

              {/* Front-desk actions (Cashier-reachable, labOrders.create) — routine
                  registration/billing/handover, not lab-technician-level trust. */}
              {canCreate && (
                <div className="space-y-2">
                  {detail.customerId && !detail.invoiceId && detail.status !== 'CANCELLED' && (
                    <button onClick={() => handleGenerateInvoice(detail.id)} className="w-full h-11 rounded-xl border border-brand text-brand text-sm font-semibold hover:bg-brand/5 transition-colors">
                      Generate Invoice
                    </button>
                  )}
                  {(detail.status === 'REPORTED' || detail.status === 'DELIVERED') && (
                    <button onClick={() => setShowPrint(true)} className="w-full h-11 rounded-xl border border-border text-text-primary text-sm font-semibold hover:bg-surface-hover transition-colors flex items-center justify-center gap-2">
                      <Printer size={14} /> Print Report
                    </button>
                  )}
                </div>
              )}

              {/* Lab-technician-level actions (Manager/Admin only, labOrders.manage) */}
              {canManage && (
                <div className="space-y-2">
                  {detail.status === 'ORDERED' && (
                    <button onClick={() => handleCollectSample(detail.id)} className="w-full h-11 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors">
                      Collect Sample
                    </button>
                  )}
                  {(detail.status === 'SAMPLE_COLLECTED' || detail.status === 'IN_PROCESS') && (
                    <button onClick={() => handleFinalize(detail.id)} disabled={!allResultsReady}
                      className="w-full h-11 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors disabled:opacity-40">
                      {allResultsReady ? 'Finalize Report' : 'Enter all results to finalize'}
                    </button>
                  )}
                  {detail.status === 'REPORTED' && (
                    <button onClick={() => handleMarkDelivered(detail.id)} className="w-full h-11 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-dark transition-colors">
                      Mark Delivered
                    </button>
                  )}
                  {detail.status !== 'DELIVERED' && detail.status !== 'CANCELLED' && (
                    <button onClick={() => handleCancel(detail.id)} className="w-full h-11 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors">
                      Cancel Order
                    </button>
                  )}
                  {detail.status === 'ORDERED' && !detail.invoiceId && (
                    <button onClick={() => handleDelete(detail.id)} className="w-full h-11 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors">
                      Delete Order
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showPrint && detail && (
        <LabReportPrint order={detail} profile={profile} onClose={() => setShowPrint(false)} />
      )}
    </div>
  )
}
