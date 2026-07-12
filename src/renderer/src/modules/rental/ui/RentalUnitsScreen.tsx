import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X, Trash2 } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'
import { Select } from '@shared/ui/atoms/Select'
import { Input } from '@shared/ui/atoms/Input'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'

interface RentalUnit {
  id: string
  productId: string
  productName: string
  unitLabel: string
  status: 'AVAILABLE' | 'RENTED' | 'MAINTENANCE' | 'RETIRED'
  conditionNotes: string | null
}

interface RentalProduct { id: string; productName: string; isRentable: boolean; rentalTrackingType: string | null }

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: 'bg-success/10 text-success',
  RENTED: 'bg-brand/10 text-brand',
  MAINTENANCE: 'bg-warning/10 text-warning',
  RETIRED: 'bg-slate-200 text-slate-500',
}

export function RentalUnitsScreen() {
  const { t } = useTranslation()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const { error: toastError } = useNotificationStore()
  const canManage = hasPermission('rental.manage')

  const [units, setUnits] = useState<RentalUnit[]>([])
  const [products, setProducts] = useState<RentalProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [productId, setProductId] = useState('')
  const [unitLabel, setUnitLabel] = useState('')
  const [conditionNotes, setConditionNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RentalUnit | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [unitsRes, productsRes] = await Promise.all([
        api.rental.listUnits(),
        api.products.list({ limit: 200 }),
      ])
      if (unitsRes.success && unitsRes.data) setUnits((unitsRes.data as { units: RentalUnit[] }).units)
      else toastError(t('common.error'), unitsRes.error?.message ?? t('common.error'))
      if (productsRes.success) {
        const d = productsRes.data as { products?: RentalProduct[] } | RentalProduct[]
        const arr = Array.isArray(d) ? d : d.products ?? []
        setProducts(arr.filter((p) => p.isRentable && p.rentalTrackingType === 'UNIT'))
      } else {
        toastError(t('common.error'), productsRes.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    if (!productId || !unitLabel.trim()) { setError(t('rental.fillAllFields') as string); return }
    setSaving(true)
    setError(null)
    const res = await api.rental.createUnit({ productId, unitLabel: unitLabel.trim(), conditionNotes: conditionNotes.trim() || undefined })
    setSaving(false)
    if (res.success) {
      setShowAdd(false); setProductId(''); setUnitLabel(''); setConditionNotes('')
      await load()
    } else {
      setError(res.error?.message ?? t('rental.saveFailed') as string)
    }
  }

  async function handleStatusChange(unit: RentalUnit, status: string) {
    try {
      const res = await api.rental.updateUnit({ id: unit.id, status })
      if (res.success) await load()
      else toastError(t('common.error'), res.error?.message ?? t('rental.saveFailed') as string)
    } catch {
      toastError(t('common.error'), t('rental.saveFailed') as string)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const res = await api.rental.deleteUnit({ id: deleteTarget.id })
    setDeleting(false)
    if (res.success) { setDeleteTarget(null); await load() }
    else toastError(t('common.error'), res.error?.message ?? t('rental.deleteFailed') as string)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark dark:text-slate-100">{t('rental.units')}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{t('rental.unitsDesc')}</p>
        </div>
        {canManage && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus size={16} className="mr-1.5" /> {t('rental.addUnit')}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><div className="w-7 h-7 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div>
      ) : units.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400">{t('rental.noUnits')}</p>
        </div>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">{t('rental.col.item')}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">{t('rental.unitLabel')}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300">{t('common.status')}</th>
                <th className="text-left px-4 py-3 font-medium text-slate-600 dark:text-slate-300"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {units.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="px-4 py-3 font-medium text-dark dark:text-slate-100">{u.productName}</td>
                  <td className="px-4 py-3">{u.unitLabel}</td>
                  <td className="px-4 py-3">
                    {canManage && u.status !== 'RENTED' ? (
                      <select value={u.status} onChange={(e) => handleStatusChange(u, e.target.value)}
                        className={`text-xs font-semibold rounded-full px-2.5 py-0.5 border-0 ${STATUS_COLORS[u.status]}`}>
                        <option value="AVAILABLE">{t('rental.status.AVAILABLE')}</option>
                        <option value="MAINTENANCE">{t('rental.status.MAINTENANCE')}</option>
                        <option value="RETIRED">{t('rental.status.RETIRED')}</option>
                      </select>
                    ) : (
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[u.status]}`}>{t(`rental.status.${u.status}`)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canManage && u.status !== 'RENTED' && (
                      <button onClick={() => setDeleteTarget(u)} className="text-slate-300 hover:text-danger"><Trash2 size={14} /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <p className="font-semibold text-dark dark:text-slate-100">{t('rental.addUnit')}</p>
              <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-dark dark:hover:text-slate-100"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              {error && <div className="bg-danger/10 text-danger text-sm rounded-lg px-3 py-2">{error}</div>}
              <Select label={t('rental.item') as string} value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">{t('common.select')}</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.productName}</option>)}
              </Select>
              <Input label={t('rental.unitLabel') as string} placeholder="e.g. KA01AB1234" value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} />
              <Input label={t('rental.conditionNotes') as string} value={conditionNotes} onChange={(e) => setConditionNotes(e.target.value)} />
              <Button onClick={handleAdd} disabled={saving} className="w-full">{saving ? '…' : t('common.save')}</Button>
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
        message={t('rental.confirmDeleteUnit')}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}
