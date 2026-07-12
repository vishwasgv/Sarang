import { useState, useEffect, useCallback } from 'react'
import { Phone, Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatCurrency } from '@shared/utils/currency.util'
import { useBusinessStore } from '@app/store/business.store'
import { useNotificationStore } from '@app/store/notification.store'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'

interface Carrier {
  id: string; name: string; type: string; phone: string | null; email: string | null
  gstNumber: string | null; ratePerKg: number | null; ratePerKm: number | null
  notes: string | null; isActive: boolean; createdAt: string; updatedAt: string
}

const CARRIER_TYPES = ['COURIER', 'TRANSPORT', '3PL', 'OWN_FLEET']
const EMPTY_FORM = { name: '', type: 'COURIER', phone: '', email: '', gstNumber: '', ratePerKg: '', ratePerKm: '', notes: '' }

export default function CarriersScreen() {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const [carriers, setCarriers] = useState<Carrier[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeOnly, setActiveOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Carrier | null>(null)
  const [deleting, setDeleting] = useState(false)
  const currSym = useBusinessStore(s => s.profile?.currencySymbol ?? '₹')
  const PAGE_SIZE = 100
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [total, setTotal] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.logisticsCarrier.list({ activeOnly, limit })
      if (res.success) { setCarriers(res.data as Carrier[]); setTotal((res as { total?: number }).total ?? (res.data as Carrier[]).length) }
      else toastError(t('common.error'), res.error?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [activeOnly, limit, toastError, t])

  useEffect(() => { setLimit(PAGE_SIZE) }, [activeOnly])
  useEffect(() => { load() }, [load])

  const openAdd = () => { setForm({ ...EMPTY_FORM }); setEditId(null); setError(null); setShowForm(true) }
  const openEdit = (c: Carrier) => {
    setForm({ name: c.name, type: c.type, phone: c.phone ?? '', email: c.email ?? '', gstNumber: c.gstNumber ?? '', ratePerKg: c.ratePerKg?.toString() ?? '', ratePerKm: c.ratePerKm?.toString() ?? '', notes: c.notes ?? '' })
    setEditId(c.id); setError(null); setShowForm(true)
  }

  const save = async () => {
    if (!form.name.trim()) { setError(t('logistics.carriers.carrierNameRequired')); return }
    setSaving(true); setError(null)
    const payload = {
      ...form,
      ratePerKg: form.ratePerKg ? parseFloat(form.ratePerKg) : undefined,
      ratePerKm: form.ratePerKm ? parseFloat(form.ratePerKm) : undefined,
      phone: form.phone || undefined, email: form.email || undefined,
      gstNumber: form.gstNumber || undefined, notes: form.notes || undefined,
    }
    const res = editId ? await window.api.logisticsCarrier.update({ id: editId, ...payload }) : await window.api.logisticsCarrier.create(payload)
    setSaving(false)
    if (res.success) { setShowForm(false); load() }
    else setError(res.error?.message ?? t('common.error'))
  }

  const toggle = async (id: string) => {
    try {
      const res = await window.api.logisticsCarrier.toggleActive(id)
      if (res.success) load()
      else toastError(t('common.error'), res.error?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await window.api.logisticsCarrier.delete(deleteTarget.id)
    setDeleting(false)
    if (res.success) { setDeleteTarget(null); load() }
    else toastError(t('common.error'), res.error?.message ?? t('common.error'))
  }

  const filtered = carriers.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone ?? '').includes(search))

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl font-bold text-gray-800">{t('logistics.carriers.title')}</h1>
        <button onClick={openAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">{t('logistics.carriers.addCarrier')}</button>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('logistics.carriers.searchPlaceholder')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-56" />
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={activeOnly} onChange={e => setActiveOnly(e.target.checked)} className="rounded" />
          {t('logistics.carriers.activeOnly')}
        </label>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">{t('logistics.carriers.loading')}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">{t('logistics.carriers.empty')}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <Card key={c.id} padding="md" className={`space-y-2 ${c.isActive ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.type}</p>
                </div>
                <Badge variant={c.isActive ? 'success' : 'neutral'} size="sm">{c.isActive ? t('common.active') : t('common.inactive')}</Badge>
              </div>
              {c.phone && <p className="text-sm text-gray-600 flex items-center gap-1"><Phone size={12} className="text-gray-400" />{c.phone}</p>}
              {c.email && <p className="text-sm text-gray-600 flex items-center gap-1"><Mail size={12} className="text-gray-400" />{c.email}</p>}
              {c.gstNumber && <p className="text-xs text-gray-400">GST: {c.gstNumber}</p>}
              <div className="flex gap-3 text-xs text-gray-500">
                {c.ratePerKg && <span>{formatCurrency(c.ratePerKg)}/kg</span>}
                {c.ratePerKm && <span>{formatCurrency(c.ratePerKm)}/km</span>}
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => openEdit(c)} className="text-blue-600 text-xs hover:underline">{t('common.edit')}</button>
                <button onClick={() => toggle(c.id)} className="text-yellow-600 text-xs hover:underline">{c.isActive ? t('logistics.carriers.deactivate') : t('logistics.carriers.activate')}</button>
                <button onClick={() => setDeleteTarget(c)} className="text-red-500 text-xs hover:underline">{t('common.delete')}</button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {!loading && total > carriers.length && (
        <div className="text-center py-3">
          <p className="text-xs text-gray-400 mb-2">{t('logistics.showingOf', { shown: carriers.length, total })}</p>
          <button onClick={() => setLimit(l => l + PAGE_SIZE)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">{t('logistics.loadMore')}</button>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold">{editId ? t('logistics.carriers.editCarrier') : t('logistics.carriers.addCarrierTitle')}</h2>
            {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm font-medium text-gray-700">{t('logistics.carriers.carrierName')}</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <Select label={t('logistics.carriers.carrierType')} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {CARRIER_TYPES.map(ct => <option key={ct}>{ct}</option>)}
              </Select>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('common.phone')}</label>
                <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('common.email')}</label>
                <input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.carriers.gstNumber')}</label>
                <input value={form.gstNumber} onChange={e => setForm(f => ({ ...f, gstNumber: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.carriers.ratePerKg')} ({currSym})</label>
                <input type="number" min="0" value={form.ratePerKg} onChange={e => setForm(f => ({ ...f, ratePerKg: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">{t('logistics.carriers.ratePerKm')} ({currSym})</label>
                <input type="number" min="0" value={form.ratePerKm} onChange={e => setForm(f => ({ ...f, ratePerKm: e.target.value }))} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
              </div>
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
        message={deleteTarget ? t('logistics.carriers.deleteConfirm', { name: deleteTarget.name }) : ''}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}
