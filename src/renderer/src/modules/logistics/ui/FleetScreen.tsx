import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { aszurexFooterHtml } from '@shared/utils/print-branding'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { useNotificationStore } from '@app/store/notification.store'

interface Vehicle {
  id: string; vehicleNumber: string; vehicleType: string; ownerType: string
  driverName: string | null; driverPhone: string | null
  capacity: number | null; capacityUnit: string; status: string; notes: string | null
  shipmentsThisMonth: number; createdAt: string; updatedAt: string
}

const STATUS_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = {
  AVAILABLE: 'success',
  IN_TRANSIT: 'info',
  MAINTENANCE: 'warning',
  RETIRED: 'neutral',
}

// Token-consistent classes for the inline editable status "pill" <select> below —
// mirrors Badge's own variant classes since a real <Badge> can't be a form control.
const STATUS_PILL_CLASSES: Record<string, string> = {
  AVAILABLE: 'bg-success/10 text-success',
  IN_TRANSIT: 'bg-info/10 text-info',
  MAINTENANCE: 'bg-warning/10 text-warning',
  RETIRED: 'bg-muted text-muted-foreground',
}

const VEHICLE_TYPES = ['TRUCK', 'TEMPO', 'VAN', 'BIKE', 'AUTO']
const OWNER_TYPES = ['OWN', 'HIRED', '3PL']
const MANUAL_STATUSES = ['AVAILABLE', 'MAINTENANCE', 'RETIRED']

const EMPTY_FORM = { vehicleNumber: '', vehicleType: 'VAN', ownerType: 'OWN', driverName: '', driverPhone: '', capacity: '', capacityUnit: 'KG', notes: '' }

export default function FleetScreen() {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState('ALL')
  const [filterOwnerType, setFilterOwnerType] = useState('ALL')
  const [search, setSearch] = useState('')
  const PAGE_SIZE = 100
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.logisticsVehicle.list({
        status: filterStatus !== 'ALL' ? filterStatus : undefined,
        limit,
      })
      if (res.success) { setVehicles(res.data as Vehicle[]); setTotal((res as { total?: number }).total ?? (res.data as Vehicle[]).length) }
      else toastError(t('common.error'), res.error?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [filterStatus, limit, toastError, t])

  useEffect(() => { setLimit(PAGE_SIZE) }, [filterStatus])
  useEffect(() => { load() }, [load])

  const openAdd = () => { setForm({ ...EMPTY_FORM }); setEditId(null); setError(null); setShowForm(true) }
  const openEdit = (v: Vehicle) => {
    setForm({ vehicleNumber: v.vehicleNumber, vehicleType: v.vehicleType, ownerType: v.ownerType, driverName: v.driverName ?? '', driverPhone: v.driverPhone ?? '', capacity: v.capacity?.toString() ?? '', capacityUnit: v.capacityUnit, notes: v.notes ?? '' })
    setEditId(v.id); setError(null); setShowForm(true)
  }

  const save = async () => {
    if (!form.vehicleNumber.trim()) { setError(t('logistics.fleet.vehicleNumberRequired')); return }
    setSaving(true); setError(null)
    const payload = { ...form, capacity: form.capacity ? parseFloat(form.capacity) : undefined, driverName: form.driverName || undefined, driverPhone: form.driverPhone || undefined, notes: form.notes || undefined }
    const res = editId ? await window.api.logisticsVehicle.update({ id: editId, ...payload }) : await window.api.logisticsVehicle.create(payload)
    setSaving(false)
    if (res.success) { setShowForm(false); load() }
    else setError(res.error?.message ?? t('common.error'))
  }

  const updateStatus = async (id: string, status: string) => {
    const res = await window.api.logisticsVehicle.updateStatus({ id, status })
    if (res.success) load()
    else toastError(t('common.error'), res.error?.message ?? t('common.error'))
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await window.api.logisticsVehicle.delete(deleteTarget.id)
    setDeleting(false)
    if (res.success) { setDeleteTarget(null); load() }
    else toastError(t('common.error'), res.error?.message ?? t('common.error'))
  }

  // Status filtering is server-side; ownerType and search are client-side
  const filtered = vehicles.filter(v => {
    if (filterOwnerType !== 'ALL' && v.ownerType !== filterOwnerType) return false
    if (search && !v.vehicleNumber.toLowerCase().includes(search.toLowerCase()) && !(v.driverName ?? '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const printFleet = () => {
    const rows = filtered.map(v => `<tr><td>${v.vehicleNumber}</td><td>${v.vehicleType}</td><td>${v.ownerType}</td><td>${v.driverName ?? '-'}</td><td>${v.capacity ? `${v.capacity} ${v.capacityUnit}` : '-'}</td><td>${v.status}</td><td>${v.shipmentsThisMonth}</td></tr>`).join('')
    const html = `<html><head><style>body{font-family:Arial,sans-serif;font-size:12px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f5f5f5}@media print{.no-print{display:none}}footer{margin-top:20px;font-size:10px;color:#888;text-align:center}</style></head><body><h2>${t('logistics.fleet.printTitle')}</h2><table><thead><tr><th>${t('logistics.fleet.colVehicleNo')}</th><th>${t('logistics.fleet.vehicleType')}</th><th>${t('logistics.fleet.ownerType')}</th><th>${t('logistics.fleet.colDriver')}</th><th>${t('logistics.fleet.colCapacity')}</th><th>${t('common.status')}</th><th>${t('logistics.fleet.colTrips')}</th></tr></thead><tbody>${rows}</tbody></table><footer>${aszurexFooterHtml(10)}</footer></body></html>`
    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close(); w.print() }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-800">{t('logistics.fleet.title')}</h1>
        <div className="flex gap-2">
          <button onClick={printFleet} className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">{t('common.print')}</button>
          <button onClick={openAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">{t('logistics.fleet.addVehicle')}</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('logistics.fleet.searchPlaceholder')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56" />
        <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="ALL">{t('logistics.fleet.allStatus')}</option>
          {['AVAILABLE', 'IN_TRANSIT', 'MAINTENANCE', 'RETIRED'].map(s => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={filterOwnerType} onChange={e => setFilterOwnerType(e.target.value)}>
          <option value="ALL">{t('logistics.fleet.allOwnerTypes')}</option>
          {OWNER_TYPES.map(o => <option key={o} value={o}>{o}</option>)}
        </Select>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">{t('logistics.fleet.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">{t('logistics.fleet.empty')}</div>
      ) : (
        <Card padding="none" className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3">{t('logistics.fleet.colVehicleNo')}</th>
                <th className="text-left px-4 py-3">{t('logistics.fleet.colTypeOwner')}</th>
                <th className="text-left px-4 py-3">{t('logistics.fleet.colDriver')}</th>
                <th className="text-left px-4 py-3">{t('logistics.fleet.colCapacity')}</th>
                <th className="text-left px-4 py-3">{t('common.status')}</th>
                <th className="text-left px-4 py-3">{t('logistics.fleet.colTrips')}</th>
                <th className="text-left px-4 py-3">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(v => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{v.vehicleNumber}</td>
                  <td className="px-4 py-3 text-gray-500">{v.vehicleType} / {v.ownerType}</td>
                  <td className="px-4 py-3">{v.driverName ?? <span className="text-gray-400">—</span>}{v.driverPhone && <div className="text-xs text-gray-400">{v.driverPhone}</div>}</td>
                  <td className="px-4 py-3">{v.capacity ? `${v.capacity} ${v.capacityUnit}` : '—'}</td>
                  <td className="px-4 py-3">
                    {v.status === 'IN_TRANSIT' ? (
                      <Badge variant={STATUS_VARIANT[v.status] ?? 'neutral'} size="sm">{v.status}</Badge>
                    ) : (
                      <select value={v.status} onChange={e => updateStatus(v.id, e.target.value)} className={`text-xs px-2 py-1 rounded-full font-medium border-0 cursor-pointer ${STATUS_PILL_CLASSES[v.status] ?? ''}`}>
                        {MANUAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">{v.shipmentsThisMonth}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(v)} className="text-blue-600 hover:underline text-xs">{t('common.edit')}</button>
                      {v.status !== 'IN_TRANSIT' && <button onClick={() => setDeleteTarget(v)} className="text-red-500 hover:underline text-xs">{t('common.delete')}</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {!loading && total > vehicles.length && (
        <div className="text-center py-3">
          <p className="text-xs text-gray-400 mb-2">{t('logistics.showingOf', { shown: vehicles.length, total })}</p>
          <button onClick={() => setLimit(l => l + PAGE_SIZE)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t('logistics.loadMore')}</button>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold">{editId ? t('logistics.fleet.editVehicle') : t('logistics.fleet.addVehicleTitle')}</h2>
            {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">{t('logistics.fleet.vehicleNumber')}</label>
                <input value={form.vehicleNumber} onChange={e => setForm(f => ({ ...f, vehicleNumber: e.target.value.toUpperCase() }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm uppercase" placeholder="MH01AB1234" />
              </div>
              <Select label={t('logistics.fleet.vehicleType')} value={form.vehicleType} onChange={e => setForm(f => ({ ...f, vehicleType: e.target.value }))}>
                {VEHICLE_TYPES.map(vt => <option key={vt}>{vt}</option>)}
              </Select>
              <Select label={t('logistics.fleet.ownerType')} value={form.ownerType} onChange={e => setForm(f => ({ ...f, ownerType: e.target.value }))}>
                {OWNER_TYPES.map(ot => <option key={ot}>{ot}</option>)}
              </Select>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.fleet.driverName')}</label>
                <input value={form.driverName} onChange={e => setForm(f => ({ ...f, driverName: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.fleet.driverPhone')}</label>
                <input value={form.driverPhone} onChange={e => setForm(f => ({ ...f, driverPhone: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.fleet.colCapacity')}</label>
                <input type="number" min="0" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <Select label={t('logistics.fleet.capacityUnit')} value={form.capacityUnit} onChange={e => setForm(f => ({ ...f, capacityUnit: e.target.value }))}>
                {['KG', 'TON', 'L', 'CBM'].map(u => <option key={u}>{u}</option>)}
              </Select>
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">{t('common.notes')}</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
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
        onConfirm={handleDelete}
        loading={deleting}
        title={t('common.delete')}
        message={deleteTarget ? t('logistics.fleet.deleteConfirm', { number: deleteTarget.vehicleNumber }) : ''}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}
