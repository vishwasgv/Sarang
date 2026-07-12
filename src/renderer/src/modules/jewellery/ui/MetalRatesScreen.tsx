import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Gem, Plus, Trash2, RefreshCw } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'

interface MetalRate {
  id: string
  metalType: string
  purity: string
  ratePerGram: number
  updatedAt: string
}

const METAL_TYPES = ['GOLD', 'SILVER', 'PLATINUM']

// Fresh-audit build (2026-07-12) — Jewellery vertical. Owner-updated —
// there is no automatic rate feed (this app has no internet dependency for
// core features, per its own standing "offline forever" rule). One row per
// metalType+purity since 22K and 18K gold trade at genuinely different
// per-gram rates. JEWELLERY defaults to languageLock:'multi' (a founder
// decision — full 12-language coverage), so this screen is i18n-wired from
// the start rather than following the (pre-existing, out-of-scope-to-fix-
// here) Products/Customers CRUD forms' plain-English convention.
export function MetalRatesScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canManage = hasPermission('jewellery.manageRates')

  const [rates, setRates] = useState<MetalRate[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formMetalType, setFormMetalType] = useState('GOLD')
  const [formPurity, setFormPurity] = useState('')
  const [formRate, setFormRate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<MetalRate | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.metalRate.list()
      if (res.success) setRates((res.data as MetalRate[]) ?? [])
      else toastError(t('common.error'), res.error?.message ?? t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { void load() }, [load])

  async function handleSave() {
    setError('')
    if (!formPurity.trim()) { setError(t('jewellery.purityRequired')); return }
    const rate = Number(formRate)
    if (!Number.isFinite(rate) || rate <= 0) { setError(t('jewellery.validRateRequired')); return }
    setSaving(true)
    try {
      const res = await window.api.metalRate.upsert({ metalType: formMetalType, purity: formPurity.trim(), ratePerGram: rate })
      if (res.success) {
        toastSuccess(t('jewellery.rateSaved'), t('jewellery.rateSavedDesc', { metalType: formMetalType, purity: formPurity, rate }))
        setShowForm(false)
        setFormPurity('')
        setFormRate('')
        await load()
      } else {
        setError(res.error?.message ?? t('common.error'))
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await window.api.metalRate.delete({ id: deleteTarget.id })
    setDeleting(false)
    if (res.success) { toastSuccess(t('jewellery.deleted'), t('jewellery.rateDeleted')); setDeleteTarget(null); await load() }
    else toastError(t('common.error'), res.error?.message ?? t('common.error'))
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark flex items-center gap-2"><Gem size={20} /> {t('jewellery.metalRates')}</h2>
          <p className="text-sm text-slate-400">{t('jewellery.metalRatesDesc')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:border-slate-300 transition-colors">
            <RefreshCw size={14} /> {t('jewellery.refresh')}
          </button>
          {canManage && (
            <Button size="sm" onClick={() => setShowForm((s) => !s)} icon={<Plus size={14} />}>{t('jewellery.setRate')}</Button>
          )}
        </div>
      </div>

      {showForm && canManage && (
        <Card padding="md" className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Select label={t('jewellery.metalType')} value={formMetalType} onChange={(e) => setFormMetalType(e.target.value)}>
              {METAL_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
            <Input label={`${t('jewellery.purity')} (${t('jewellery.purityPlaceholder')})`} value={formPurity} onChange={(e) => setFormPurity(e.target.value)} />
            <Input label={t('jewellery.ratePerGram')} type="number" step="0.01" min="0" value={formRate} onChange={(e) => setFormRate(e.target.value)} />
          </div>
          {error && <p className="text-xs text-danger bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowForm(false)}>{t('jewellery.cancel')}</Button>
            <Button size="sm" onClick={() => void handleSave()} loading={saving}>{t('jewellery.save')}</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">{t('jewellery.loading')}</div>
      ) : rates.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <Gem size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('jewellery.noRates')}</p>
          <p className="text-xs text-slate-400 mt-1">{t('jewellery.noRatesDesc')}</p>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-5 py-3 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase">
            <div className="col-span-3">{t('jewellery.metalType')}</div>
            <div className="col-span-3">{t('jewellery.purity')}</div>
            <div className="col-span-3 text-right">{t('jewellery.ratePerGram')}</div>
            <div className="col-span-2 text-right">{t('jewellery.updated')}</div>
            <div className="col-span-1"></div>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {rates.map((r) => (
              <div key={r.id} className="grid grid-cols-12 gap-4 px-5 py-3.5 items-center">
                <div className="col-span-3 text-sm font-medium text-dark dark:text-slate-100">{r.metalType}</div>
                <div className="col-span-3 text-sm text-slate-600 dark:text-slate-300">{r.purity}</div>
                <div className="col-span-3 text-right text-sm font-semibold text-dark dark:text-slate-100">{r.ratePerGram.toFixed(2)}</div>
                <div className="col-span-2 text-right text-xs text-slate-400">{new Date(r.updatedAt).toLocaleDateString()}</div>
                <div className="col-span-1 text-right">
                  {canManage && (
                    <button onClick={() => setDeleteTarget(r)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title={t('jewellery.deleted')}
        message={t('jewellery.confirmDeleteRate')}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}
