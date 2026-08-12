import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Tag, RefreshCw, Plus, Search, Trash2 } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Badge } from '@shared/ui/atoms/Badge'
import { Modal } from '@shared/ui/molecules/Modal'
import { SkeletonTable } from '@shared/ui/Skeleton'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { cn } from '@shared/utils/cn'

interface PriceList {
  id: string
  name: string
  appliesTo: 'CUSTOMER' | 'SUPPLIER'
  currencyCode: string
  isActive: boolean
  _count?: { items: number }
}

interface PriceListItem {
  id?: string
  productId: string
  minQuantity: number
  unitPrice: number
  product?: { id: string; productName: string; sku?: string | null }
}

interface Product { id: string; productName: string; sku?: string | null; unit: string }

const APPLIES_TO_VALUES = ['CUSTOMER', 'SUPPLIER'] as const

// Phase 63 — Formal Price Lists (quantity-tiered pricing per customer/supplier).
export function PriceListsScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canManage = hasPermission('priceLists.manage')

  const [priceLists, setPriceLists] = useState<PriceList[]>([])
  const [loading, setLoading] = useState(true)
  const [appliesToFilter, setAppliesToFilter] = useState<'' | 'CUSTOMER' | 'SUPPLIER'>('')
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<PriceList | null>(null)
  const [tiersTarget, setTiersTarget] = useState<PriceList | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.priceLists.list(appliesToFilter ? { appliesTo: appliesToFilter } : undefined)
      if (res.success && res.data) setPriceLists(res.data as PriceList[])
      else toastError(t('common.error'), res.error?.message ?? t('priceLists.couldNotLoad'))
    } catch {
      toastError(t('common.error'), t('priceLists.couldNotLoad'))
    } finally {
      setLoading(false)
    }
  }, [appliesToFilter, toastError, t])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
              <Tag size={18} className="text-brand" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('priceLists.title')}</h1>
              <p className="text-xs text-slate-400">{t('priceLists.subtitle', { count: priceLists.length })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            {canManage && (
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>{t('priceLists.newPriceList')}</Button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          {(['', ...APPLIES_TO_VALUES] as const).map((val) => (
            <button
              key={val || 'ALL'}
              onClick={() => setAppliesToFilter(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${appliesToFilter === val ? 'bg-brand text-white border-brand' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-brand'}`}
            >
              {val === '' ? t('common.all') : val === 'CUSTOMER' ? t('priceLists.forCustomers') : t('priceLists.forSuppliers')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto dark:bg-slate-950">
        {loading && priceLists.length === 0 ? (
          <div className="p-6"><SkeletonTable rows={6} cols={5} /></div>
        ) : priceLists.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
            <Tag size={40} className="opacity-30" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('priceLists.noPriceListsYet')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                <th className="text-start px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.name')}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('priceLists.appliesTo')}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('priceLists.currency')}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('priceLists.tiers')}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.status')}</th>
                <th className="text-end px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {priceLists.map((pl) => (
                <tr key={pl.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-3 font-semibold text-dark dark:text-slate-100">{pl.name}</td>
                  <td className="px-4 py-3 text-center"><Badge variant={pl.appliesTo === 'CUSTOMER' ? 'info' : 'brand'} size="sm">{pl.appliesTo === 'CUSTOMER' ? t('priceLists.forCustomers') : t('priceLists.forSuppliers')}</Badge></td>
                  <td className="px-4 py-3 text-center text-xs text-slate-400">{pl.currencyCode}</td>
                  <td className="px-4 py-3 text-center text-xs text-slate-500 dark:text-slate-400">{pl._count?.items ?? 0}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={pl.isActive ? 'success' : 'neutral'} size="sm">{pl.isActive ? t('common.active') : t('common.inactive')}</Badge>
                  </td>
                  <td className="px-6 py-3 text-end">
                    {canManage && (
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => setTiersTarget(pl)} className="text-xs font-semibold text-brand hover:text-brand/80 transition-colors">{t('priceLists.manageTiers')}</button>
                        <button onClick={() => setEditTarget(pl)} className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-brand transition-colors">{t('common.edit')}</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CreatePriceListModal
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load() }}
        />
      )}
      {editTarget && (
        <EditPriceListModal
          priceList={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); load() }}
        />
      )}
      {tiersTarget && (
        <ManageTiersModal
          priceList={tiersTarget}
          onClose={() => setTiersTarget(null)}
          onSaved={() => { setTiersTarget(null); load() }}
        />
      )}
    </div>
  )
}

function CreatePriceListModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const [name, setName] = useState('')
  const [appliesTo, setAppliesTo] = useState<'CUSTOMER' | 'SUPPLIER'>('CUSTOMER')
  const [currencyCode, setCurrencyCode] = useState('INR')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) { toastError(t('priceLists.missingFields'), t('priceLists.nameRequired')); return }
    setSaving(true)
    try {
      const res = await window.api.priceLists.create({ name: name.trim(), appliesTo, currencyCode: currencyCode.trim() || 'INR' })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('priceLists.couldNotCreate')); return }
      toastSuccess(t('priceLists.priceListCreated'), name.trim())
      onSaved()
    } catch {
      toastError(t('common.error'), t('priceLists.couldNotCreate'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('priceLists.newPriceList')} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
        <Button onClick={handleSave} loading={saving}>{t('common.create')}</Button>
      </>}
    >
      <div className="space-y-4">
        <Input label={t('common.name')} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('priceLists.namePlaceholder')} />
        <Select label={t('priceLists.appliesTo')} value={appliesTo} onChange={(e) => setAppliesTo(e.target.value as 'CUSTOMER' | 'SUPPLIER')}>
          <option value="CUSTOMER">{t('priceLists.forCustomers')}</option>
          <option value="SUPPLIER">{t('priceLists.forSuppliers')}</option>
        </Select>
        <Input label={t('priceLists.currency')} value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())} maxLength={10} />
      </div>
    </Modal>
  )
}

function EditPriceListModal({ priceList, onClose, onSaved }: { priceList: PriceList; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const [name, setName] = useState(priceList.name)
  const [isActive, setIsActive] = useState(priceList.isActive)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) { toastError(t('priceLists.missingFields'), t('priceLists.nameRequired')); return }
    setSaving(true)
    try {
      const res = await window.api.priceLists.update({ id: priceList.id, name: name.trim(), isActive })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('priceLists.couldNotSave')); return }
      toastSuccess(t('common.saveChanges'), name.trim())
      onSaved()
    } catch {
      toastError(t('common.error'), t('priceLists.couldNotSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('common.edit')} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
        <Button onClick={handleSave} loading={saving}>{t('common.save')}</Button>
      </>}
    >
      <div className="space-y-4">
        <Input label={t('common.name')} value={name} onChange={(e) => setName(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-slate-300" />
          {t('common.active')}
        </label>
      </div>
    </Modal>
  )
}

function TierProductPicker({ products, value, onChange }: {
  products: Product[]
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
          className="w-full h-8 ps-6 pe-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand text-slate-700 dark:text-slate-300"
        />
      </div>
      {open && (
        <div className="absolute start-0 end-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">{t('common.noResults')}</p>
          ) : (
            results.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onChange(p.id); setQuery(''); setOpen(false) }}
                className={cn('w-full text-start px-3 py-2 text-sm hover:bg-brand/5 transition-colors', p.id === value && 'bg-brand/5')}
              >
                <p className="text-dark dark:text-slate-100">{p.productName}</p>
                {p.sku && <p className="text-xs text-slate-400">SKU: {p.sku}</p>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function ManageTiersModal({ priceList, onClose, onSaved }: { priceList: PriceList; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const [products, setProducts] = useState<Product[]>([])
  const [rows, setRows] = useState<PriceListItem[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function loadData() {
      setLoadingData(true)
      try {
        const [detailRes, productsRes] = await Promise.all([
          window.api.priceLists.get(priceList.id),
          window.api.products.list({ isActive: true, limit: 500 })
        ])
        if (detailRes.success) {
          const d = detailRes.data as { items: PriceListItem[] }
          setRows((d.items ?? []).map(i => ({ productId: i.productId, minQuantity: i.minQuantity, unitPrice: i.unitPrice, product: i.product })))
        }
        if (productsRes.success) {
          const d = productsRes.data as { products: Product[] }
          setProducts(d.products ?? [])
        }
      } catch {
        toastError(t('common.error'), t('priceLists.couldNotLoad'))
      } finally {
        setLoadingData(false)
      }
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceList.id])

  function addRow() {
    setRows(r => [...r, { productId: '', minQuantity: 1, unitPrice: 0 }])
  }

  function removeRow(index: number) {
    setRows(r => r.filter((_, i) => i !== index))
  }

  function updateRow(index: number, patch: Partial<PriceListItem>) {
    setRows(r => r.map((row, i) => i === index ? { ...row, ...patch } : row))
  }

  async function handleSave() {
    const validRows = rows.filter(r => r.productId)
    if (validRows.length === 0) { toastError(t('priceLists.missingFields'), t('priceLists.atLeastOneTier')); return }
    setSaving(true)
    try {
      const res = await window.api.priceLists.setItems({
        priceListId: priceList.id,
        items: validRows.map(r => ({ productId: r.productId, minQuantity: r.minQuantity, unitPrice: r.unitPrice }))
      })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('priceLists.couldNotSave')); return }
      toastSuccess(t('common.saveChanges'), priceList.name)
      onSaved()
    } catch {
      toastError(t('common.error'), t('priceLists.couldNotSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`${t('priceLists.manageTiers')} — ${priceList.name}`} size="lg"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
        <Button onClick={handleSave} loading={saving}>{t('common.save')}</Button>
      </>}
    >
      {loadingData ? (
        <div className="space-y-3 py-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">{t('priceLists.tiersHint')}</p>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">{t('priceLists.tiers')}</p>
            <button type="button" onClick={addRow} className="flex items-center gap-1 text-xs font-medium text-brand hover:text-brand/80 transition-colors">
              <Plus size={12} /> {t('priceLists.addTier')}
            </button>
          </div>
          <div className="space-y-2">
            {rows.length === 0 && (
              <p className="text-xs text-slate-400 py-4 text-center">{t('priceLists.noTiersYet')}</p>
            )}
            {rows.map((row, index) => (
              <div key={index} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                <TierProductPicker products={products} value={row.productId} onChange={(productId) => updateRow(index, { productId })} />
                <input type="number" min="1" step="1" value={row.minQuantity}
                  onChange={e => updateRow(index, { minQuantity: Number(e.target.value) || 1 })}
                  placeholder={t('priceLists.minQuantity')}
                  className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand" />
                <input type="number" min="0" step="0.01" value={row.unitPrice}
                  onChange={e => updateRow(index, { unitPrice: Number(e.target.value) || 0 })}
                  placeholder={t('priceLists.unitPrice')}
                  className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand" />
                <button type="button" onClick={() => removeRow(index)} className="p-1.5 rounded text-slate-400 hover:text-danger hover:bg-danger/10 transition-colors">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
