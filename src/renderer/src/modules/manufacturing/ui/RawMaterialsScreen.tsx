import React, { useEffect, useState, useCallback } from 'react'
import { Plus, RefreshCw, FlaskConical, AlertTriangle, TrendingUp, TrendingDown, Minus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { api } from '@renderer/services/ipc-client'
import { useNotificationStore } from '@app/store/notification.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatNumber, formatDateTime } from '@shared/utils/locale.util'
import { Card } from '@shared/ui/molecules/Card'
import { Badge } from '@shared/ui/atoms/Badge'
import { Select } from '@shared/ui/atoms/Select'

interface RawMaterial {
  id: string
  name: string
  unit: string
  currentStock: number
  reorderLevel: number
  unitCost: number
  supplierId: string | null
  supplierName: string | null
  isLowStock: boolean
}

interface Movement {
  id: string
  type: string
  quantity: number
  balanceAfter: number
  reference: string | null
  unitCost: number
  notes: string | null
  createdAt: string
}

const UNITS = ['kg', 'g', 'litre', 'ml', 'piece', 'box', 'bag', 'metre', 'roll', 'ton']

// tKey only — covers every movement type this screen creates (PURCHASE/
// ADJUSTMENT/RETURN via adjustStock, plus CONSUMED from production usage).
// Badge coloring lives in TYPE_VARIANT below.
const TYPE_LABEL_KEY: Record<string, { tKey: string }> = {
  PURCHASE:   { tKey: 'manufacturing.movePurchase' },
  CONSUMED:   { tKey: 'manufacturing.moveConsumed' },
  ADJUSTMENT: { tKey: 'manufacturing.moveAdjustment' },
  RETURN:     { tKey: 'manufacturing.moveReturn' },
}

// The ?? 'neutral' fallback below is a safety net only, never the primary mapping.
const TYPE_VARIANT: Record<string, 'success' | 'danger' | 'warning' | 'info'> = {
  PURCHASE: 'success',
  CONSUMED: 'danger',
  ADJUSTMENT: 'warning',
  RETURN: 'info',
}

export function RawMaterialsScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [lowStockOnly, setLowStockOnly] = useState(false)

  // Add/Edit modal
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<RawMaterial | null>(null)
  const [form, setForm] = useState({ name: '', unit: 'kg', currentStock: '', reorderLevel: '', unitCost: '' })
  const [saving, setSaving] = useState(false)

  // Stock adjustment modal
  const [adjustTarget, setAdjustTarget] = useState<RawMaterial | null>(null)
  const [adjustForm, setAdjustForm] = useState({ type: 'PURCHASE', quantity: '', notes: '' })
  const [adjusting, setAdjusting] = useState(false)

  // Movement history modal
  const [movementTarget, setMovementTarget] = useState<RawMaterial | null>(null)
  const [movements, setMovements] = useState<Movement[]>([])
  const [movementsLoading, setMovementsLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.rawMaterials.list({ lowStock: lowStockOnly })
      if (res.success && res.data) {
        const d = res.data as { materials: RawMaterial[] }
        setMaterials(d.materials)
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [lowStockOnly, toastError, t])

  useEffect(() => { loadData() }, [loadData])

  function openAdd() {
    setEditTarget(null)
    setForm({ name: '', unit: 'kg', currentStock: '', reorderLevel: '', unitCost: '' })
    setShowForm(true)
  }

  function openEdit(m: RawMaterial) {
    setEditTarget(m)
    setForm({ name: m.name, unit: m.unit, currentStock: String(m.currentStock), reorderLevel: String(m.reorderLevel), unitCost: String(m.unitCost) })
    setShowForm(true)
  }

  async function handleSave() {
    if (!form.name.trim()) { toastError(t('common.nameRequired')); return }
    setSaving(true)
    let res
    if (editTarget) {
      res = await api.rawMaterials.update({
        id: editTarget.id,
        name: form.name.trim(),
        unit: form.unit,
        reorderLevel: parseFloat(form.reorderLevel) || 0,
        unitCost: parseFloat(form.unitCost) || 0
      })
    } else {
      res = await api.rawMaterials.create({
        name: form.name.trim(),
        unit: form.unit,
        currentStock: parseFloat(form.currentStock) || 0,
        reorderLevel: parseFloat(form.reorderLevel) || 0,
        unitCost: parseFloat(form.unitCost) || 0
      })
    }
    setSaving(false)
    if (res.success) {
      toastSuccess(editTarget ? t('manufacturing.materialUpdated') : t('manufacturing.materialAdded'))
      setShowForm(false)
      loadData()
    } else {
      toastError(res.error?.message ?? t('manufacturing.saveFailed'))
    }
  }

  async function handleDelete(m: RawMaterial) {
    if (!confirm(t('manufacturing.confirmRemoveMaterial', { name: m.name }))) return
    const res = await api.rawMaterials.delete({ id: m.id })
    if (res.success) {
      toastSuccess(t('common.removed'))
      loadData()
    } else {
      toastError(res.error?.message ?? t('manufacturing.actionFailed'))
    }
  }

  function openAdjust(m: RawMaterial) {
    setAdjustTarget(m)
    setAdjustForm({ type: 'PURCHASE', quantity: '', notes: '' })
  }

  async function handleAdjust() {
    if (!adjustTarget) return
    const qty = parseFloat(adjustForm.quantity)
    if (isNaN(qty) || qty <= 0) { toastError(t('common.enterValidQty')); return }
    setAdjusting(true)
    const res = await api.rawMaterials.adjustStock({
      id: adjustTarget.id,
      type: adjustForm.type as 'PURCHASE' | 'ADJUSTMENT' | 'RETURN',
      quantity: qty,
      notes: adjustForm.notes || undefined
    })
    setAdjusting(false)
    if (res.success) {
      toastSuccess(t('manufacturing.stockUpdated'))
      setAdjustTarget(null)
      loadData()
    } else {
      toastError(res.error?.message ?? t('manufacturing.stockUpdated'))
    }
  }

  async function openMovements(m: RawMaterial) {
    setMovementTarget(m)
    setMovementsLoading(true)
    const res = await api.rawMaterials.movements({ rawMaterialId: m.id, limit: 50 })
    if (res.success && res.data) setMovements(res.data as Movement[])
    setMovementsLoading(false)
  }

  const lowStockCount = materials.filter(m => m.isLowStock).length
  const totalStockValue = materials.reduce((sum, m) => sum + m.currentStock * m.unitCost, 0)

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <FlaskConical size={24} className="text-brand" />
              {t('manufacturing.rawMaterials')}
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">
              {materials.length > 0
                ? <>{materials.length} material{materials.length !== 1 ? 's' : ''} · Total value: <span className="font-semibold text-brand">{formatCurrency(totalStockValue)}</span></>
                : 'Track raw material inventory and stock levels'
              }
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lowStockCount > 0 && (
              <button
                onClick={() => setLowStockOnly(p => !p)}
                className={`flex items-center gap-2 px-4 h-11 rounded-lg text-sm font-medium border transition-colors ${lowStockOnly ? 'bg-danger text-white border-danger' : 'bg-danger/10 text-danger border-danger/30 hover:bg-danger/15'}`}
              >
                <AlertTriangle size={15} />
                {lowStockCount} {t('manufacturing.lowStockBadge')}
              </button>
            )}
            <button onClick={loadData} className="h-11 w-11 flex items-center justify-center rounded-lg border border-border text-text-secondary hover:bg-surface-hover transition-colors">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={openAdd} className="flex items-center gap-2 px-5 h-11 bg-brand text-white rounded-lg text-sm font-semibold hover:bg-brand-hover transition-colors">
              <Plus size={16} /> {t('manufacturing.addMaterial')}
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : materials.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-secondary">
            <FlaskConical size={40} className="mb-3 opacity-30" />
            <p className="text-base font-medium">{lowStockOnly ? t('manufacturing.noLowStockMaterials') : t('manufacturing.noMaterials')}</p>
            {!lowStockOnly && <p className="text-sm mt-1">{t('manufacturing.noMaterialsDesc')}</p>}
          </div>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-alt border-b border-border">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">{t('manufacturing.material')}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">{t('manufacturing.stockCol')}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">{t('manufacturing.reorderAt')}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">{t('manufacturing.unitCost')}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">{t('manufacturing.stockValue')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-text-secondary">{t('manufacturing.supplierCol')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {materials.map(m => (
                  <tr key={m.id} className="hover:bg-surface-hover/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {m.isLowStock && <AlertTriangle size={14} className="text-danger shrink-0" />}
                        <span className="font-medium text-text-primary">{m.name}</span>
                        <span className="text-xs text-text-secondary">({m.unit})</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${m.isLowStock ? 'text-danger' : 'text-text-primary'}`}>
                        {formatNumber(m.currentStock, { maximumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-text-secondary">{formatNumber(m.reorderLevel, { maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right text-text-secondary">
                      {m.unitCost > 0 ? formatCurrency(m.unitCost) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {m.unitCost > 0 && m.currentStock > 0
                        ? <span className="font-semibold text-text-primary">{formatCurrency(m.currentStock * m.unitCost)}</span>
                        : <span className="text-text-secondary">—</span>}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{m.supplierName ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openMovements(m)} className="px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:text-brand hover:bg-brand/5 transition-colors border border-border" title="Movement History">{t('manufacturing.movementHistory')}</button>
                        <button onClick={() => openAdjust(m)} className="px-3 py-1.5 rounded-lg text-xs text-brand hover:bg-brand/5 transition-colors border border-brand/30" title="Adjust Stock">{t('manufacturing.adjustStock')}</button>
                        <button onClick={() => openEdit(m)} className="px-3 py-1.5 rounded-lg text-xs text-text-secondary hover:text-brand hover:bg-brand/5 transition-colors border border-border">{t('common.edit')}</button>
                        <button onClick={() => handleDelete(m)} className="px-3 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-50 transition-colors border border-red-200">{t('inventory.remove')}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">{editTarget ? t('common.edit') + ' ' + t('manufacturing.rawMaterials') : t('manufacturing.addMaterial')}</h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">{t('common.name')} *</label>
                <input
                  autoFocus
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full h-12 px-4 rounded-xl border border-border bg-surface text-base focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="e.g. Wheat Flour"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Select
                    label={t('manufacturing.unit')}
                    value={form.unit}
                    onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </Select>
                </div>
                {!editTarget && (
                  <div>
                    <label className="block text-sm font-medium text-text-primary mb-1.5">{t('manufacturing.openingStock')}</label>
                    <input
                      type="number"
                      min="0"
                      value={form.currentStock}
                      onChange={e => setForm(p => ({ ...p, currentStock: e.target.value }))}
                      className="w-full h-12 px-4 rounded-xl border border-border bg-surface text-base focus:outline-none focus:ring-2 focus:ring-brand"
                      placeholder="0"
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">{t('manufacturing.reorderLevel')}</label>
                  <input
                    type="number"
                    min="0"
                    value={form.reorderLevel}
                    onChange={e => setForm(p => ({ ...p, reorderLevel: e.target.value }))}
                    className="w-full h-12 px-4 rounded-xl border border-border bg-surface text-base focus:outline-none focus:ring-2 focus:ring-brand"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1.5">{t('manufacturing.unitCost')}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.unitCost}
                    onChange={e => setForm(p => ({ ...p, unitCost: e.target.value }))}
                    className="w-full h-12 px-4 rounded-xl border border-border bg-surface text-base focus:outline-none focus:ring-2 focus:ring-brand"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowForm(false)} className="flex-1 h-12 rounded-xl border border-border text-text-secondary hover:bg-surface-hover font-medium text-base transition-colors">{t('common.cancel')}</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 h-12 rounded-xl bg-brand text-white font-semibold text-base hover:bg-brand-hover disabled:opacity-50 transition-colors">
                {saving ? t('cashClose.saving') : editTarget ? t('common.saveChanges') : t('manufacturing.addMaterial')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
              <h2 className="text-lg font-semibold text-text-primary">{t('manufacturing.adjustStock')}</h2>
              <button onClick={() => setAdjustTarget(null)} className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-text-secondary">{adjustTarget.name} — Current: <strong>{adjustTarget.currentStock} {adjustTarget.unit}</strong></p>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">{t('manufacturing.movementType')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: 'PURCHASE', icon: TrendingUp, label: 'Purchase' },
                    { type: 'RETURN', icon: Minus, label: 'Return' },
                    { type: 'ADJUSTMENT', icon: TrendingDown, label: 'Adjust To' },
                  ].map(opt => (
                    <button
                      key={opt.type}
                      onClick={() => setAdjustForm(p => ({ ...p, type: opt.type }))}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-xs font-medium transition-colors ${adjustForm.type === opt.type ? 'border-brand bg-brand/5 text-brand' : 'border-border text-text-secondary hover:border-brand/30'}`}
                    >
                      <opt.icon size={16} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">
                  {adjustForm.type === 'ADJUSTMENT' ? t('manufacturing.setStockTo') : t('manufacturing.quantity')}
                </label>
                <input
                  autoFocus
                  type="number"
                  min="0"
                  step="0.001"
                  value={adjustForm.quantity}
                  onChange={e => setAdjustForm(p => ({ ...p, quantity: e.target.value }))}
                  className="w-full h-12 px-4 rounded-xl border border-border bg-surface text-base focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="Enter quantity"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">{t('common.notes')} ({t('common.optional')})</label>
                <input
                  value={adjustForm.notes}
                  onChange={e => setAdjustForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full h-12 px-4 rounded-xl border border-border bg-surface text-base focus:outline-none focus:ring-2 focus:ring-brand"
                  placeholder="e.g. New delivery from supplier"
                />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setAdjustTarget(null)} className="flex-1 h-12 rounded-xl border border-border text-text-secondary hover:bg-surface-hover font-medium text-base transition-colors">{t('common.cancel')}</button>
              <button onClick={handleAdjust} disabled={adjusting} className="flex-1 h-12 rounded-xl bg-brand text-white font-semibold text-base hover:bg-brand-hover disabled:opacity-50 transition-colors">
                {adjusting ? t('cashClose.saving') : t('manufacturing.updateStock')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Movement History Modal */}
      {movementTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{t('manufacturing.movementHistory')}</h2>
                <p className="text-sm text-text-secondary">{movementTarget.name}</p>
              </div>
              <button onClick={() => setMovementTarget(null)} className="p-2 rounded-lg hover:bg-surface-hover text-text-secondary"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {movementsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                </div>
              ) : movements.length === 0 ? (
                <p className="text-center text-text-secondary py-10">{t('manufacturing.noMovementsYet')}</p>
              ) : (
                <div className="space-y-2">
                  {movements.map(mv => {
                    const info = TYPE_LABEL_KEY[mv.type] ?? { tKey: mv.type }
                    return (
                      <div key={mv.id} className="flex items-center justify-between p-3 rounded-xl bg-surface border border-border">
                        <div>
                          <Badge variant={TYPE_VARIANT[mv.type] ?? 'neutral'} size="sm">{t(info.tKey)}</Badge>
                          {mv.reference && <span className="text-xs text-text-secondary ml-2">{t('common.ref')}: {mv.reference}</span>}
                          {mv.notes && <p className="text-xs text-text-secondary mt-0.5">{mv.notes}</p>}
                          <p className="text-xs text-text-secondary mt-0.5">{formatDateTime(mv.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-text-primary">{formatNumber(mv.quantity, { maximumFractionDigits: 3 })} {movementTarget.unit}</p>
                          <p className="text-xs text-text-secondary">{t('manufacturing.balanceAfter')}: {formatNumber(mv.balanceAfter, { maximumFractionDigits: 3 })}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
