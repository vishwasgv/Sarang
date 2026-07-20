import React, { useEffect, useState, useCallback } from 'react'
import { Factory, Plus, RefreshCw, X, CheckCircle2, PlayCircle, XCircle, FileText, ListChecks, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@renderer/services/ipc-client'
import { useNotificationStore } from '@app/store/notification.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatNumber, formatDate } from '@shared/utils/locale.util'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { KpiCard } from '@shared/ui/molecules/KpiCard'
import { Tabs } from '@shared/ui/molecules/Tabs'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'

interface WorkOrderStep {
  id: string
  stepNumber: number
  taskName: string
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'SKIPPED'
  // Phase 58 §2 — QC/inspection gate
  isQcStep: boolean
  qcResult: 'PASS' | 'FAIL' | null
  qcNotes: string | null
  notes: string | null
}

interface MaterialUsage {
  id: string
  rawMaterialId: string | null
  materialName: string | null
  materialUnit: string | null
  // Phase 58 §2 — multi-level BOM: set instead of the material* fields for a
  // component-Product (sub-assembly) usage row.
  componentProductId: string | null
  componentProductName: string | null
  quantityPlanned: number
  quantityActual: number
  unitCost: number
  // Phase 58 §2 — raw-material lot/batch traceability
  batchConsumption: Array<{ batchId: string; batchNumber: string; quantityConsumed: number }>
}

interface ProductionOrder {
  id: string
  orderNumber: string
  productId: string
  productName: string
  plannedQty: number
  producedQty: number
  // Phase 58 §2 — scrap/reject tracking + labor costing
  scrapQty: number
  laborCost: number
  status: 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  startDate: string | null
  completedDate: string | null
  notes: string | null
  totalMaterialCost: number
  materialUsage: MaterialUsage[]
  createdAt: string
}

interface ProductOption { id: string; productName: string }

// tKey only — covers every value of ProductionOrder['status'] ('DRAFT' | 'IN_PROGRESS' |
// 'COMPLETED' | 'CANCELLED'). Badge coloring lives in STATUS_VARIANT below.
const STATUS_CONFIG: Record<string, { tKey: string }> = {
  DRAFT:       { tKey: 'manufacturing.statusDraft' },
  IN_PROGRESS: { tKey: 'manufacturing.statusInProgress' },
  COMPLETED:   { tKey: 'manufacturing.statusCompleted' },
  CANCELLED:   { tKey: 'manufacturing.statusCancelled' },
}

// The ?? 'neutral' fallback below is a safety net only, never the primary mapping —
// every value of ProductionOrder['status'] is covered explicitly.
const STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'success' | 'danger'> = {
  DRAFT: 'neutral',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  CANCELLED: 'danger',
}

const WO_STATUS_KEY: Record<string, string> = {
  PENDING:     'manufacturing.woStatusPending',
  IN_PROGRESS: 'manufacturing.woStatusInProgress',
  DONE:        'manufacturing.woStatusDone',
  SKIPPED:     'manufacturing.woStatusSkipped',
}

// Preserves the original ternary's behavior exactly: PENDING and SKIPPED both
// rendered neutral, IN_PROGRESS info, DONE success. Covers every value of
// WorkOrderStep['status'].
const WO_STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'success'> = {
  PENDING: 'neutral',
  IN_PROGRESS: 'info',
  DONE: 'success',
  SKIPPED: 'neutral',
}

const STATUS_FILTERS = ['ALL', 'DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']

export function ProductionOrdersScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')

  // New order modal
  const [showNew, setShowNew] = useState(false)
  const [selectedProductName, setSelectedProductName] = useState('')
  const [productQuery, setProductQuery] = useState('')
  const [productResults, setProductResults] = useState<ProductOption[]>([])
  const [newForm, setNewForm] = useState({ productId: '', plannedQty: '', notes: '' })
  const [creating, setCreating] = useState(false)

  // Detail / action modal
  const [detailOrder, setDetailOrder] = useState<ProductionOrder | null>(null)
  const [workOrders, setWorkOrders] = useState<WorkOrderStep[]>([])
  const [actionBusy, setActionBusy] = useState(false)
  const [completeQty, setCompleteQty] = useState('')
  // Phase 58 §2 — scrap/reject qty + labor cost, folded into the produced
  // unit's cost basis on completion.
  const [completeScrapQty, setCompleteScrapQty] = useState('')
  const [completeLaborCost, setCompleteLaborCost] = useState('')
  const [cancelNotes, setCancelNotes] = useState('')
  const [showComplete, setShowComplete] = useState(false)
  const [showCancel, setShowCancel] = useState(false)

  // Work order editor
  const [showWOEditor, setShowWOEditor] = useState(false)
  const [woSteps, setWoSteps] = useState<Array<{ taskName: string; notes: string; isQcStep: boolean }>>([{ taskName: '', notes: '', isQcStep: false }])
  const [savingWO, setSavingWO] = useState(false)

  // Phase 58 §2 — QC pass/fail prompt, shown instead of a plain toggle when
  // marking a QC-flagged step DONE (server requires a result either way —
  // this just makes it a real prompt instead of a silent rejection).
  const [qcTarget, setQcTarget] = useState<WorkOrderStep | null>(null)
  const [qcNotesInput, setQcNotesInput] = useState('')

  // Start-order confirmation
  const [startTarget, setStartTarget] = useState<ProductionOrder | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.production.list(statusFilter !== 'ALL' ? { status: statusFilter } : undefined)
      if (res.success && res.data) {
        const d = res.data as { orders: ProductionOrder[] }
        setOrders(d.orders)
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, toastError, t])

  useEffect(() => { loadData() }, [loadData])

  function openNew() {
    setNewForm({ productId: '', plannedQty: '', notes: '' })
    setSelectedProductName(''); setProductQuery(''); setProductResults([])
    setShowNew(true)
  }

  useEffect(() => {
    if (!productQuery.trim()) { setProductResults([]); return }
    const t = setTimeout(async () => {
      const res = await api.products.search(productQuery.trim())
      if (res.success && res.data) setProductResults(res.data as ProductOption[])
    }, 250)
    return () => clearTimeout(t)
  }, [productQuery])

  async function handleCreate() {
    if (!newForm.productId) { toastError(t('manufacturing.selectProduct')); return }
    const qty = parseFloat(newForm.plannedQty)
    if (!qty || qty <= 0) { toastError(t('common.enterValidQty')); return }
    setCreating(true)
    const res = await api.production.create({ productId: newForm.productId, plannedQty: qty, notes: newForm.notes || undefined })
    setCreating(false)
    if (res.success) {
      toastSuccess(t('manufacturing.orderCreated'))
      setShowNew(false)
      loadData()
    } else {
      toastError(res.error?.message ?? t('manufacturing.saveFailed'))
    }
  }

  async function handleStart() {
    if (!startTarget) return
    const order = startTarget
    setActionBusy(true)
    const res = await api.production.start({ id: order.id })
    setActionBusy(false)
    setStartTarget(null)
    if (res.success) {
      toastSuccess(t('manufacturing.orderStarted', { number: order.orderNumber }))
      setDetailOrder(res.data as ProductionOrder)
      loadData()
    } else {
      toastError(res.error?.message ?? t('manufacturing.actionFailed'))
    }
  }

  async function handleComplete() {
    if (!detailOrder) return
    const qty = parseFloat(completeQty)
    if (!qty || qty <= 0) { toastError(t('manufacturing.enterProducedQty')); return }
    const scrapQty = parseFloat(completeScrapQty) || 0
    const laborCost = parseFloat(completeLaborCost) || 0
    setActionBusy(true)
    const res = await api.production.complete({ id: detailOrder.id, producedQty: qty, scrapQty, laborCost })
    setActionBusy(false)
    if (res.success) {
      toastSuccess(t('manufacturing.orderCompleted', { qty }))
      setShowComplete(false)
      setDetailOrder(res.data as ProductionOrder)
      loadData()
    } else {
      toastError(res.error?.message ?? t('manufacturing.actionFailed'))
    }
  }

  async function handleCancel() {
    if (!detailOrder) return
    setActionBusy(true)
    const res = await api.production.cancel({ id: detailOrder.id, notes: cancelNotes || undefined })
    setActionBusy(false)
    if (res.success) {
      toastSuccess(t('manufacturing.orderCancelledMsg', { number: detailOrder.orderNumber }))
      setShowCancel(false)
      setDetailOrder(null)
      loadData()
    } else {
      toastError(res.error?.message ?? t('manufacturing.actionFailed'))
    }
  }

  async function openDetail(order: ProductionOrder) {
    const [detRes, woRes] = await Promise.all([
      api.production.get({ id: order.id }),
      api.workOrders.list({ productionOrderId: order.id })
    ])
    if (detRes.success && detRes.data) setDetailOrder(detRes.data as ProductionOrder)
    else setDetailOrder(order)
    if (woRes.success && woRes.data) setWorkOrders((woRes.data as WorkOrderStep[]) ?? [])
    else setWorkOrders([])
  }

  async function handleWorkOrderStatusToggle(wo: WorkOrderStep) {
    if (wo.status === 'DONE') {
      // Un-mark done — no QC result required to go backward.
      const res = await api.workOrders.updateStatus({ id: wo.id, status: 'PENDING' })
      if (res.success) setWorkOrders(prev => prev.map(w => w.id === wo.id ? { ...w, status: 'PENDING' } : w))
      else toastError(res.error?.message ?? t('common.updated'))
      return
    }
    // Phase 58 §2 — a QC-flagged step requires a real pass/fail result
    // before it can be marked done (server-enforced too, not just this UI
    // gate) — route to the QC prompt instead of a plain toggle.
    if (wo.isQcStep) {
      setQcTarget(wo)
      setQcNotesInput('')
      return
    }
    const res = await api.workOrders.updateStatus({ id: wo.id, status: 'DONE' })
    if (res.success) {
      setWorkOrders(prev => prev.map(w => w.id === wo.id ? { ...w, status: 'DONE' } : w))
    } else {
      toastError(res.error?.message ?? t('common.updated'))
    }
  }

  async function submitQcResult(result: 'PASS' | 'FAIL') {
    if (!qcTarget) return
    const res = await api.workOrders.updateStatus({ id: qcTarget.id, status: 'DONE', qcResult: result, qcNotes: qcNotesInput || undefined })
    if (res.success) {
      setWorkOrders(prev => prev.map(w => w.id === qcTarget.id ? { ...w, status: 'DONE', qcResult: result, qcNotes: qcNotesInput || null } : w))
      setQcTarget(null)
    } else {
      toastError(res.error?.message ?? t('common.updated'))
    }
  }

  function openWOEditor() {
    setWoSteps(
      workOrders.length > 0
        ? workOrders.map(w => ({ taskName: w.taskName, notes: w.notes ?? '', isQcStep: w.isQcStep }))
        : [{ taskName: '', notes: '', isQcStep: false }]
    )
    setShowWOEditor(true)
  }

  async function saveWorkOrders() {
    if (!detailOrder) return
    const valid = woSteps.filter(s => s.taskName.trim())
    if (valid.length === 0) { toastError(t('manufacturing.addOneStep')); return }
    setSavingWO(true)
    const res = await api.workOrders.upsert({
      productionOrderId: detailOrder.id,
      steps: valid.map((s, i) => ({ stepNumber: i + 1, taskName: s.taskName.trim(), notes: s.notes.trim() || undefined, isQcStep: s.isQcStep }))
    })
    setSavingWO(false)
    if (res.success && res.data) {
      setWorkOrders(res.data as WorkOrderStep[])
      toastSuccess(t('manufacturing.stepsSaved'))
      setShowWOEditor(false)
    } else {
      toastError(res.error?.message ?? t('manufacturing.saveFailed'))
    }
  }

  const draftCount = orders.filter(o => o.status === 'DRAFT').length
  const inProgressCount = orders.filter(o => o.status === 'IN_PROGRESS').length

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <Factory size={24} className="text-brand" />
              {t('manufacturing.productionOrders')}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {draftCount > 0 && <span className="mr-3">{t('manufacturing.draftsCount', { count: draftCount })}</span>}
              {inProgressCount > 0 && <span className="text-blue-600 font-medium">{t('manufacturing.inProgressCount', { count: inProgressCount })}</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadData} className="h-11 w-11 flex items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-hover transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={openNew} className="flex items-center gap-2 px-5 h-11 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-hover transition-colors">
              <Plus size={16} /> {t('manufacturing.newOrder')}
            </button>
          </div>
        </div>

        {/* Status filter tabs */}
        <Tabs
          className="mt-4"
          tabs={STATUS_FILTERS.map(s => ({ id: s, label: s === 'ALL' ? t('common.all') : t(STATUS_CONFIG[s]?.tKey ?? s) }))}
          active={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      {/* Orders list */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
            <Factory size={40} className="mb-3 opacity-30" />
            <p className="text-base font-medium">{t('manufacturing.noOrders')}</p>
            <p className="text-sm mt-1">{t('manufacturing.noOrdersDesc')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => {
              const sc = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.DRAFT
              return (
                <Card
                  key={order.id}
                  padding="lg"
                  hoverable
                  className="cursor-pointer"
                  onClick={() => openDetail(order)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold text-brand">{order.orderNumber}</span>
                      <Badge variant={STATUS_VARIANT[order.status] ?? 'neutral'} size="sm">{t(sc.tKey)}</Badge>
                    </div>
                    <p className="text-xs text-text-secondary">{formatDate(order.createdAt)}</p>
                  </div>
                  <div className="mt-2">
                    <p className="font-semibold text-text-primary">{order.productName}</p>
                    <div className="flex items-center gap-4 mt-1 text-sm text-text-secondary">
                      <span>{t('manufacturing.planLabel')}: <strong className="text-text-primary">{order.plannedQty} {t('common.units')}</strong></span>
                      {order.status === 'COMPLETED' && <span>{t('manufacturing.producedLabel')}: <strong className="text-success">{order.producedQty} {t('common.units')}</strong></span>}
                      {order.totalMaterialCost > 0 && <span>{t('manufacturing.matCostLabel')}: <strong className="text-text-primary">{formatCurrency(order.totalMaterialCost)}</strong></span>}
                    </div>
                  </div>
                  {order.status === 'DRAFT' && (
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={e => { e.stopPropagation(); setStartTarget(order) }}
                        disabled={actionBusy}
                        className="flex items-center gap-2 px-4 h-9 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        <PlayCircle size={14} /> {t('manufacturing.startProduction')}
                      </button>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* New Order Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">{t('manufacturing.newOrder')}</h2>
              <button onClick={() => setShowNew(false)} className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">{t('manufacturing.productToManufacture')} *</label>
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-secondary" />
                  <input
                    value={newForm.productId ? selectedProductName : productQuery}
                    onChange={e => { setNewForm(p => ({ ...p, productId: '' })); setSelectedProductName(''); setProductQuery(e.target.value) }}
                    placeholder="Search product by name or SKU…"
                    className="w-full h-12 pl-10 pr-4 rounded-xl border border-border bg-surface text-base focus:outline-none focus:ring-2 focus:ring-brand" />
                  {productResults.length > 0 && !newForm.productId && (
                    <div className="absolute z-10 mt-1 w-full border border-border rounded-xl overflow-hidden divide-y divide-border bg-white dark:bg-slate-900 shadow-lg max-h-56 overflow-y-auto">
                      {productResults.map(p => (
                        <button key={p.id} type="button"
                          onClick={() => { setNewForm(f => ({ ...f, productId: p.id })); setSelectedProductName(p.productName); setProductQuery(''); setProductResults([]) }}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-brand/5 transition-colors text-text-primary">
                          {p.productName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">{t('manufacturing.plannedQuantity')} *</label>
                <input
                  type="number"
                  min="1"
                  value={newForm.plannedQty}
                  onChange={e => setNewForm(p => ({ ...p, plannedQty: e.target.value }))}
                  className="w-full h-12 px-4 rounded-xl border border-border bg-surface text-base focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder={t('manufacturing.enterUnitsToProduce')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">{t('common.notes')} ({t('common.optional')})</label>
                <input
                  value={newForm.notes}
                  onChange={e => setNewForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full h-12 px-4 rounded-xl border border-border bg-surface text-base focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder={t('manufacturing.anyInstructions')}
                />
              </div>
              <p className="text-xs text-text-secondary bg-blue-50 border border-blue-100 rounded-lg p-3">
                {t('manufacturing.bomHint')}
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowNew(false)} className="flex-1 h-12 rounded-xl border border-border text-text-secondary hover:bg-surface-hover font-medium text-base transition-colors">{t('common.cancel')}</button>
              <button onClick={handleCreate} disabled={creating} className="flex-1 h-12 rounded-xl bg-brand text-white font-semibold text-base hover:bg-brand-hover disabled:opacity-50 transition-colors">
                {creating ? t('cashClose.saving') : t('manufacturing.newOrder')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailOrder && !showComplete && !showCancel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">{detailOrder.orderNumber}</h2>
                  <p className="text-sm text-text-secondary">{detailOrder.productName}</p>
                </div>
                <Badge variant={STATUS_VARIANT[detailOrder.status] ?? 'neutral'} size="sm">
                  {t(STATUS_CONFIG[detailOrder.status]?.tKey ?? detailOrder.status)}
                </Badge>
              </div>
              <button onClick={() => setDetailOrder(null)} className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <div className="grid grid-cols-3 gap-4 mb-5">
                <KpiCard
                  label={t('manufacturing.planned')}
                  value={`${detailOrder.plannedQty} ${t('common.units')}`}
                  color="neutral"
                  className="text-center"
                />
                <KpiCard
                  label={t('manufacturing.producedStat')}
                  value={`${detailOrder.producedQty} ${t('common.units')}`}
                  color={detailOrder.producedQty > 0 ? 'success' : 'neutral'}
                  className="text-center"
                />
                <KpiCard
                  label={t('manufacturing.materialCost')}
                  value={formatCurrency(detailOrder.totalMaterialCost)}
                  color="brand"
                  className="text-center"
                />
              </div>
              {(detailOrder.scrapQty > 0 || detailOrder.laborCost > 0) && (
                <div className="grid grid-cols-2 gap-4 mb-5">
                  <KpiCard
                    label={t('manufacturing.scrapQtyLabel')}
                    value={`${detailOrder.scrapQty} ${t('common.units')}`}
                    color={detailOrder.scrapQty > 0 ? 'danger' : 'neutral'}
                    className="text-center"
                  />
                  <KpiCard
                    label={t('manufacturing.laborCostLabel')}
                    value={formatCurrency(detailOrder.laborCost)}
                    color="brand"
                    className="text-center"
                  />
                </div>
              )}

              {detailOrder.notes && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 flex items-start gap-2">
                  <FileText size={14} className="text-amber-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-800">{detailOrder.notes}</p>
                </div>
              )}

              {/* Material Usage Table */}
              {detailOrder.materialUsage.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-2">{t('manufacturing.materialUsage')}</h3>
                  <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-surface-alt">
                        <tr>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-secondary">{t('manufacturing.material')}</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-secondary">{t('manufacturing.planned')}</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-secondary">{t('manufacturing.producedStat')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {detailOrder.materialUsage.map(u => (
                          <tr key={u.id}>
                            <td className="px-4 py-2.5 text-text-primary">
                              {u.materialName ?? u.componentProductName}
                              {u.componentProductId && <span className="ml-1.5 text-xs text-brand/70">{t('manufacturing.subAssemblyTag')}</span>}
                              {/* Phase 58 §2 — raw-material lot/batch traceability */}
                              {u.batchConsumption.length > 0 && (
                                <p className="text-xs text-text-secondary mt-0.5">
                                  {t('manufacturing.lotsUsed')}: {u.batchConsumption.map(b => `${b.batchNumber} (${formatNumber(b.quantityConsumed, { maximumFractionDigits: 3 })})`).join(', ')}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right text-text-secondary">{formatNumber(u.quantityPlanned, { maximumFractionDigits: 3 })} {u.materialUnit ?? ''}</td>
                            <td className="px-4 py-2.5 text-right text-text-primary font-medium">{formatNumber(u.quantityActual, { maximumFractionDigits: 3 })} {u.materialUnit ?? ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Work Orders */}
              {(workOrders.length > 0 || (detailOrder.status === 'DRAFT' || detailOrder.status === 'IN_PROGRESS')) && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <ListChecks size={14} /> {t('manufacturing.workSteps')} {workOrders.length > 0 && t('manufacturing.workStepsDone', { done: workOrders.filter(w => w.status === 'DONE').length, total: workOrders.length })}
                    </h3>
                    {(detailOrder.status === 'DRAFT' || detailOrder.status === 'IN_PROGRESS') && (
                      <button onClick={openWOEditor} className="text-xs text-brand hover:underline">
                        {workOrders.length > 0 ? t('manufacturing.editSteps') : t('manufacturing.addSteps')}
                      </button>
                    )}
                  </div>
                  {workOrders.length === 0 ? (
                    <p className="text-xs text-text-secondary py-3 text-center border border-dashed border-border rounded-xl">
                      {t('manufacturing.noStepsHint')}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {workOrders.map(wo => (
                        <div key={wo.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface">
                          <button
                            onClick={() => handleWorkOrderStatusToggle(wo)}
                            disabled={detailOrder.status === 'COMPLETED' || detailOrder.status === 'CANCELLED'}
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${wo.status === 'DONE' ? 'bg-success border-success' : 'border-slate-300 hover:border-brand'}`}
                          >
                            {wo.status === 'DONE' && <CheckCircle2 size={12} className="text-white" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${wo.status === 'DONE' ? 'line-through text-text-secondary' : 'text-text-primary'}`}>
                              {wo.stepNumber}. {wo.taskName}
                              {wo.isQcStep && <span className="ml-1.5 text-xs font-normal text-brand/70">{t('manufacturing.qcCheckpointTag')}</span>}
                            </p>
                            {wo.notes && <p className="text-xs text-text-secondary mt-0.5">{wo.notes}</p>}
                            {wo.qcNotes && <p className="text-xs text-text-secondary mt-0.5">{t('manufacturing.qcNotesLabel')}: {wo.qcNotes}</p>}
                          </div>
                          {wo.isQcStep && wo.qcResult && (
                            <Badge variant={wo.qcResult === 'PASS' ? 'success' : 'danger'} size="sm" className="shrink-0">
                              {wo.qcResult === 'PASS' ? t('manufacturing.qcPass') : t('manufacturing.qcFail')}
                            </Badge>
                          )}
                          <Badge variant={WO_STATUS_VARIANT[wo.status] ?? 'neutral'} size="sm" className="shrink-0">
                            {t(WO_STATUS_KEY[wo.status] ?? WO_STATUS_KEY.PENDING)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            {(detailOrder.status === 'DRAFT' || detailOrder.status === 'IN_PROGRESS') && (
              <div className="px-6 pb-6 shrink-0 flex gap-3 border-t border-border pt-4">
                {detailOrder.status === 'DRAFT' && (
                  <button
                    onClick={() => setStartTarget(detailOrder)}
                    disabled={actionBusy}
                    className="flex-1 h-12 rounded-xl bg-blue-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    <PlayCircle size={16} /> {t('manufacturing.startProduction')}
                  </button>
                )}
                {detailOrder.status === 'IN_PROGRESS' && (
                  <button
                    onClick={() => { setCompleteQty(String(detailOrder.plannedQty)); setCompleteScrapQty(''); setCompleteLaborCost(''); setShowComplete(true) }}
                    className="flex-1 h-12 rounded-xl bg-green-600 text-white font-semibold flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle2 size={16} /> {t('manufacturing.markComplete')}
                  </button>
                )}
                <button
                  onClick={() => { setCancelNotes(''); setShowCancel(true) }}
                  className="h-12 px-5 rounded-xl border border-red-200 text-red-600 font-medium flex items-center gap-2 hover:bg-red-50 transition-colors"
                >
                  <XCircle size={16} /> {t('common.cancel')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Work Order Editor Modal */}
      {showWOEditor && detailOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{t('manufacturing.workSteps')}</h2>
                <p className="text-sm text-text-secondary">{detailOrder.orderNumber}</p>
              </div>
              <button onClick={() => setShowWOEditor(false)} className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-auto p-6 space-y-3">
              {woSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      value={step.taskName}
                      onChange={e => setWoSteps(prev => prev.map((s, j) => j === i ? { ...s, taskName: e.target.value } : s))}
                      placeholder={t('manufacturing.stepNameHint', { number: i + 1 })}
                      className="w-full h-10 rounded-xl border border-border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                    <input
                      type="text"
                      value={step.notes}
                      onChange={e => setWoSteps(prev => prev.map((s, j) => j === i ? { ...s, notes: e.target.value } : s))}
                      placeholder={`${t('common.notes')} (${t('common.optional')})`}
                      className="w-full h-9 rounded-xl border border-border px-3 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                    <label className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <input
                        type="checkbox"
                        checked={step.isQcStep}
                        onChange={e => setWoSteps(prev => prev.map((s, j) => j === i ? { ...s, isQcStep: e.target.checked } : s))}
                        className="h-3.5 w-3.5 rounded border-border text-brand focus:ring-brand"
                      />
                      {t('manufacturing.markAsQcStep')}
                    </label>
                  </div>
                  <button
                    onClick={() => setWoSteps(prev => prev.filter((_, j) => j !== i))}
                    disabled={woSteps.length <= 1}
                    className="mt-1 p-1.5 rounded-lg text-text-secondary hover:text-red-500 hover:bg-red-50 disabled:opacity-30 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button onClick={() => setWoSteps(prev => [...prev, { taskName: '', notes: '', isQcStep: false }])}
                className="w-full h-9 rounded-xl border border-dashed border-border text-sm text-text-secondary hover:border-brand hover:text-brand transition-colors">
                {t('manufacturing.addStep')}
              </button>
            </div>
            <div className="px-6 pb-6 pt-4 border-t border-border flex gap-3 shrink-0">
              <button onClick={() => setShowWOEditor(false)} className="flex-1 h-12 rounded-xl border border-border text-sm font-medium text-text-secondary hover:bg-surface-hover transition-colors">{t('common.cancel')}</button>
              <button onClick={saveWorkOrders} disabled={savingWO}
                className="flex-1 h-12 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-40 transition-colors">
                {savingWO ? t('cashClose.saving') : t('manufacturing.saveSteps')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Modal */}
      {showComplete && detailOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">{t('manufacturing.completeOrder')}</h2>
              <button onClick={() => setShowComplete(false)} className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-text-secondary">{t('manufacturing.completeHint', { product: detailOrder.productName })}</p>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">{t('manufacturing.producedQtyLabel')}</label>
                <input
                  autoFocus
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={completeQty}
                  onChange={e => setCompleteQty(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-border bg-surface text-base focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder={`${t('manufacturing.planLabel')}: ${detailOrder.plannedQty}`}
                />
              </div>
              {/* Phase 58 §2 — scrap/reject qty + labor cost, both optional
                  (default 0, unchanged behavior if left blank), folded into
                  the produced unit's cost basis on completion. */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">{t('manufacturing.scrapQtyLabel')} ({t('common.optional')})</label>
                  <input
                    type="number" min="0" step="0.001"
                    value={completeScrapQty}
                    onChange={e => setCompleteScrapQty(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border border-border bg-surface text-base focus:outline-none focus:ring-2 focus:ring-brand"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">{t('manufacturing.laborCostLabel')} ({t('common.optional')})</label>
                  <input
                    type="number" min="0" step="0.01"
                    value={completeLaborCost}
                    onChange={e => setCompleteLaborCost(e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border border-border bg-surface text-base focus:outline-none focus:ring-2 focus:ring-brand"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowComplete(false)} className="flex-1 h-12 rounded-xl border border-border text-text-secondary hover:bg-surface-hover font-medium transition-colors">{t('billing.goBack')}</button>
              <button onClick={handleComplete} disabled={actionBusy} className="flex-1 h-12 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
                {actionBusy ? t('cashClose.saving') : t('manufacturing.markComplete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 58 §2 — QC pass/fail prompt */}
      {qcTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">{t('manufacturing.qcResultTitle')}</h2>
              <button onClick={() => setQcTarget(null)} className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-text-secondary">{qcTarget.taskName}</p>
              <input
                autoFocus
                value={qcNotesInput}
                onChange={e => setQcNotesInput(e.target.value)}
                placeholder={`${t('manufacturing.qcNotesLabel')} (${t('common.optional')})`}
                className="w-full h-12 px-4 rounded-xl border border-border bg-surface text-base focus:outline-none focus:ring-2 focus:ring-brand"
              />
              <div className="flex gap-3">
                <button onClick={() => submitQcResult('FAIL')} className="flex-1 h-12 rounded-xl border border-red-200 text-red-600 font-semibold hover:bg-red-50 transition-colors">
                  {t('manufacturing.qcFail')}
                </button>
                <button onClick={() => submitQcResult('PASS')} className="flex-1 h-12 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors">
                  {t('manufacturing.qcPass')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancel && detailOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">{t('manufacturing.cancelOrder')}</h2>
              <button onClick={() => setShowCancel(false)} className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {detailOrder.status === 'IN_PROGRESS' && (
                <p className="text-sm bg-amber-50 border border-amber-100 rounded-lg p-3 text-amber-800">
                  {t('manufacturing.cancelHint')}
                </p>
              )}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">{t('common.reason')} ({t('common.optional')})</label>
                <input
                  autoFocus
                  value={cancelNotes}
                  onChange={e => setCancelNotes(e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-border bg-surface text-base focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder={t('manufacturing.whyCancelling')}
                />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowCancel(false)} className="flex-1 h-12 rounded-xl border border-border text-text-secondary hover:bg-surface-hover font-medium transition-colors">{t('billing.goBack')}</button>
              <button onClick={handleCancel} disabled={actionBusy} className="flex-1 h-12 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
                {actionBusy ? t('cashClose.saving') : t('manufacturing.cancelOrder')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!startTarget}
        onClose={() => setStartTarget(null)}
        onConfirm={handleStart}
        loading={actionBusy}
        title={t('manufacturing.startProduction')}
        message={startTarget ? t('manufacturing.confirmStartOrder', { number: startTarget.orderNumber }) : ''}
        confirmLabel={t('manufacturing.startProduction')}
        confirmVariant="primary"
      />
    </div>
  )
}
