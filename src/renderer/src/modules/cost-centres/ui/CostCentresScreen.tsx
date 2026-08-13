import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Building2, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Badge } from '@shared/ui/atoms/Badge'
import { Modal } from '@shared/ui/molecules/Modal'
import { SkeletonTable } from '@shared/ui/Skeleton'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'

interface CostCentre { id: string; name: string; code: string | null; isActive: boolean }

// Phase 65 — Reporting Tags / Cost & Profit Centres. A flat list (not a
// hierarchy) — see schema.prisma's own CostCentre comment. Every install
// starts with zero cost centres; the picker on Invoice/Bill/Expense/Employee
// forms only appears once at least one exists, so this screen is the sole
// entry point that turns the whole feature on for a business.
export function CostCentresScreen() {
  const { t } = useTranslation()
  const { error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canManage = hasPermission('costCentres.manage')

  const [costCentres, setCostCentres] = useState<CostCentre[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editTarget, setEditTarget] = useState<CostCentre | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.costCentres.list()
      if (res.success && res.data) setCostCentres(res.data as CostCentre[])
      else toastError(t('common.error'), res.error?.message ?? t('costCentres.couldNotLoad'))
    } catch {
      toastError(t('common.error'), t('costCentres.couldNotLoad'))
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
              <Building2 size={18} className="text-brand" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('costCentres.title')}</h1>
              <p className="text-xs text-slate-400">{t('costCentres.subtitle', { count: costCentres.length })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            {canManage && (
              <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowCreate(true)}>{t('costCentres.newCostCentre')}</Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto dark:bg-slate-950">
        {loading && costCentres.length === 0 ? (
          <div className="p-6"><SkeletonTable rows={4} cols={4} /></div>
        ) : costCentres.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <Building2 size={40} className="text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{t('costCentres.empty.title')}</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm">{t('costCentres.empty.body')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                <th className="text-start px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('costCentres.name')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('costCentres.code')}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.status')}</th>
                <th className="text-end px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {costCentres.map((cc) => (
                <tr key={cc.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-3 font-semibold text-dark dark:text-slate-100">{cc.name}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{cc.code ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={cc.isActive ? 'success' : 'neutral'} size="sm">{cc.isActive ? t('common.active') : t('common.inactive')}</Badge>
                  </td>
                  <td className="px-6 py-3 text-end">
                    {canManage && (
                      <button onClick={() => setEditTarget(cc)} className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-brand transition-colors">{t('common.edit')}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <CostCentreFormModal onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load() }} />
      )}
      {editTarget && (
        <CostCentreFormModal costCentre={editTarget} onClose={() => setEditTarget(null)} onSaved={() => { setEditTarget(null); load() }} />
      )}
    </div>
  )
}

function CostCentreFormModal({ costCentre, onClose, onSaved }: { costCentre?: CostCentre; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [name, setName] = useState(costCentre?.name ?? '')
  const [code, setCode] = useState(costCentre?.code ?? '')
  const [isActive, setIsActive] = useState(costCentre?.isActive ?? true)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim()) { toastError(t('common.error'), t('costCentres.nameRequired')); return }
    setSaving(true)
    try {
      const res = costCentre
        ? await window.api.costCentres.update({ id: costCentre.id, name: name.trim(), code: code.trim() || undefined, isActive })
        : await window.api.costCentres.create({ name: name.trim(), code: code.trim() || undefined })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('costCentres.couldNotSave')); return }
      toastSuccess(t('common.saveChanges'), '')
      onSaved()
    } catch {
      toastError(t('common.error'), t('costCentres.couldNotSave'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={costCentre ? t('costCentres.editCostCentre') : t('costCentres.newCostCentre')}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>{t('common.cancel')}</Button>
          <Button size="sm" onClick={handleSave} loading={saving}>{t('common.saveChanges')}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label={`${t('costCentres.name')} *`} value={name} onChange={(e) => setName(e.target.value)} placeholder={t('costCentres.namePlaceholder')} />
        <Input label={t('costCentres.code')} value={code} onChange={(e) => setCode(e.target.value)} placeholder={t('costCentres.codePlaceholder')} />
        {costCentre && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand" />
            <span className="text-sm text-slate-700 dark:text-slate-200">{t('common.active')}</span>
          </label>
        )}
      </div>
    </Modal>
  )
}
