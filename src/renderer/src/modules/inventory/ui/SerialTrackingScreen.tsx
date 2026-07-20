import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Smartphone, Package, CheckCircle2, XCircle, RotateCcw, AlertCircle, Upload, ChevronDown, Wrench } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { DataTable } from '@shared/ui/organisms/DataTable'
import { Button } from '@shared/ui/atoms/Button'
import { Badge } from '@shared/ui/atoms/Badge'
import { useNotificationStore } from '@app/store/notification.store'
import { useIndustryStore } from '@app/store/industry.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'

type SerialStatus = 'AVAILABLE' | 'SOLD' | 'RETURNED' | 'DEFECTIVE'

interface SerialRow {
  id: string
  productName: string
  serialNumber: string
  imeiNumber: string | null
  imei2Number: string | null
  warrantyMonths: number | null
  warrantyExpiryDate: string | null
  unitCost: number
  status: SerialStatus
  soldDate: string | null
}

const STATUS_VARIANT: Record<SerialStatus, 'success' | 'neutral' | 'brand' | 'danger'> = {
  AVAILABLE: 'success',
  SOLD: 'neutral',
  RETURNED: 'brand',
  DEFECTIVE: 'danger',
}

const STATUS_STYLES: Record<SerialStatus, { label: string; icon: React.ReactNode }> = {
  AVAILABLE:  { label: 'Available',  icon: <CheckCircle2 size={12}/> },
  SOLD:       { label: 'Sold',       icon: <XCircle size={12}/> },
  RETURNED:   { label: 'Returned',   icon: <RotateCcw size={12}/> },
  DEFECTIVE:  { label: 'Defective',  icon: <AlertCircle size={12}/> },
}

const ALL_STATUSES: SerialStatus[] = ['AVAILABLE', 'SOLD', 'RETURNED', 'DEFECTIVE']

// Search-as-you-type product picker, used by both the Add Device and Bulk
// Import forms below. Previously both relied on a single products.list()
// call capped at 500 (alphabetically) with no search — any electronics
// store with more than 500 SKUs simply couldn't reach the rest, with no
// indication anything was missing.
function ProductPicker({ value, onChange }: { value: string; onChange: (id: string, name: string) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ id: string; productName: string }[]>([])
  const [name, setName] = useState('')

  useEffect(() => {
    if (!value) setName('')
  }, [value])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      const res = await window.api.products.search(query.trim())
      if (res.success && res.data) setResults(res.data as { id: string; productName: string }[])
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  return (
    <div className="relative">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={value ? name : query}
          onChange={e => { onChange('', ''); setQuery(e.target.value) }}
          placeholder="Search product by name or SKU…"
          className="w-full h-11 pl-10 pr-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
      </div>
      {results.length > 0 && !value && (
        <div className="absolute z-10 mt-1 w-full border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden divide-y divide-slate-50 dark:divide-slate-800 bg-white dark:bg-slate-900 shadow-lg max-h-56 overflow-y-auto">
          {results.map(p => (
            <button key={p.id} type="button"
              onClick={() => { onChange(p.id, p.productName); setName(p.productName); setQuery(''); setResults([]) }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-brand/5 transition-colors text-dark dark:text-slate-100">
              {p.productName}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface SerialFormState {
  productId: string
  serialNumber: string
  imeiNumber: string
  imei2Number: string
  warrantyMonths: string
  purchaseDate: string
  unitCost: string
}

export function SerialTrackingScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  // IMEI is phone/mobile-specific — not every business type that enables serial_tracking
  // (e.g. Phase 49 Agricultural Inputs equipment) also enables imei_tracking. Gate all
  // IMEI-specific UI on the module flag rather than assuming it's always relevant.
  const imeiEnabled = useIndustryStore(s => s.isModuleEnabled('imei_tracking'))
  // Phase 58 §2 — Electronics repair/RMA. Not every serial_tracking business
  // wants the repair workflow (e.g. Phase 49 Agri equipment) — gate the
  // per-row entry point on the module flag, same convention as imeiEnabled.
  const repairRmaEnabled = useIndustryStore(s => s.isModuleEnabled('repair_rma'))
  const [serials, setSerials] = useState<SerialRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState<SerialStatus | 'ALL'>('ALL')
  const [imeiSearch, setImeiSearch] = useState('')
  const [imeiResult, setImeiResult] = useState<SerialRow | null>(null)
  const [form, setForm] = useState<SerialFormState>({
    productId: '', serialNumber: '', imeiNumber: '', imei2Number: '',
    warrantyMonths: '', purchaseDate: '', unitCost: ''
  })
  // Bulk import state
  const [bulkProductId, setBulkProductId] = useState('')
  const [bulkPurchaseDate, setBulkPurchaseDate] = useState('')
  const [bulkWarrantyMonths, setBulkWarrantyMonths] = useState('')
  const [bulkText, setBulkText] = useState('')
  // Status change state
  const [statusTarget, setStatusTarget] = useState<SerialRow | null>(null)
  const [newStatus, setNewStatus] = useState<SerialStatus>('AVAILABLE')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const payload = statusFilter !== 'ALL' ? { status: statusFilter, limit: 200 } : { limit: 200 }
      const res = await window.api.serials.list(payload)
      if (res.success) {
        const d = res.data as { serials: SerialRow[]; total: number }
        setSerials(d.serials ?? [])
        setTotal(d.total ?? 0)
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

  async function handleImeiSearch() {
    if (!imeiSearch.trim()) return
    const res = await window.api.serials.searchByImei({ imei: imeiSearch.trim() })
    if (res.success) {
      setImeiResult(res.data as SerialRow)
    } else {
      setImeiResult(null)
      toastError('Not Found', 'No device found with this IMEI number.')
    }
  }

  async function handleCreate() {
    if (!form.productId || !form.serialNumber) {
      toastError('Missing Fields', 'Product and serial number are required.')
      return
    }
    setSaving(true)
    try {
      const res = await window.api.serials.create({
        productId: form.productId,
        serialNumber: form.serialNumber,
        imeiNumber: form.imeiNumber || undefined,
        imei2Number: form.imei2Number || undefined,
        warrantyMonths: form.warrantyMonths ? parseInt(form.warrantyMonths) : undefined,
        purchaseDate: form.purchaseDate || undefined,
        unitCost: form.unitCost ? parseFloat(form.unitCost) : undefined
      })
      if (res.success) {
        toastSuccess('Serial Added', `${form.serialNumber} has been recorded.`)
        setShowForm(false)
        setForm({ productId: '', serialNumber: '', imeiNumber: '', imei2Number: '', warrantyMonths: '', purchaseDate: '', unitCost: '' })
        loadData()
      } else {
        toastError('Failed', (res.error as { message: string })?.message ?? 'Could not add serial.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleBulkImport() {
    if (!bulkProductId) {
      toastError('Missing Product', 'Select a product before importing.')
      return
    }
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length === 0) {
      toastError('No Data', 'Paste at least one serial number.')
      return
    }
    setSaving(true)
    try {
      const serials = lines.map(line => {
        const parts = line.split(',').map(p => p.trim())
        return {
          serialNumber: parts[0],
          imeiNumber: parts[1] || undefined,
          imei2Number: parts[2] || undefined,
          warrantyMonths: bulkWarrantyMonths ? parseInt(bulkWarrantyMonths) : undefined
        }
      })
      const res = await window.api.serials.bulkCreate({
        productId: bulkProductId,
        serials,
        purchaseDate: bulkPurchaseDate || undefined
      })
      if (res.success) {
        const d = res.data as { created: number; skipped: number }
        toastSuccess('Import Done', `${d.created} added, ${d.skipped} skipped.`)
        setShowBulk(false)
        setBulkProductId(''); setBulkPurchaseDate(''); setBulkWarrantyMonths(''); setBulkText('')
        loadData()
      } else {
        toastError('Import Failed', (res.error as { message: string })?.message ?? 'Could not import.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusChange() {
    if (!statusTarget) return
    setSaving(true)
    try {
      const res = await window.api.serials.updateStatus({ id: statusTarget.id, status: newStatus })
      if (res.success) {
        toastSuccess('Status Updated', `${statusTarget.serialNumber} → ${newStatus}`)
        setStatusTarget(null)
        loadData()
      } else {
        toastError('Failed', (res.error as { message: string })?.message ?? 'Could not update status.')
      }
    } finally {
      setSaving(false)
    }
  }

  const columns: ColumnDef<SerialRow, unknown>[] = [
    {
      id: 'device',
      header: () => t('inventory.deviceSerial'),
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-dark dark:text-slate-100">{row.original.productName}</p>
          <p className="text-sm font-mono text-slate-400">{row.original.serialNumber}</p>
          {imeiEnabled && row.original.imeiNumber && <p className="text-sm text-slate-400">IMEI: {row.original.imeiNumber}</p>}
        </div>
      )
    },
    {
      id: 'status',
      header: () => t('inventory.status'),
      cell: ({ row }) => {
        const s = STATUS_STYLES[row.original.status]
        return (
          <Badge variant={STATUS_VARIANT[row.original.status]} icon={s.icon}>
            {s.label}
          </Badge>
        )
      }
    },
    {
      id: 'warranty',
      header: () => t('inventory.warranty'),
      cell: ({ row }) => {
        if (!row.original.warrantyMonths) return <span className="text-sm text-slate-400">—</span>
        const expiry = row.original.warrantyExpiryDate ? new Date(row.original.warrantyExpiryDate) : null
        const expired = expiry ? expiry < new Date() : false
        return (
          <div>
            <p className="text-base">{row.original.warrantyMonths}M</p>
            {expiry && <p className={`text-sm ${expired ? 'text-danger' : 'text-slate-400'}`}>{expired ? 'Expired' : formatDate(expiry)}</p>}
          </div>
        )
      }
    },
    {
      accessorKey: 'unitCost',
      header: () => t('common.cost'),
      cell: ({ getValue }) => {
        const v = getValue() as number
        return <span className="text-base text-slate-600 dark:text-slate-300">{v > 0 ? formatCurrency(v) : '—'}</span>
      }
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {repairRmaEnabled && row.original.status === 'SOLD' && (
            <button
              onClick={() => navigate(`/electronics/repair-tickets?serialId=${row.original.id}`)}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-brand hover:text-brand transition-colors"
              title={t('inventory.repairTicket')}
            >
              <Wrench size={12} /> {t('inventory.repairTicket')}
            </button>
          )}
          <button
            onClick={() => { setStatusTarget(row.original); setNewStatus(row.original.status) }}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-brand hover:text-brand transition-colors"
          >
            Status <ChevronDown size={12} />
          </button>
        </div>
      )
    }
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-brand/10 flex items-center justify-center">
            {imeiEnabled ? <Smartphone size={22} className="text-brand" /> : <Package size={22} className="text-brand" />}
          </div>
          <div>
            <h1 className="text-xl font-bold text-dark dark:text-slate-100">{t(imeiEnabled ? 'inventory.serialTitle' : 'inventory.serialTitleGeneric')}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">{total} {t('inventory.devices')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="md" variant="outline" onClick={() => setShowBulk(true)}>
            <Upload size={16} className="mr-1.5" /> {t('inventory.bulkImport')}
          </Button>
          <Button size="md" onClick={() => setShowForm(true)}>
            <Plus size={16} className="mr-1.5" /> {t('inventory.addDevice')}
          </Button>
        </div>
      </div>

      {/* IMEI lookup — phone/mobile-specific, hidden entirely when imei_tracking isn't enabled */}
      {imeiEnabled && (
        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
          <p className="text-base font-semibold text-slate-700 dark:text-slate-300">{t('inventory.imeiLookup')}</p>
          <div className="flex gap-3">
            <input value={imeiSearch} onChange={e => setImeiSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleImeiSearch()}
              placeholder={t('inventory.imeiPlaceholder')}
              className="flex-1 h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
            <Button size="md" variant="outline" onClick={handleImeiSearch}>
              <Search size={16} className="mr-1.5" /> {t('common.search')}
            </Button>
          </div>
          {imeiResult && (
            <div className="bg-white dark:bg-slate-900 border border-brand/30 rounded-lg p-4 space-y-1">
              <p className="text-base font-semibold text-dark dark:text-slate-100">{imeiResult.productName}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">S/N: {imeiResult.serialNumber}</p>
              {imeiResult.imeiNumber && <p className="text-sm text-slate-500 dark:text-slate-400">IMEI 1: {imeiResult.imeiNumber}</p>}
              {imeiResult.imei2Number && <p className="text-sm text-slate-500 dark:text-slate-400">IMEI 2: {imeiResult.imei2Number}</p>}
              <Badge variant={STATUS_VARIANT[imeiResult.status]} icon={STATUS_STYLES[imeiResult.status].icon}>
                {STATUS_STYLES[imeiResult.status].label}
              </Badge>
            </div>
          )}
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {(['ALL', 'AVAILABLE', 'SOLD', 'RETURNED', 'DEFECTIVE'] as const).map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-base font-medium transition-colors ${statusFilter === s ? 'bg-brand text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}>
            {s === 'ALL' ? t('common.all') : STATUS_STYLES[s as SerialStatus].label}
          </button>
        ))}
      </div>

      <DataTable
        data={serials}
        columns={columns}
        searchPlaceholder={`${t('common.search')}…`}
        loading={loading}
        emptyMessage={t('inventory.noSerials')}
      />

      {/* Add Device modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5">
            <h2 className="text-xl font-bold text-dark dark:text-slate-100">{t('inventory.addDevice')}</h2>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('billing.product')}</label>
              <ProductPicker value={form.productId} onChange={id => setForm(f => ({ ...f, productId: id }))} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('inventory.serialNumber')}</label>
              <input value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))}
                placeholder="e.g. ABC123456789"
                className="w-full h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            {imeiEnabled && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">IMEI 1 (optional)</label>
                  <input value={form.imeiNumber} onChange={e => setForm(f => ({ ...f, imeiNumber: e.target.value }))}
                    placeholder="15-digit IMEI"
                    className="w-full h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">IMEI 2 (optional)</label>
                  <input value={form.imei2Number} onChange={e => setForm(f => ({ ...f, imei2Number: e.target.value }))}
                    placeholder="Dual SIM only"
                    className="w-full h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('inventory.warrantyMonths')}</label>
                <input type="number" value={form.warrantyMonths} onChange={e => setForm(f => ({ ...f, warrantyMonths: e.target.value }))}
                  placeholder="12" min="0"
                  className="w-full h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('purchaseOrders.unitCost')}</label>
                <input type="number" value={form.unitCost} onChange={e => setForm(f => ({ ...f, unitCost: e.target.value }))}
                  placeholder="0.00" min="0" step="0.01"
                  className="w-full h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('inventory.purchaseDate')} ({t('common.optional')})</label>
              <input type="date" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))}
                className="w-full h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button size="md" className="flex-1" onClick={handleCreate} disabled={saving}>{saving ? t('cashClose.saving') : t('inventory.addDevice')}</Button>
              <Button size="md" variant="outline" onClick={() => setShowForm(false)}>{t('common.cancel')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import modal */}
      {showBulk && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-5">
            <h2 className="text-xl font-bold text-dark dark:text-slate-100">{t('inventory.bulkImportTitle')}</h2>
            {imeiEnabled ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">One line per device. Format: <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">SerialNumber, IMEI1, IMEI2</span> (IMEI columns optional)</p>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">One line per unit. Format: <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">SerialNumber</span></p>
            )}
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('billing.product')}</label>
              <ProductPicker value={bulkProductId} onChange={id => setBulkProductId(id)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('inventory.purchaseDate')}</label>
                <input type="date" value={bulkPurchaseDate} onChange={e => setBulkPurchaseDate(e.target.value)}
                  className="w-full h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('inventory.warrantyMonths')}</label>
                <input type="number" value={bulkWarrantyMonths} onChange={e => setBulkWarrantyMonths(e.target.value)}
                  placeholder="12" min="0"
                  className="w-full h-11 px-4 text-base border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand" />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('inventory.serialNumbers')}</label>
              <textarea value={bulkText} onChange={e => setBulkText(e.target.value)}
                rows={8}
                placeholder={imeiEnabled ? "SN001\nSN002, 123456789012345\nSN003, 987654321098765, 111111111111111" : "SN001\nSN002\nSN003"}
                className="w-full px-4 py-3 text-base font-mono border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand resize-none" />
              <p className="text-sm text-slate-400">{bulkText.split('\n').filter(l => l.trim()).length} {t('inventory.devicesReady')}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <Button size="md" className="flex-1" onClick={handleBulkImport} disabled={saving}>{saving ? t('inventory.importing') : t('inventory.importBtn')}</Button>
              <Button size="md" variant="outline" onClick={() => setShowBulk(false)}>{t('common.cancel')}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Status Change modal */}
      {statusTarget && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
            <h2 className="text-xl font-bold text-dark dark:text-slate-100">{t('inventory.changeStatus')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{statusTarget.productName} — <span className="font-mono">{statusTarget.serialNumber}</span></p>
            <div className="grid grid-cols-2 gap-2">
              {ALL_STATUSES.map(s => (
                <button key={s}
                  onClick={() => setNewStatus(s)}
                  className={`flex items-center gap-2 px-3 py-3 rounded-xl border-2 text-base font-medium transition-all ${newStatus === s ? 'border-brand bg-brand/5 text-brand' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'}`}>
                  <Badge variant={STATUS_VARIANT[s]} size="sm">{STATUS_STYLES[s].icon}</Badge>
                  {STATUS_STYLES[s].label}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button size="md" className="flex-1" onClick={handleStatusChange} disabled={saving || newStatus === statusTarget.status}>{saving ? t('cashClose.saving') : t('inventory.updateStatus')}</Button>
              <Button size="md" variant="outline" onClick={() => setStatusTarget(null)}>{t('common.cancel')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
