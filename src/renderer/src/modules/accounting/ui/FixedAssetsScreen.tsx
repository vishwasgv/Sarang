import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Boxes, RefreshCw, Plus } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Modal } from '@shared/ui/molecules/Modal'
import { SkeletonTable } from '@shared/ui/Skeleton'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { formatCurrency } from '@shared/utils/currency.util'

interface FixedAsset {
  id: string; assetCode: string; assetName: string; category: string | null
  purchaseCost: number; accumulatedDepreciation: number; status: string
}

// Phase 62 — Fixed Asset register.
export function FixedAssetsScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canManage = hasPermission('fixedAssets.manage')

  const [assets, setAssets] = useState<FixedAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ACTIVE')
  const [showCreate, setShowCreate] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.fixedAssets.list(statusFilter ? { status: statusFilter } : undefined)
      if (res.success && res.data) setAssets(res.data as FixedAsset[])
      else toastError(t('common.error'), res.error?.message ?? t('accounting.fixedAssets.couldNotLoad'))
    } catch {
      toastError(t('common.error'), t('accounting.fixedAssets.couldNotLoad'))
    } finally { setLoading(false) }
  }, [statusFilter, toastError, t])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
              <Boxes size={18} className="text-brand" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('accounting.fixedAssets.title')}</h1>
              <p className="text-xs text-slate-400">{t('accounting.fixedAssets.assetsCount', { count: assets.length })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            {canManage && <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>{t('accounting.fixedAssets.newAsset')}</Button>}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4">
          {['ACTIVE', 'DISPOSED', ''].map((s) => (
            <button key={s || 'ALL'} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${statusFilter === s ? 'bg-brand text-white border-brand' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-brand'}`}>
              {s === 'ACTIVE' ? t('accounting.fixedAssets.statusActive') : s === 'DISPOSED' ? t('accounting.fixedAssets.statusDisposed') : t('common.all')}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto dark:bg-slate-950 p-6">
        {loading && assets.length === 0 ? (
          <SkeletonTable rows={4} cols={5} />
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
            <Boxes size={40} className="opacity-30" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('accounting.fixedAssets.noAssetsYet')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {assets.map((a) => {
              const bookValue = a.purchaseCost - a.accumulatedDepreciation
              return (
                <Card key={a.id} padding="lg" className="space-y-3 cursor-pointer hover:border-brand/40 transition-colors" onClick={() => navigate(`/accounting/fixed-assets/${a.id}`)}>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-400">{a.assetCode}</span>
                    <Badge variant={a.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">{a.status === 'ACTIVE' ? t('accounting.fixedAssets.statusActive') : t('accounting.fixedAssets.statusDisposed')}</Badge>
                  </div>
                  <div>
                    <p className="font-semibold text-dark dark:text-slate-100">{a.assetName}</p>
                    {a.category && <p className="text-xs text-slate-400">{a.category}</p>}
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">{t('accounting.fixedAssets.bookValue')}</span>
                    <span className="font-bold text-brand">{formatCurrency(bookValue)}</span>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateAssetModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} />
      )}
    </div>
  )
}

function CreateAssetModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const [form, setForm] = useState({
    assetCode: '', assetName: '', category: '', purchaseDate: new Date().toISOString().slice(0, 10),
    purchaseCost: '', usefulLifeMonths: '', depreciationMethod: 'STRAIGHT_LINE', salvageValue: '0'
  })
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!form.assetCode.trim() || !form.assetName.trim() || !form.purchaseCost || !form.usefulLifeMonths) {
      toastError(t('accounting.fixedAssets.missingFields'), t('accounting.fixedAssets.fieldsRequired')); return
    }
    setSaving(true)
    try {
      const res = await window.api.fixedAssets.create({
        assetCode: form.assetCode.trim(), assetName: form.assetName.trim(), category: form.category.trim() || undefined,
        purchaseDate: form.purchaseDate, purchaseCost: parseFloat(form.purchaseCost), usefulLifeMonths: parseInt(form.usefulLifeMonths, 10),
        depreciationMethod: form.depreciationMethod, salvageValue: parseFloat(form.salvageValue) || 0
      })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('accounting.fixedAssets.couldNotCreate')); return }
      toastSuccess(t('accounting.fixedAssets.assetCreated'), form.assetName.trim())
      onSaved()
    } catch {
      toastError(t('common.error'), t('accounting.fixedAssets.couldNotCreate'))
    } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={t('accounting.fixedAssets.newAsset')} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
        <Button onClick={handleSave} loading={saving}>{t('common.create')}</Button>
      </>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('accounting.fixedAssets.assetCodeLabel')} value={form.assetCode} onChange={(e) => setForm((f) => ({ ...f, assetCode: e.target.value }))} placeholder={t('accounting.fixedAssets.assetCodePlaceholder')} />
          <Input label={t('accounting.fixedAssets.categoryLabel')} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder={t('common.optional')} />
        </div>
        <Input label={t('accounting.fixedAssets.assetNameLabel')} value={form.assetName} onChange={(e) => setForm((f) => ({ ...f, assetName: e.target.value }))} placeholder={t('accounting.fixedAssets.assetNamePlaceholder')} />
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('accounting.fixedAssets.purchaseDateLabel')}</label>
          <input type="date" value={form.purchaseDate} onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))}
            className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label={t('accounting.fixedAssets.purchaseCostLabel')} type="number" value={form.purchaseCost} onChange={(e) => setForm((f) => ({ ...f, purchaseCost: e.target.value }))} />
          <Input label={t('accounting.fixedAssets.usefulLifeLabel')} type="number" value={form.usefulLifeMonths} onChange={(e) => setForm((f) => ({ ...f, usefulLifeMonths: e.target.value }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label={t('accounting.fixedAssets.depreciationMethodLabel')} value={form.depreciationMethod} onChange={(e) => setForm((f) => ({ ...f, depreciationMethod: e.target.value }))}>
            <option value="STRAIGHT_LINE">{t('accounting.fixedAssets.straightLine')}</option>
            <option value="WDV">{t('accounting.fixedAssets.writtenDownValue')}</option>
          </Select>
          <Input label={t('accounting.fixedAssets.salvageValueLabel')} type="number" value={form.salvageValue} onChange={(e) => setForm((f) => ({ ...f, salvageValue: e.target.value }))} />
        </div>
      </div>
    </Modal>
  )
}
