import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Package, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Badge } from '@shared/ui/atoms/Badge'
import { Modal } from '@shared/ui/molecules/Modal'
import { SkeletonTable } from '@shared/ui/Skeleton'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { formatCurrency } from '@shared/utils/currency.util'

interface ServiceCombo {
  id: string; comboName: string; description: string | null; comboPrice: number; isActive: boolean
  memberBasePriceTotal: number
  services: Array<{ id: string; serviceName: string; basePrice: number }>
}
interface CatalogService { id: string; serviceName: string; basePrice: number }

// Phase 68 §9.1 — Beauty Salon item 5: service-combo package builder. A
// combo bundles 2+ ServiceCatalog entries at one package price below the
// members' own combined basePrice — same "flat list, no hierarchy" shape
// CostCentresScreen already established for a shop-defined-list screen.
export function ServiceCombosScreen() {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canManage = hasPermission('settings.modify')

  const [combos, setCombos] = useState<ServiceCombo[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<ServiceCombo | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.serviceCombo.list()
      if (res.success && res.data) setCombos(res.data as ServiceCombo[])
      else toastError(t('common.error'), res.error?.message ?? t('serviceCombos.couldNotLoad'))
    } catch {
      toastError(t('common.error'), t('serviceCombos.couldNotLoad'))
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
              <Package size={18} className="text-brand" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('serviceCombos.title')}</h1>
              <p className="text-xs text-slate-400">{t('serviceCombos.subtitle', { count: combos.length })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            {canManage && (
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>{t('serviceCombos.newCombo')}</Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto dark:bg-slate-950">
        {loading && combos.length === 0 ? (
          <div className="p-6"><SkeletonTable rows={4} cols={5} /></div>
        ) : combos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <Package size={40} className="text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t('serviceCombos.empty.title')}</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">{t('serviceCombos.empty.body')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                <th className="text-start px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('serviceCombos.comboName')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('serviceCombos.services')}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('serviceCombos.comboPrice')}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('serviceCombos.savings')}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.status')}</th>
                <th className="text-end px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {combos.map((c) => {
                const savings = c.memberBasePriceTotal - c.comboPrice
                return (
                  <tr key={c.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-3 font-semibold text-dark dark:text-slate-100">{c.comboName}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{c.services.map((s) => s.serviceName).join(', ')}</td>
                    <td className="px-4 py-3 text-end font-semibold text-dark dark:text-slate-100">{formatCurrency(c.comboPrice)}</td>
                    <td className="px-4 py-3 text-end">
                      {savings > 0 ? <span className="text-good font-semibold">{formatCurrency(savings)}</span> : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant={c.isActive ? 'success' : 'neutral'} size="sm">{c.isActive ? t('common.active') : t('common.inactive')}</Badge>
                    </td>
                    <td className="px-6 py-3 text-end">
                      {canManage && (
                        <button onClick={() => setEditTarget(c)} className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-brand transition-colors">{t('common.edit')}</button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <ServiceComboFormModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} />
      )}
      {editTarget && (
        <ServiceComboFormModal combo={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); load() }} />
      )}
    </div>
  )
}

function ServiceComboFormModal({ combo, onClose, onSaved }: { combo?: ServiceCombo; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [catalog, setCatalog] = useState<CatalogService[]>([])
  const [comboName, setComboName] = useState(combo?.comboName ?? '')
  const [description, setDescription] = useState(combo?.description ?? '')
  const [comboPrice, setComboPrice] = useState(combo ? String(combo.comboPrice) : '')
  const [selectedIds, setSelectedIds] = useState<string[]>(combo?.services.map((s) => s.id) ?? [])
  const [isActive, setIsActive] = useState(combo?.isActive ?? true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.api.serviceCatalog.list({ isActive: true }).then((res) => {
      if (res.success && res.data) setCatalog(res.data as CatalogService[])
    })
  }, [])

  const memberTotal = catalog.filter((s) => selectedIds.includes(s.id)).reduce((sum, s) => sum + s.basePrice, 0)

  async function handleSave() {
    if (!comboName.trim()) { toastError(t('common.error'), t('serviceCombos.nameRequired')); return }
    const price = Number(comboPrice)
    if (!price || price <= 0) { toastError(t('common.error'), t('serviceCombos.priceRequired')); return }
    if (selectedIds.length < 2) { toastError(t('common.error'), t('serviceCombos.needTwoServices')); return }
    setSaving(true)
    try {
      const res = combo
        ? await window.api.serviceCombo.update({ id: combo.id, comboName: comboName.trim(), description: description.trim() || null, comboPrice: price, isActive, serviceCatalogIds: selectedIds })
        : await window.api.serviceCombo.create({ comboName: comboName.trim(), description: description.trim() || undefined, comboPrice: price, serviceCatalogIds: selectedIds })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('serviceCombos.couldNotSave')); return }
      toastSuccess(t('common.saveChanges'), '')
      onSaved()
    } catch {
      toastError(t('common.error'), t('serviceCombos.couldNotSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={combo ? t('serviceCombos.editCombo') : t('serviceCombos.newCombo')}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button size="sm" onClick={handleSave} loading={saving}>{t('common.saveChanges')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label={`${t('serviceCombos.comboName')} *`} value={comboName} onChange={(e) => setComboName(e.target.value)} placeholder={t('serviceCombos.comboNamePlaceholder')} />
        <Input label={t('common.description')} value={description} onChange={(e) => setDescription(e.target.value)} />
        <Input label={`${t('serviceCombos.comboPrice')} *`} type="number" value={comboPrice} onChange={(e) => setComboPrice(e.target.value)} placeholder="0" />

        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">{t('serviceCombos.selectServices')}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t('serviceCombos.selectServicesHint')}</p>
          <div className="flex flex-wrap gap-1.5">
            {catalog.map((s) => {
              const active = selectedIds.includes(s.id)
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedIds((prev) => active ? prev.filter((id) => id !== s.id) : [...prev, s.id])}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    active ? 'bg-brand/10 text-brand border-brand/30' : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                  }`}
                >
                  {s.serviceName}
                </button>
              )
            })}
          </div>
          {selectedIds.length >= 2 && memberTotal > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{t('serviceCombos.memberTotalHint', { amount: formatCurrency(memberTotal) })}</p>
          )}
        </div>

        {combo && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand" />
            <span className="text-sm text-slate-700 dark:text-slate-200">{t('common.active')}</span>
          </label>
        )}
      </div>
    </Modal>
  )
}
