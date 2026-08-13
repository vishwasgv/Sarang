import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { MapPin, Plus, RefreshCw, ArrowLeftRight, Search } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Badge } from '@shared/ui/atoms/Badge'
import { Modal } from '@shared/ui/molecules/Modal'
import { SkeletonTable } from '@shared/ui/Skeleton'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'

interface Location { id: string; name: string; address: string | null; isDefault: boolean; isActive: boolean }
interface PickableProduct { id: string; productName: string; sku?: string | null }

// Phase 64 — multi-location stock. A single-location install (the
// overwhelming majority) sees one row here, no transfer UI friction beyond
// this dedicated screen — nothing elsewhere in the app shows a location
// picker until a second Location exists (see locationService.hasMultipleLocations).
export function LocationsScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canManage = hasPermission('locations.manage')
  const canTransfer = hasPermission('inventory.transferStock')

  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<Location | null>(null)
  const [showTransfer, setShowTransfer] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.locations.list()
      if (res.success && res.data) setLocations(res.data as Location[])
      else toastError(t('common.error'), res.error?.message ?? t('locations.couldNotLoad'))
    } catch {
      toastError(t('common.error'), t('locations.couldNotLoad'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
              <MapPin size={18} className="text-brand" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('locations.title')}</h1>
              <p className="text-xs text-slate-400">{t('locations.subtitle', { count: locations.length })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            {canTransfer && locations.length > 1 && (
              <Button variant="secondary" size="sm" icon={<ArrowLeftRight size={14} />} onClick={() => setShowTransfer(true)}>{t('locations.transferStock')}</Button>
            )}
            {canManage && (
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>{t('locations.newLocation')}</Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto dark:bg-slate-950">
        {loading && locations.length === 0 ? (
          <div className="p-6"><SkeletonTable rows={4} cols={4} /></div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                <th className="text-start px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('locations.name')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('locations.address')}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.status')}</th>
                <th className="text-end px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => (
                <tr key={loc.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-3 font-semibold text-dark dark:text-slate-100">
                    {loc.name}
                    {loc.isDefault && <Badge variant="brand" size="sm" className="ms-2">{t('locations.default')}</Badge>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{loc.address ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={loc.isActive ? 'success' : 'neutral'} size="sm">{loc.isActive ? t('common.active') : t('common.inactive')}</Badge>
                  </td>
                  <td className="px-6 py-3 text-end">
                    {canManage && (
                      <button onClick={() => setEditTarget(loc)} className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-brand transition-colors">{t('common.edit')}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <LocationFormModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} />
      )}
      {editTarget && (
        <LocationFormModal location={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); load() }} />
      )}
      {showTransfer && (
        <TransferStockModal locations={locations} onClose={() => setShowTransfer(false)} onSaved={() => setShowTransfer(false)} />
      )}
    </div>
  )
}

function LocationFormModal({ location, onClose, onSaved }: { location?: Location; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [name, setName] = useState(location?.name ?? '')
  const [address, setAddress] = useState(location?.address ?? '')
  const [isActive, setIsActive] = useState(location?.isActive ?? true)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) { toastError(t('common.error'), t('locations.nameRequired')); return }
    setSaving(true)
    try {
      const res = location
        ? await window.api.locations.update({ id: location.id, name: name.trim(), address: address.trim() || undefined, isActive })
        : await window.api.locations.create({ name: name.trim(), address: address.trim() || undefined })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('locations.couldNotSave')); return }
      toastSuccess(t('common.saveChanges'), '')
      onSaved()
    } catch {
      toastError(t('common.error'), t('locations.couldNotSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={location ? t('locations.editLocation') : t('locations.newLocation')}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button size="sm" onClick={handleSave} loading={saving}>{t('common.saveChanges')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label={`${t('locations.name')} *`} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('locations.namePlaceholder')} />
        <Input label={t('locations.address')} value={address} onChange={(e) => setAddress(e.target.value)} placeholder={t('locations.addressPlaceholder')} />
        {location && !location.isDefault && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand" />
            <span className="text-sm text-slate-700 dark:text-slate-200">{t('common.active')}</span>
          </label>
        )}
        {location?.isDefault && (
          <p className="text-xs text-slate-400">{t('locations.defaultCannotDeactivate')}</p>
        )}
      </div>
    </Modal>
  )
}

// Phase 64 — same lightweight search-dropdown pattern this codebase already
// uses locally per-screen (e.g. PriceListsScreen's TierProductPicker,
// ProductFormModal's KitComponentProductPicker) rather than a shared component.
function TransferProductPicker({ products, value, onChange }: {
  products: PickableProduct[]
  value: string
  onChange: (productId: string) => void
}) {
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
    ? products.filter(p =>
        p.productName.toLowerCase().includes(query.toLowerCase()) ||
        (p.sku ?? '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 50)
    : products.slice(0, 50)

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <Search size={12} className="absolute start-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={open ? query : (selected ? `${selected.productName}${selected.sku ? ` (${selected.sku})` : ''}` : '')}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true) }}
          onFocus={() => { setQuery(''); setOpen(true) }}
          placeholder={t('locations.searchProduct')}
          className="w-full h-9 ps-6 pe-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand text-slate-700 dark:text-slate-300"
        />
      </div>
      {open && (
        <div className="absolute z-10 mt-1 w-full max-h-52 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg">
          {results.length === 0 && <div className="px-3 py-2 text-xs text-slate-400">{t('locations.noProductsFound')}</div>}
          {results.map(p => (
            <button
              type="button"
              key={p.id}
              onClick={() => { onChange(p.id); setOpen(false) }}
              className="w-full text-start px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
            >
              {p.productName}{p.sku ? <span className="text-slate-400 text-xs"> ({p.sku})</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TransferStockModal({ locations, onClose, onSaved }: { locations: Location[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [products, setProducts] = useState<PickableProduct[]>([])
  const [productId, setProductId] = useState('')
  const [fromLocationId, setFromLocationId] = useState('')
  const [toLocationId, setToLocationId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.api.products.list({ isActive: true, limit: 1000 }).then((res) => {
      if (res.success && res.data) setProducts(((res.data as { products: PickableProduct[] }).products ?? []))
    }).catch(() => {})
  }, [])

  async function handleTransfer() {
    if (!productId) { toastError(t('common.error'), t('locations.selectProduct')); return }
    if (!fromLocationId || !toLocationId) { toastError(t('common.error'), t('locations.selectBothLocations')); return }
    if (fromLocationId === toLocationId) { toastError(t('common.error'), t('locations.sameLocationError')); return }
    if (quantity <= 0) { toastError(t('common.error'), t('locations.quantityMustBePositive')); return }
    setSaving(true)
    try {
      const res = await window.api.inventory.transferStock({ productId, quantity, fromLocationId, toLocationId, reason: reason.trim() || undefined })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('locations.couldNotTransfer')); return }
      toastSuccess(t('locations.stockTransferred'), '')
      onSaved()
    } catch {
      toastError(t('common.error'), t('locations.couldNotTransfer'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('locations.transferStock')}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button size="sm" onClick={handleTransfer} loading={saving}>{t('locations.transferStock')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t('locations.product')} *</label>
          <TransferProductPicker products={products} value={productId} onChange={setProductId} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t('locations.fromLocation')} *</label>
            <select value={fromLocationId} onChange={(e) => setFromLocationId(e.target.value)} className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
              <option value="">{t('common.select')}</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t('locations.toLocation')} *</label>
            <select value={toLocationId} onChange={(e) => setToLocationId(e.target.value)} className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
              <option value="">{t('common.select')}</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        </div>
        <Input label={`${t('locations.quantity')} *`} type="number" min="1" step="1" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
        <Input label={t('locations.reason')} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('locations.reasonPlaceholder')} />
      </div>
    </Modal>
  )
}
