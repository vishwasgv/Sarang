import React, { useEffect, useState, useCallback } from 'react'
import { Plus, AlertTriangle, Clock, CheckCircle2, PackageSearch, Edit, Trash2, Search } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { DataTable } from '@shared/ui/organisms/DataTable'
import { Button } from '@shared/ui/atoms/Button'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { Tabs } from '@shared/ui/molecules/Tabs'
import { useNotificationStore } from '@app/store/notification.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'

interface BatchRow {
  id: string
  productName: string
  batchNumber: string
  expiryDate: string
  mfgDate: string | null
  quantityReceived: number
  quantityRemaining: number
  unitCost: number
  supplierName: string | null
  daysToExpiry: number
  // Phase 58 §2 — this batch's product's own expiry-alert lead time (falls
  // back to the generic 30-day default when the product hasn't set one).
  expiryAlertLeadDays: number
}

interface BatchFormState {
  productId: string
  batchNumber: string
  expiryDate: string
  mfgDate: string
  quantityReceived: string
  unitCost: string
  supplierId: string
}

interface EditFormState {
  expiryDate: string
  mfgDate: string
  quantityRemaining: string
  unitCost: string
}

// Phase 58 §2 — leadDays is per-product (product.expiryAlertLeadDays, falling
// back to 30), not a single hardcoded medicine-shaped cutoff for every item.
function ExpiryBadge({ days, leadDays }: { days: number; leadDays: number }) {
  if (days < 0) {
    return <Badge variant="danger" icon={<AlertTriangle size={12} />}>Expired</Badge>
  }
  if (days <= leadDays) {
    return <Badge variant="warning" icon={<Clock size={12} />}>{days}d</Badge>
  }
  return <Badge variant="success" icon={<CheckCircle2 size={12} />}>{days}d</Badge>
}

export function BatchManagementScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [batches, setBatches] = useState<BatchRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<'all' | 'expiring' | 'expired'>('all')
  const [suppliers, setSuppliers] = useState<{ id: string; supplierName: string }[]>([])
  // Product picker for the Add Batch form — search-as-you-type against
  // products.search() rather than a static, capped list. products.list
  // silently stopped at the first 500 (alphabetically) with no way to reach
  // the rest and no indication anything was missing.
  const [productQuery, setProductQuery] = useState('')
  const [productResults, setProductResults] = useState<{ id: string; productName: string }[]>([])
  const [productName, setProductName] = useState('')
  const [form, setForm] = useState<BatchFormState>({
    productId: '', batchNumber: '', expiryDate: '', mfgDate: '', quantityReceived: '', unitCost: '', supplierId: ''
  })
  const [alerts, setAlerts] = useState<{ expiring: number; expired: number }>({ expiring: 0, expired: 0 })
  const [editTarget, setEditTarget] = useState<BatchRow | null>(null)
  const [editForm, setEditForm] = useState<EditFormState>({ expiryDate: '', mfgDate: '', quantityRemaining: '', unitCost: '' })
  const [deleteTarget, setDeleteTarget] = useState<BatchRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Phase 58 §2 scope note: this tab is a manual, explicit "what expires
      // in the next 30 days regardless of category" query, deliberately kept
      // as a flat window — different from the automatic per-product-lead-time
      // alerting getExpiryAlerts() now does (used by the Reorder/Dashboard
      // alerts). The ExpiryBadge column above already shows each row's real
      // per-product threshold either way, so a longer-lead-time item (e.g. a
      // seed batch 45 days out) can show a warning badge in the "All" tab
      // without necessarily appearing under this specific 30-day tab filter.
      const payload =
        filter === 'expiring' ? { expiringSoonDays: 30 } :
        filter === 'expired' ? { expired: true } :
        {}
      const res = await window.api.batches.list(payload)
      if (res.success) {
        const d = res.data as { batches: BatchRow[]; total: number }
        setBatches(d.batches ?? [])
        setTotal(d.total ?? 0)
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
      const alertRes = await window.api.batches.expiryAlerts({ withinDays: 30 })
      if (alertRes.success) {
        const ad = alertRes.data as { expiring: unknown[]; expired: unknown[] }
        setAlerts({ expiring: ad.expiring?.length ?? 0, expired: ad.expired?.length ?? 0 })
      } else {
        toastError(t('common.error'), alertRes.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [filter, toastError, t])

  const loadSuppliers = useCallback(async () => {
    try {
      const sRes = await window.api.suppliers.list({ limit: 500 })
      if (sRes.success) {
        const d = sRes.data as { suppliers: { id: string; supplierName: string }[] }
        setSuppliers(d.suppliers ?? [])
      } else {
        toastError(t('common.error'), sRes.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    }
  }, [toastError, t])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { loadSuppliers() }, [loadSuppliers])

  useEffect(() => {
    if (!productQuery.trim()) { setProductResults([]); return }
    const t = setTimeout(async () => {
      const res = await window.api.products.search(productQuery.trim())
      if (res.success && res.data) setProductResults(res.data as { id: string; productName: string }[])
    }, 250)
    return () => clearTimeout(t)
  }, [productQuery])

  function openEdit(batch: BatchRow) {
    setEditTarget(batch)
    setEditForm({
      expiryDate: batch.expiryDate.slice(0, 10),
      mfgDate: batch.mfgDate ? batch.mfgDate.slice(0, 10) : '',
      quantityRemaining: String(batch.quantityRemaining),
      unitCost: String(batch.unitCost)
    })
  }

  async function handleCreate() {
    if (!form.productId || !form.batchNumber || !form.expiryDate || !form.quantityReceived) {
      toastError('Missing Fields', 'Product, batch number, expiry date, and quantity are required.')
      return
    }
    setSaving(true)
    try {
      const qty = parseFloat(form.quantityReceived)
      if (!qty || qty <= 0) {
        toastError('Invalid Quantity', 'Quantity received must be greater than zero.')
        setSaving(false)
        return
      }
      const res = await window.api.batches.create({
        productId: form.productId,
        batchNumber: form.batchNumber,
        expiryDate: form.expiryDate,
        mfgDate: form.mfgDate || undefined,
        quantityReceived: qty,
        unitCost: form.unitCost ? parseFloat(form.unitCost) : undefined,
        supplierId: form.supplierId || undefined
      })
      if (res.success) {
        toastSuccess('Batch Added', `Batch ${form.batchNumber} has been recorded.`)
        setShowForm(false)
        setForm({ productId: '', batchNumber: '', expiryDate: '', mfgDate: '', quantityReceived: '', unitCost: '', supplierId: '' })
        setProductName(''); setProductQuery(''); setProductResults([])
        loadData()
      } else {
        toastError('Failed', (res.error as { message: string })?.message ?? 'Could not add batch.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleEdit() {
    if (!editTarget) return
    if (editForm.quantityRemaining) {
      const remaining = parseFloat(editForm.quantityRemaining)
      if (remaining < 0) { toastError('Invalid Quantity', 'Remaining quantity cannot be negative.'); return }
      if (remaining > editTarget.quantityReceived) {
        toastError('Invalid Quantity', `Remaining (${remaining}) cannot exceed received (${editTarget.quantityReceived}).`)
        return
      }
    }
    setSaving(true)
    try {
      const res = await window.api.batches.update({
        id: editTarget.id,
        expiryDate: editForm.expiryDate || undefined,
        mfgDate: editForm.mfgDate || undefined,
        quantityRemaining: editForm.quantityRemaining ? parseFloat(editForm.quantityRemaining) : undefined,
        unitCost: editForm.unitCost ? parseFloat(editForm.unitCost) : undefined
      })
      if (res.success) {
        toastSuccess('Batch Updated', 'Changes saved.')
        setEditTarget(null)
        loadData()
      } else {
        toastError('Failed', (res.error as { message: string })?.message ?? 'Could not update batch.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await window.api.batches.delete({ id: deleteTarget.id })
      if (res.success) {
        toastSuccess('Batch Removed', `Batch ${deleteTarget.batchNumber} has been deactivated.`)
        setDeleteTarget(null)
        loadData()
      } else {
        toastError('Failed', (res.error as { message: string })?.message ?? 'Could not remove batch.')
      }
    } finally {
      setDeleting(false)
    }
  }

  const columns: ColumnDef<BatchRow, unknown>[] = [
    {
      id: 'product',
      accessorFn: r => r.productName,
      header: () => t('billing.product'),
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-dark dark:text-slate-100">{row.original.productName}</p>
          <p className="text-sm text-slate-400">{row.original.batchNumber}</p>
        </div>
      )
    },
    {
      id: 'expiry',
      header: () => t('inventory.expiry'),
      cell: ({ row }) => (
        <div>
          <p className="text-base text-dark dark:text-slate-100">{formatDate(row.original.expiryDate)}</p>
          <ExpiryBadge days={row.original.daysToExpiry} leadDays={row.original.expiryAlertLeadDays} />
        </div>
      )
    },
    {
      accessorKey: 'quantityRemaining',
      header: () => t('inventory.remaining'),
      cell: ({ row }) => (
        <div>
          <span className="text-base font-semibold text-dark dark:text-slate-100">{row.original.quantityRemaining}</span>
          <span className="text-sm text-slate-400"> / {row.original.quantityReceived}</span>
        </div>
      )
    },
    {
      accessorKey: 'unitCost',
      header: () => t('purchaseOrders.unitCost'),
      cell: ({ getValue }) => {
        const v = getValue() as number
        return <span className="text-base text-slate-600 dark:text-slate-300">{v > 0 ? formatCurrency(v) : '—'}</span>
      }
    },
    {
      accessorKey: 'supplierName',
      header: () => t('purchaseOrders.supplier'),
      cell: ({ getValue }) => <span className="text-sm text-slate-500 dark:text-slate-400">{(getValue() as string | null) ?? '—'}</span>
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <button onClick={() => openEdit(row.original)}
            className="p-2.5 rounded-lg text-slate-400 hover:text-brand hover:bg-brand/10 transition-colors">
            <Edit size={16} />
          </button>
          <button onClick={() => setDeleteTarget(row.original)}
            className="p-2.5 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/10 transition-colors">
            <Trash2 size={16} />
          </button>
        </div>
      )
    }
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand/10 flex items-center justify-center">
            <PackageSearch size={22} className="text-brand" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark dark:text-slate-100">{t('inventory.batchTitle')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{total} {t('inventory.batches')}</p>
          </div>
        </div>
        <Button size="md" onClick={() => setShowForm(true)}>
          <Plus size={16} className="mr-1.5" /> {t('inventory.addBatch')}
        </Button>
      </div>

      {/* Alert pills */}
      {(alerts.expired > 0 || alerts.expiring > 0) && (
        <div className="flex gap-3">
          {alerts.expired > 0 && (
            <div className="flex items-center gap-2 bg-danger/10 border border-danger/20 rounded-xl px-4 py-3">
              <AlertTriangle size={16} className="text-danger" />
              <span className="text-base font-semibold text-danger">{alerts.expired > 1 ? t('inventory.expiredBatchesAlert', { count: alerts.expired }) : t('inventory.expiredBatchAlert', { count: alerts.expired })}</span>
            </div>
          )}
          {alerts.expiring > 0 && (
            <div className="flex items-center gap-2 bg-warning/10 border border-warning/20 rounded-xl px-4 py-3">
              <Clock size={16} className="text-warning" />
              <span className="text-base font-semibold text-warning">{t('inventory.expiringAlert', { count: alerts.expiring })}</span>
            </div>
          )}
        </div>
      )}

      {/* Filter tabs */}
      <Tabs
        tabs={[
          { id: 'all', label: t('inventory.allBatches') },
          { id: 'expiring', label: t('inventory.expiringSoon') },
          { id: 'expired', label: t('inventory.expired') },
        ]}
        active={filter}
        onChange={setFilter}
      />

      <DataTable
        data={batches}
        columns={columns}
        searchPlaceholder={`${t('common.search')}…`}
        loading={loading}
        emptyMessage={t('inventory.noBatches')}
      />

      {/* Add Batch modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5">
            <h2 className="text-xl font-bold text-dark dark:text-slate-100">{t('inventory.addBatch')}</h2>
            <div className="space-y-1 relative">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('billing.product')}</label>
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={form.productId ? productName : productQuery}
                  onChange={e => { setForm(f => ({ ...f, productId: '' })); setProductName(''); setProductQuery(e.target.value) }}
                  placeholder="Search product by name or SKU…"
                  className="w-full h-11 pl-10 pr-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              {productResults.length > 0 && !form.productId && (
                <div className="absolute z-10 mt-1 w-full border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden divide-y divide-slate-50 dark:divide-slate-800 bg-white dark:bg-slate-900 shadow-lg max-h-56 overflow-y-auto">
                  {productResults.map(p => (
                    <button key={p.id} type="button"
                      onClick={() => { setForm(f => ({ ...f, productId: p.id })); setProductName(p.productName); setProductQuery(''); setProductResults([]) }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-brand/5 transition-colors text-dark dark:text-slate-100">
                      {p.productName}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('inventory.batchNumber')}</label>
                <input value={form.batchNumber} onChange={e => setForm(f => ({ ...f, batchNumber: e.target.value }))}
                  placeholder="e.g. BT-2026-001"
                  className="w-full h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('common.quantity')}</label>
                <input type="number" value={form.quantityReceived} onChange={e => setForm(f => ({ ...f, quantityReceived: e.target.value }))}
                  placeholder="0" min="0"
                  className="w-full h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('inventory.expiryDate')}</label>
                <input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                  className="w-full h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('inventory.mfgDate')} ({t('common.optional')})</label>
                <input type="date" value={form.mfgDate} onChange={e => setForm(f => ({ ...f, mfgDate: e.target.value }))}
                  className="w-full h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('purchaseOrders.unitCost')} ({t('common.optional')})</label>
              <input type="number" value={form.unitCost} onChange={e => setForm(f => ({ ...f, unitCost: e.target.value }))}
                placeholder="0.00" min="0" step="0.01"
                className="w-full h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            {suppliers.length > 0 && (
              <Select label={`${t('purchaseOrders.supplier')} (${t('common.optional')})`} value={form.supplierId} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}>
                <option value="">— {t('common.none')} —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplierName}</option>)}
              </Select>
            )}
            <div className="flex gap-3 pt-2">
              <Button size="md" className="flex-1" onClick={handleCreate} disabled={saving}>{saving ? t('cashClose.saving') : t('inventory.addBatch')}</Button>
              <Button size="md" variant="outline" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Batch modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5">
            <h2 className="text-xl font-bold text-dark dark:text-slate-100">{t('inventory.editBatch')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{editTarget.productName} — {editTarget.batchNumber}</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('inventory.expiryDate')}</label>
                <input type="date" value={editForm.expiryDate} onChange={e => setEditForm(f => ({ ...f, expiryDate: e.target.value }))}
                  className="w-full h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('inventory.mfgDate')}</label>
                <input type="date" value={editForm.mfgDate} onChange={e => setEditForm(f => ({ ...f, mfgDate: e.target.value }))}
                  className="w-full h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('inventory.qtyRemaining')}</label>
                <input type="number" value={editForm.quantityRemaining} onChange={e => setEditForm(f => ({ ...f, quantityRemaining: e.target.value }))}
                  min="0"
                  className="w-full h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('purchaseOrders.unitCost')}</label>
                <input type="number" value={editForm.unitCost} onChange={e => setEditForm(f => ({ ...f, unitCost: e.target.value }))}
                  min="0" step="0.01"
                  className="w-full h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button size="md" className="flex-1" onClick={handleEdit} disabled={saving}>{saving ? t('cashClose.saving') : t('common.save')}</Button>
              <Button size="md" variant="outline" onClick={() => setEditTarget(null)}>{t('common.cancel')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
            <h2 className="text-xl font-bold text-dark dark:text-slate-100">{t('inventory.removeBatch')}</h2>
            <p className="text-base text-slate-600 dark:text-slate-300">
              {t('inventory.removeBatchMsg', { batch: deleteTarget.batchNumber, qty: deleteTarget.quantityRemaining })}
            </p>
            <div className="flex gap-3">
              <Button size="md" className="flex-1 !bg-danger hover:!bg-danger/90" onClick={handleDelete} disabled={deleting}>{deleting ? t('inventory.removing') : t('inventory.remove')}</Button>
              <Button size="md" variant="outline" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
