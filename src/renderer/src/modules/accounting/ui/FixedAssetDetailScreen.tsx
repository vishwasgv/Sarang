import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, TrendingDown, Trash2 } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Modal } from '@shared/ui/molecules/Modal'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDateTime } from '@shared/utils/locale.util'

interface DepreciationRun { id: string; periodStart: string; periodEnd: string; amount: number }
interface FixedAsset {
  id: string; assetCode: string; assetName: string; category: string | null
  purchaseDate: string; purchaseCost: number; usefulLifeMonths: number
  depreciationMethod: string; salvageValue: number; accumulatedDepreciation: number
  status: string; disposalDate: string | null; disposalAmount: number | null
  depreciationRuns: DepreciationRun[]
}

// Phase 62 — Fixed Asset detail: depreciation history, Run Depreciation, Dispose.
export function FixedAssetDetailScreen() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canRunDepreciation = hasPermission('fixedAssets.runDepreciation')
  const canManage = hasPermission('fixedAssets.manage')

  const [asset, setAsset] = useState<FixedAsset | null>(null)
  const [loading, setLoading] = useState(true)
  const [showDepreciate, setShowDepreciate] = useState(false)
  const [showDispose, setShowDispose] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await window.api.fixedAssets.get(id)
      if (res.success && res.data) setAsset(res.data as FixedAsset)
      else toastError(t('common.error'), res.error?.message ?? t('accounting.fixedAssetDetail.couldNotLoad'))
    } catch {
      toastError(t('common.error'), t('accounting.fixedAssetDetail.couldNotLoad'))
    } finally { setLoading(false) }
  }, [id, toastError, t])

  useEffect(() => { load() }, [load])

  if (loading || !asset) {
    return <div className="p-6 text-sm text-slate-400">{t('common.loading')}</div>
  }

  const bookValue = asset.purchaseCost - asset.accumulatedDepreciation

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/accounting/fixed-assets')} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-dark dark:text-slate-100">{asset.assetName}</h1>
            <p className="text-xs text-slate-400 font-mono">{asset.assetCode}</p>
          </div>
          <Badge variant={asset.status === 'ACTIVE' ? 'success' : 'neutral'} size="sm">{asset.status === 'ACTIVE' ? t('accounting.fixedAssets.statusActive') : t('accounting.fixedAssets.statusDisposed')}</Badge>
          {asset.status === 'ACTIVE' && canRunDepreciation && (
            <Button size="sm" variant="outline" icon={<TrendingDown size={14} />} onClick={() => setShowDepreciate(true)}>{t('accounting.fixedAssetDetail.runDepreciation')}</Button>
          )}
          {asset.status === 'ACTIVE' && canManage && (
            <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => setShowDispose(true)}>{t('accounting.fixedAssetDetail.dispose')}</Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto dark:bg-slate-950 p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card padding="sm"><p className="text-[10px] text-slate-400 uppercase font-bold">{t('accounting.fixedAssets.purchaseCostLabel')}</p><p className="text-lg font-bold text-dark dark:text-slate-100">{formatCurrency(asset.purchaseCost)}</p></Card>
          <Card padding="sm"><p className="text-[10px] text-slate-400 uppercase font-bold">{t('accounting.fixedAssetDetail.accumulatedDepreciation')}</p><p className="text-lg font-bold text-warning">{formatCurrency(asset.accumulatedDepreciation)}</p></Card>
          <Card padding="sm"><p className="text-[10px] text-slate-400 uppercase font-bold">{t('accounting.fixedAssets.bookValue')}</p><p className="text-lg font-bold text-brand">{formatCurrency(bookValue)}</p></Card>
          <Card padding="sm"><p className="text-[10px] text-slate-400 uppercase font-bold">{t('accounting.fixedAssetDetail.method')}</p><p className="text-lg font-bold text-dark dark:text-slate-100">{asset.depreciationMethod === 'STRAIGHT_LINE' ? t('accounting.fixedAssets.straightLine') : 'WDV'}</p></Card>
        </div>

        {asset.status === 'DISPOSED' && (
          <Card padding="lg" className="bg-slate-50 dark:bg-slate-800/50">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('accounting.fixedAssetDetail.disposal')}</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {t('accounting.fixedAssetDetail.disposedFor', { date: asset.disposalDate ? formatDateTime(asset.disposalDate) : '', amount: formatCurrency(asset.disposalAmount ?? 0) })}
            </p>
          </Card>
        )}

        <div>
          <h3 className="text-sm font-semibold text-dark dark:text-slate-100 mb-3">{t('accounting.fixedAssetDetail.depreciationHistory')}</h3>
          {asset.depreciationRuns.length === 0 ? (
            <p className="text-xs text-slate-400">{t('accounting.fixedAssetDetail.noDepreciationYet')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="text-start px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('accounting.fixedAssetDetail.period')}</th>
                  <th className="text-end px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.amount')}</th>
                </tr>
              </thead>
              <tbody>
                {asset.depreciationRuns.map((run) => (
                  <tr key={run.id} className="border-b border-slate-50 dark:border-slate-800">
                    <td className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(run.periodStart)} – {formatDateTime(run.periodEnd)}</td>
                    <td className="px-3 py-2 text-end font-semibold text-dark dark:text-slate-100">{formatCurrency(run.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showDepreciate && (
        <RunDepreciationModal assetId={asset.id} onClose={() => setShowDepreciate(false)} onSaved={() => { setShowDepreciate(false); load() }} />
      )}
      {showDispose && (
        <DisposeAssetModal assetId={asset.id} bookValue={bookValue} onClose={() => setShowDispose(false)} onSaved={() => { setShowDispose(false); load() }} />
      )}
    </div>
  )
}

function RunDepreciationModal({ assetId, onClose, onSaved }: { assetId: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const now = new Date()
  const [periodStart, setPeriodStart] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10))
  const [periodEnd, setPeriodEnd] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await window.api.fixedAssets.runDepreciation({ fixedAssetId: assetId, periodStart, periodEnd })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('accounting.fixedAssetDetail.couldNotRunDepreciation')); return }
      const d = res.data as { depreciation: { amount: number } }
      toastSuccess(t('accounting.fixedAssetDetail.depreciationPosted'), formatCurrency(d.depreciation.amount))
      onSaved()
    } catch {
      toastError(t('common.error'), t('accounting.fixedAssetDetail.couldNotRunDepreciation'))
    } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={t('accounting.fixedAssetDetail.runDepreciation')} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
        <Button onClick={handleSave} loading={saving}>{t('accounting.fixedAssetDetail.run')}</Button>
      </>}
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('accounting.fixedAssetDetail.periodStart')}</label>
          <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
            className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('accounting.fixedAssetDetail.periodEnd')}</label>
          <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
            className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
      </div>
    </Modal>
  )
}

function DisposeAssetModal({ assetId, bookValue, onClose, onSaved }: { assetId: string; bookValue: number; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const [disposalDate, setDisposalDate] = useState(new Date().toISOString().slice(0, 10))
  const [disposalAmount, setDisposalAmount] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await window.api.fixedAssets.dispose({ id: assetId, disposalDate, disposalAmount: parseFloat(disposalAmount) || 0 })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('accounting.fixedAssetDetail.couldNotDispose')); return }
      const d = res.data as { gainOrLoss: number }
      toastSuccess(t('accounting.fixedAssetDetail.assetDisposed'), t('accounting.fixedAssetDetail.gainOrLossOf', { type: d.gainOrLoss >= 0 ? t('accounting.fixedAssetDetail.gain') : t('accounting.fixedAssetDetail.loss'), amount: formatCurrency(Math.abs(d.gainOrLoss)) }))
      onSaved()
    } catch {
      toastError(t('common.error'), t('accounting.fixedAssetDetail.couldNotDispose'))
    } finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={t('accounting.fixedAssetDetail.disposeAsset')} size="sm"
      footer={<>
        <Button variant="secondary" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
        <Button variant="danger" onClick={handleSave} loading={saving}>{t('accounting.fixedAssetDetail.dispose')}</Button>
      </>}
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-400">{t('accounting.fixedAssetDetail.currentBookValue')}: <span className="font-semibold text-dark dark:text-slate-100">{formatCurrency(bookValue)}</span></p>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-1">{t('accounting.fixedAssetDetail.disposalDate')}</label>
          <input type="date" value={disposalDate} onChange={(e) => setDisposalDate(e.target.value)}
            className="w-full h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <Input label={t('accounting.fixedAssetDetail.saleOrScrapAmount')} type="number" value={disposalAmount} onChange={(e) => setDisposalAmount(e.target.value)} placeholder={t('accounting.fixedAssetDetail.saleOrScrapPlaceholder')} />
      </div>
    </Modal>
  )
}
