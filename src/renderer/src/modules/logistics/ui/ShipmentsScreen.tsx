import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'
import { useBusinessStore } from '@app/store/business.store'
import { useNotificationStore } from '@app/store/notification.store'
import { aszurexFooterHtml } from '@shared/utils/print-branding'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'

interface ShipmentListItem {
  id: string; shipmentNumber: string; shipmentType: string; referenceType: string | null; referenceNumber: string | null
  originAddress: string | null; destinationAddress: string; customerName: string | null; supplierName: string | null
  carrierName: string | null; trackingNumber: string | null; freightAmount: number; weight: number | null; packages: number
  status: string; scheduledDate: string | null; expectedDelivery: string | null; deliveredAt: string | null
  challanNumber: string | null; ewayBillNumber: string | null; vehicleNumber: string | null; notes: string | null
  createdAt: string; updatedAt: string
}

interface Vehicle { id: string; vehicleNumber: string; driverName: string | null; status: string }
interface Carrier { id: string; name: string; ratePerKg: number | null }

const STATUS_VARIANT: Record<string, 'neutral' | 'info' | 'warning' | 'brand' | 'success' | 'danger'> = {
  PENDING: 'neutral',
  READY: 'info',
  IN_TRANSIT: 'warning',
  OUT_FOR_DELIVERY: 'brand',
  DELIVERED: 'success',
  RETURNED: 'warning',
  CANCELLED: 'danger',
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['READY', 'CANCELLED'],
  READY: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'RETURNED', 'CANCELLED'],
}

interface ShipmentItem {
  id: string; productName: string; quantity: number; unit: string; unitValue: number; totalValue: number; notes: string | null
}

const EMPTY_FORM = {
  shipmentType: 'OUTBOUND', originAddress: '', destinationAddress: '', customerName: '', supplierName: '',
  carrierId: '', vehicleId: '', trackingNumber: '', ewayBillNumber: '', freightAmount: '', weight: '', packages: '1',
  scheduledDate: '', expectedDelivery: '', notes: '',
}
const EMPTY_ITEM = { productName: '', quantity: '', unit: 'PCS', unitValue: '', notes: '' }

export default function ShipmentsScreen() {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const [shipments, setShipments] = useState<ShipmentListItem[]>([])
  const [deleteTarget, setDeleteTarget] = useState<ShipmentListItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [items, setItems] = useState<typeof EMPTY_ITEM[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')
  const currSym = useBusinessStore(s => s.profile?.currencySymbol ?? '₹')
  const PAGE_SIZE = 100
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => { setLimit(PAGE_SIZE) }, [filterStatus, debouncedSearch, appliedFrom, appliedTo])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sr, vr, cr] = await Promise.all([
        window.api.logisticsShipment.list({
          status: filterStatus !== 'ALL' ? filterStatus : undefined,
          search: debouncedSearch || undefined,
          fromDate: appliedFrom || undefined,
          toDate: appliedTo || undefined,
          limit,
        }),
        window.api.logisticsVehicle.list(),
        window.api.logisticsCarrier.list({ activeOnly: true }),
      ])
      if (sr.success) { setShipments(sr.data as ShipmentListItem[]); setTotal((sr as { total?: number }).total ?? (sr.data as ShipmentListItem[]).length) }
      else toastError(t('common.error'), sr.error?.message ?? t('common.error'))
      if (vr.success) setVehicles(vr.data as Vehicle[])
      else toastError(t('common.error'), vr.error?.message ?? t('common.error'))
      if (cr.success) setCarriers(cr.data as Carrier[])
      else toastError(t('common.error'), cr.error?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [filterStatus, debouncedSearch, appliedFrom, appliedTo, limit, toastError, t])

  useEffect(() => { load() }, [load])

  const handleApplyDates = () => { setAppliedFrom(fromDate); setAppliedTo(toDate) }
  const handleClearDates = () => { setFromDate(''); setToDate(''); setAppliedFrom(''); setAppliedTo('') }

  const selectedCarrier = carriers.find(c => c.id === form.carrierId)
  const suggestedFreight = selectedCarrier?.ratePerKg && form.weight
    ? (selectedCarrier.ratePerKg * parseFloat(form.weight)).toFixed(2) : null

  const addItem = () => setItems(prev => [...prev, { ...EMPTY_ITEM }])
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx))
  const updateItem = (idx: number, field: string, value: string) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it))

  const openAdd = () => { setForm({ ...EMPTY_FORM }); setItems([]); setEditId(null); setError(null); setShowForm(true) }

  const openEdit = async (s: ShipmentListItem) => {
    const res = await window.api.logisticsShipment.get(s.id)
    if (!res.success) { toastError(t('common.error'), t('common.error')); return }
    const full = res.data as any
    setForm({
      shipmentType: full.shipmentType, originAddress: full.originAddress ?? '',
      destinationAddress: full.destinationAddress,
      customerName: full.customerName ?? '', supplierName: full.supplierName ?? '',
      carrierId: full.carrierId ?? '', vehicleId: full.vehicleId ?? '',
      trackingNumber: full.trackingNumber ?? '', ewayBillNumber: full.ewayBillNumber ?? '',
      freightAmount: full.freightAmount?.toString() ?? '',
      weight: full.weight?.toString() ?? '', packages: full.packages?.toString() ?? '1',
      scheduledDate: full.scheduledDate?.split('T')[0] ?? '',
      expectedDelivery: full.expectedDelivery?.split('T')[0] ?? '',
      notes: full.notes ?? '',
    })
    setItems((full.items ?? []).map((i: ShipmentItem) => ({
      productName: i.productName, quantity: i.quantity.toString(),
      unit: i.unit, unitValue: i.unitValue?.toString() ?? '', notes: i.notes ?? '',
    })))
    setEditId(s.id); setError(null); setShowForm(true)
  }

  const save = async () => {
    if (!form.destinationAddress.trim()) { setError(t('logistics.shipments.destinationRequired')); return }
    setSaving(true); setError(null)
    const validItems = items.filter(i => i.productName.trim() && parseFloat(i.quantity) > 0)
    const sharedFields = {
      shipmentType: form.shipmentType, originAddress: form.originAddress || undefined,
      destinationAddress: form.destinationAddress, customerName: form.customerName || undefined,
      supplierName: form.supplierName || undefined, trackingNumber: form.trackingNumber || undefined,
      ewayBillNumber: form.ewayBillNumber || undefined,
      freightAmount: form.freightAmount ? parseFloat(form.freightAmount) : 0,
      weight: form.weight ? parseFloat(form.weight) : undefined,
      packages: form.packages ? parseInt(form.packages) : 1,
      scheduledDate: form.scheduledDate || undefined, expectedDelivery: form.expectedDelivery || undefined,
      notes: form.notes || undefined,
      items: validItems.map(i => ({
        productName: i.productName, quantity: parseFloat(i.quantity),
        unit: i.unit, unitValue: parseFloat(i.unitValue) || 0, notes: i.notes || undefined,
      })),
    }
    const res = editId
      ? await window.api.logisticsShipment.update({
          id: editId, ...sharedFields,
          carrierId: form.carrierId || null, vehicleId: form.vehicleId || null,
        })
      : await window.api.logisticsShipment.create({
          ...sharedFields,
          carrierId: form.carrierId || undefined, vehicleId: form.vehicleId || undefined,
        })
    setSaving(false)
    if (res.success) { setShowForm(false); load() }
    else setError(res.error?.message ?? t('common.error'))
  }

  const changeStatus = async (id: string, status: string) => {
    const res = await window.api.logisticsShipment.updateStatus({ id, status })
    if (!res.success) toastError(t('common.error'), res.error?.message ?? t('common.error'))
    load()
  }

  const handleDeleteShipment = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await window.api.logisticsShipment.delete(deleteTarget.id)
    setDeleting(false)
    if (!res.success) toastError(t('common.error'), res.error?.message ?? t('common.error'))
    else { setDeleteTarget(null); load() }
  }

  const printShipment = async (s: ShipmentListItem) => {
    const res = await window.api.logisticsShipment.get(s.id)
    const full = res.success ? (res.data as any) : null
    const itemRows = full?.items?.length
      ? full.items.map((i: ShipmentItem) => `<tr><td>${i.productName}</td><td>${i.quantity}</td><td>${i.unit}</td><td>${formatCurrency(i.unitValue)}</td><td>${formatCurrency(i.totalValue)}</td></tr>`).join('')
      : '<tr><td colspan="5" style="color:#aaa;text-align:center;padding:8px">No items recorded</td></tr>'
    const html = `<html><head><style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}.title{font-size:18px;font-weight:bold;margin-bottom:16px}.row{display:flex;gap:8px;margin-bottom:8px}.label{color:#666;width:160px;flex-shrink:0}h3{font-size:13px;margin:16px 0 8px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px}th{background:#f5f5f5}footer{margin-top:32px;font-size:10px;color:#888;text-align:center}</style></head><body><div class="title">Shipment: ${s.shipmentNumber}</div><div class="row"><span class="label">Type:</span><span>${s.shipmentType}</span></div><div class="row"><span class="label">Status:</span><span>${s.status}</span></div>${s.originAddress ? `<div class="row"><span class="label">From:</span><span>${s.originAddress}</span></div>` : ''}<div class="row"><span class="label">To:</span><span>${s.destinationAddress}</span></div><div class="row"><span class="label">Customer:</span><span>${s.customerName ?? '-'}</span></div><div class="row"><span class="label">Supplier:</span><span>${s.supplierName ?? '-'}</span></div><div class="row"><span class="label">Carrier:</span><span>${s.carrierName ?? '-'}</span></div><div class="row"><span class="label">Vehicle:</span><span>${s.vehicleNumber ?? '-'}</span></div><div class="row"><span class="label">Tracking #:</span><span>${s.trackingNumber ?? '-'}</span></div>${s.ewayBillNumber ? `<div class="row"><span class="label">eWay Bill #:</span><span>${s.ewayBillNumber}</span></div>` : ''}<div class="row"><span class="label">Weight:</span><span>${s.weight ? `${s.weight} kg` : '-'}</span></div><div class="row"><span class="label">Packages:</span><span>${s.packages}</span></div><div class="row"><span class="label">Freight:</span><span>${formatCurrency(s.freightAmount)}</span></div><div class="row"><span class="label">Expected Delivery:</span><span>${s.expectedDelivery ? formatDate(s.expectedDelivery) : '-'}</span></div><h3>Items</h3><table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Unit Value</th><th>Total</th></tr></thead><tbody>${itemRows}</tbody></table><footer>${aszurexFooterHtml(10)}</footer></body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.print() }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-800">{t('logistics.shipments.title')}</h1>
        <button onClick={openAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">{t('logistics.shipments.newShipment')}</button>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-xs text-gray-500 block mb-1">{t('common.search')}</label>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('logistics.shipments.searchPlaceholder')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56" />
        </div>
        <Select label={t('common.status')} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="ALL">{t('common.all')}</option>
          {['PENDING', 'READY', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'RETURNED', 'CANCELLED'].map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
        <div>
          <label className="text-xs text-gray-500 block mb-1">{t('logistics.shipments.fromDate')}</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">{t('logistics.shipments.toDate')}</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <button onClick={handleApplyDates} className="px-3 py-2 bg-gray-700 text-white rounded-lg text-sm hover:bg-gray-800">{t('common.apply')}</button>
        {(appliedFrom || appliedTo) && (
          <button onClick={handleClearDates} className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 text-gray-600">{t('common.clear')}</button>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">{t('logistics.shipments.loading')}</div>
      ) : shipments.length === 0 ? (
        <div className="text-center py-12 text-gray-400">{t('logistics.shipments.empty')}</div>
      ) : (
        <div className="space-y-3">
          {shipments.map(s => (
            <Card key={s.id} padding="md">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-800">{s.shipmentNumber}</span>
                    <Badge variant={STATUS_VARIANT[s.status] ?? 'neutral'} size="sm">{s.status}</Badge>
                    <span className="text-xs text-gray-400">{s.shipmentType}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{t('logistics.shipments.to')} {s.destinationAddress}</p>
                  {s.customerName && <p className="text-xs text-gray-400">{t('logistics.shipments.customerLabel')} {s.customerName}</p>}
                  {s.carrierName && <p className="text-xs text-gray-400">{t('logistics.shipments.carrierLabel')} {s.carrierName} {s.vehicleNumber && `| ${s.vehicleNumber}`}</p>}
                  {s.trackingNumber && <p className="text-xs text-gray-400">{t('logistics.shipments.trackingLabel')} {s.trackingNumber}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">{formatCurrency(s.freightAmount)}</p>
                  {s.weight && <p className="text-xs text-gray-400">{s.weight} kg · {s.packages} pkg</p>}
                  {s.expectedDelivery && <p className="text-xs text-gray-400">{t('logistics.shipments.eta')} {formatDate(s.expectedDelivery)}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {VALID_TRANSITIONS[s.status]?.map(next => (
                  <button key={next} onClick={() => changeStatus(s.id, next)} className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700">
                    → {next}
                  </button>
                ))}
                {!['DELIVERED', 'RETURNED', 'CANCELLED'].includes(s.status) && (
                  <button onClick={() => openEdit(s)} className="text-xs text-blue-600 hover:underline ml-auto">{t('common.edit')}</button>
                )}
                {['PENDING', 'CANCELLED'].includes(s.status) && (
                  <button onClick={() => setDeleteTarget(s)} className="text-xs text-red-500 hover:underline">{t('common.delete')}</button>
                )}
                <button onClick={() => printShipment(s)} className="text-xs text-gray-500 hover:underline">{t('common.print')}</button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && total > shipments.length && (
        <div className="text-center py-3">
          <p className="text-xs text-gray-400 mb-2">{t('logistics.showingOf', { shown: shipments.length, total })}</p>
          <button onClick={() => setLimit(l => l + PAGE_SIZE)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t('logistics.loadMore')}</button>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold">{editId ? t('logistics.shipments.editShipment') : t('logistics.shipments.newShipmentTitle')}</h2>
            {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <Select label={t('logistics.shipments.shipmentType')} value={form.shipmentType} onChange={e => setForm(f => ({ ...f, shipmentType: e.target.value }))}>
                {['OUTBOUND', 'INBOUND', 'INTERNAL'].map(st => <option key={st}>{st}</option>)}
              </Select>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.shipments.packages')}</label>
                <input type="number" min="1" value={form.packages} onChange={e => setForm(f => ({ ...f, packages: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">{form.shipmentType === 'INBOUND' ? t('logistics.shipments.originAddressSupplier') : t('logistics.shipments.originAddress')}</label>
                <textarea value={form.originAddress} onChange={e => setForm(f => ({ ...f, originAddress: e.target.value }))} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder={t('logistics.shipments.originAddressPlaceholder')} />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">{form.shipmentType === 'INBOUND' ? t('logistics.shipments.destinationAddressWarehouse') : t('logistics.shipments.destinationAddress')}</label>
                <textarea value={form.destinationAddress} onChange={e => setForm(f => ({ ...f, destinationAddress: e.target.value }))} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{form.shipmentType === 'INBOUND' ? t('logistics.shipments.supplierName') : t('logistics.shipments.customerName')}</label>
                {form.shipmentType === 'INBOUND'
                  ? <input value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  : <input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                }
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{form.shipmentType === 'INBOUND' ? t('logistics.shipments.customerNameOptional') : t('logistics.shipments.supplierNameOptional')}</label>
                {form.shipmentType === 'INBOUND'
                  ? <input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                  : <input value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                }
              </div>
              <Select label={t('logistics.freight.carrier')} value={form.carrierId} onChange={e => setForm(f => ({ ...f, carrierId: e.target.value }))}>
                <option value="">{t('common.selectItem')}</option>
                {carriers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Select label={t('logistics.shipments.vehicle')} value={form.vehicleId} onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))}>
                <option value="">{t('common.selectItem')}</option>
                {vehicles.filter(v => v.status === 'AVAILABLE' || v.id === form.vehicleId).map(v => <option key={v.id} value={v.id}>{v.vehicleNumber}{v.driverName ? ` (${v.driverName})` : ''}{v.status !== 'AVAILABLE' ? ` [${v.status}]` : ''}</option>)}
              </Select>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.shipments.weight')}</label>
                <input type="number" min="0" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.shipments.freightAmount')} ({currSym}) {suggestedFreight && <span className="text-xs text-blue-500 ml-1">{t('logistics.shipments.suggested', { amount: `${currSym}${suggestedFreight}` })}</span>}</label>
                <input type="number" min="0" value={form.freightAmount} onChange={e => setForm(f => ({ ...f, freightAmount: e.target.value }))} placeholder={suggestedFreight ?? ''} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.shipments.trackingNumber')}</label>
                <input value={form.trackingNumber} onChange={e => setForm(f => ({ ...f, trackingNumber: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.shipments.ewayBillNumber')}</label>
                <input value={form.ewayBillNumber} onChange={e => setForm(f => ({ ...f, ewayBillNumber: e.target.value }))} placeholder={t('logistics.shipments.ewayPlaceholder')} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.shipments.scheduledDate')}</label>
                <input type="date" value={form.scheduledDate} onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.shipments.expectedDelivery')}</label>
                <input type="date" value={form.expectedDelivery} onChange={e => setForm(f => ({ ...f, expectedDelivery: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">{t('common.notes')}</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>

            <div className="space-y-2 border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">{t('logistics.shipments.items')}</h3>
                <button onClick={addItem} className="text-xs text-blue-600 hover:underline">{t('logistics.shipments.addItem')}</button>
              </div>
              {items.length === 0 && (
                <p className="text-xs text-gray-400">{t('logistics.shipments.noItemsHint')}</p>
              )}
              {items.map((item, idx) => (
                <div key={idx} className="space-y-1 pb-2 border-b border-gray-50 last:border-0">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    <input value={item.productName} onChange={e => updateItem(idx, 'productName', e.target.value)} placeholder={t('logistics.shipments.itemNamePlaceholder')} className="col-span-4 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                    <input type="number" min="0" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} placeholder={t('logistics.shipments.qty')} className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                    <select value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className="col-span-2 border border-gray-300 rounded-lg px-1 py-1.5 text-xs">
                      {['PCS', 'KG', 'L', 'M', 'BOX'].map(u => <option key={u}>{u}</option>)}
                    </select>
                    <input type="number" min="0" value={item.unitValue} onChange={e => updateItem(idx, 'unitValue', e.target.value)} placeholder={t('logistics.shipments.valuePlaceholder', { symbol: currSym })} className="col-span-3 border border-gray-300 rounded-lg px-2 py-1.5 text-xs" />
                    <button onClick={() => removeItem(idx)} className="col-span-1 text-red-400 hover:text-red-600 text-xs font-bold">✕</button>
                  </div>
                  <input value={item.notes} onChange={e => updateItem(idx, 'notes', e.target.value)} placeholder={t('logistics.shipments.itemNotesPlaceholder')} className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-500 placeholder-gray-300" />
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t('common.cancel')}</button>
              <button onClick={save} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? t('common.loading') : t('common.save')}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteShipment}
        loading={deleting}
        title={t('common.delete')}
        message={deleteTarget ? t('logistics.shipments.deleteConfirm', { number: deleteTarget.shipmentNumber }) : ''}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}
