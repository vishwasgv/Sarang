import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Gift, RefreshCw, Plus, Trash2 } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Badge } from '@shared/ui/atoms/Badge'
import { Modal } from '@shared/ui/molecules/Modal'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { SkeletonTable } from '@shared/ui/Skeleton'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'

interface SlabBreakpoint { minQty: number; discountPercent: number }
interface PricingScheme {
  id: string
  name: string
  ruleType: 'BUY_X_GET_Y_FREE' | 'SLAB_DISCOUNT'
  isActive: boolean
  buyQuantity: number | null
  freeQuantity: number | null
  slabBreakpoints: string
  startDate: string | null
  endDate: string | null
  product: { id: string; productName: string } | null
  category: { id: string; name: string } | null
}
interface Product { id: string; productName: string; sku?: string | null; productType: string }
interface Category { id: string; name: string }

const RULE_TYPES = ['BUY_X_GET_Y_FREE', 'SLAB_DISCOUNT'] as const

// Phase 63 — the scheme engine's config side (BillingScreen.tsx's cart
// consumes these via pricingSchemes.evaluateCart). Create-only for rule
// details, matching PriceLists'/ApprovalWorkflows' own established
// convention — update() only ever touches name/isActive/endDate.
export function PricingSchemesScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canManage = hasPermission('pricingSchemes.manage')

  const [schemes, setSchemes] = useState<PricingScheme[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<PricingScheme | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [formName, setFormName] = useState('')
  const [formRuleType, setFormRuleType] = useState<typeof RULE_TYPES[number]>('BUY_X_GET_Y_FREE')
  const [formScopeType, setFormScopeType] = useState<'PRODUCT' | 'CATEGORY'>('PRODUCT')
  const [formScopeId, setFormScopeId] = useState('')
  const [formBuyQuantity, setFormBuyQuantity] = useState('1')
  const [formFreeQuantity, setFormFreeQuantity] = useState('1')
  const [formSlabs, setFormSlabs] = useState<SlabBreakpoint[]>([{ minQty: 1, discountPercent: 0 }])
  const [formStartDate, setFormStartDate] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, pRes, cRes] = await Promise.all([
        window.api.pricingSchemes.list(),
        window.api.products.list({ isActive: true, limit: 500 }),
        window.api.categories.list()
      ])
      if (sRes.success) setSchemes((sRes.data as PricingScheme[]) ?? [])
      else toastError(t('common.error'), sRes.error?.message ?? t('pricingSchemes.couldNotLoad'))
      if (pRes.success) setProducts(((pRes.data as { products: Product[] }).products ?? []).filter(p => p.productType === 'STANDARD'))
      if (cRes.success) setCategories((cRes.data as Category[]) ?? [])
    } catch {
      toastError(t('common.error'), t('pricingSchemes.couldNotLoad'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setFormName('')
    setFormRuleType('BUY_X_GET_Y_FREE')
    setFormScopeType('PRODUCT')
    setFormScopeId('')
    setFormBuyQuantity('1')
    setFormFreeQuantity('1')
    setFormSlabs([{ minQty: 1, discountPercent: 0 }])
    setFormStartDate('')
    setFormEndDate('')
    setShowCreate(true)
  }

  function updateSlab(index: number, patch: Partial<SlabBreakpoint>) {
    setFormSlabs(slabs => slabs.map((s, i) => i === index ? { ...s, ...patch } : s))
  }
  function addSlab() {
    setFormSlabs(slabs => [...slabs, { minQty: 1, discountPercent: 0 }])
  }
  function removeSlab(index: number) {
    setFormSlabs(slabs => slabs.length > 1 ? slabs.filter((_, i) => i !== index) : slabs)
  }

  async function handleSave() {
    if (!formName.trim()) { toastError(t('pricingSchemes.missingFields'), t('pricingSchemes.nameRequired')); return }
    if (!formScopeId) { toastError(t('pricingSchemes.missingFields'), t('pricingSchemes.scopeRequired')); return }
    setSaving(true)
    try {
      const res = await window.api.pricingSchemes.create({
        name: formName.trim(),
        ruleType: formRuleType,
        productId: formScopeType === 'PRODUCT' ? formScopeId : undefined,
        categoryId: formScopeType === 'CATEGORY' ? formScopeId : undefined,
        buyQuantity: formRuleType === 'BUY_X_GET_Y_FREE' ? Number(formBuyQuantity) || 1 : undefined,
        freeQuantity: formRuleType === 'BUY_X_GET_Y_FREE' ? Number(formFreeQuantity) || 1 : undefined,
        slabBreakpoints: formRuleType === 'SLAB_DISCOUNT' ? formSlabs.map(s => ({ minQty: Number(s.minQty) || 1, discountPercent: Number(s.discountPercent) || 0 })) : undefined,
        startDate: formStartDate || undefined,
        endDate: formEndDate || undefined
      })
      if (res.success) {
        toastSuccess(t('pricingSchemes.schemeCreated'), formName.trim())
        setShowCreate(false)
        load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('pricingSchemes.couldNotCreate'))
      }
    } catch {
      toastError(t('common.error'), t('pricingSchemes.couldNotCreate'))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(scheme: PricingScheme) {
    try {
      const res = await window.api.pricingSchemes.update({ id: scheme.id, isActive: !scheme.isActive })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('pricingSchemes.couldNotSave')); return }
      load()
    } catch {
      toastError(t('common.error'), t('pricingSchemes.couldNotSave'))
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await window.api.pricingSchemes.delete(deleteTarget.id)
      if (res.success) {
        toastSuccess(t('pricingSchemes.schemeDeleted'), '')
        setDeleteTarget(null)
        load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('pricingSchemes.couldNotDelete'))
      }
    } catch {
      toastError(t('common.error'), t('pricingSchemes.couldNotDelete'))
    } finally {
      setDeleting(false)
    }
  }

  function scopeLabel(scheme: PricingScheme) {
    return scheme.product?.productName ?? scheme.category?.name ?? t('pricingSchemes.unscoped')
  }

  function ruleSummary(scheme: PricingScheme) {
    if (scheme.ruleType === 'BUY_X_GET_Y_FREE') {
      return t('pricingSchemes.buyXGetYSummary', { buy: scheme.buyQuantity, free: scheme.freeQuantity })
    }
    let slabs: SlabBreakpoint[] = []
    try { slabs = JSON.parse(scheme.slabBreakpoints) } catch { slabs = [] }
    return slabs.map(s => `${s.minQty}+ → ${s.discountPercent}%`).join(', ')
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
              <Gift size={18} className="text-brand" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('pricingSchemes.title')}</h1>
              <p className="text-xs text-slate-400">{t('pricingSchemes.subtitle', { count: schemes.length })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            {canManage && (
              <Button size="sm" icon={<Plus size={14} />} onClick={openCreate}>{t('pricingSchemes.newScheme')}</Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto dark:bg-slate-950">
        {loading && schemes.length === 0 ? (
          <div className="p-6"><SkeletonTable rows={6} cols={5} /></div>
        ) : schemes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
            <Gift size={40} className="opacity-30" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('pricingSchemes.noSchemesYet')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                <th className="text-start px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.name')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('pricingSchemes.scope')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('pricingSchemes.rule')}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.status')}</th>
                <th className="text-end px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {schemes.map(scheme => (
                <tr key={scheme.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-3 font-semibold text-dark dark:text-slate-100">{scheme.name}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{scopeLabel(scheme)}</td>
                  <td className="px-4 py-3 text-xs">
                    <Badge variant={scheme.ruleType === 'BUY_X_GET_Y_FREE' ? 'success' : 'info'} size="sm">{t(`pricingSchemes.ruleType.${scheme.ruleType}`)}</Badge>
                    <span className="ms-2 text-slate-500 dark:text-slate-400">{ruleSummary(scheme)}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={scheme.isActive ? 'success' : 'neutral'} size="sm">{scheme.isActive ? t('common.active') : t('common.inactive')}</Badge>
                  </td>
                  <td className="px-6 py-3 text-end">
                    {canManage && (
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => toggleActive(scheme)} className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-brand transition-colors">
                          {scheme.isActive ? t('approvalWorkflows.deactivate') : t('approvalWorkflows.activate')}
                        </button>
                        <button onClick={() => setDeleteTarget(scheme)} className="text-xs font-semibold text-danger hover:text-danger/80 transition-colors">{t('common.delete')}</button>
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
        <Modal open onClose={() => setShowCreate(false)} title={t('pricingSchemes.newScheme')} size="lg"
          footer={<>
            <Button variant="secondary" onClick={() => setShowCreate(false)} disabled={saving}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('common.create')}</Button>
          </>}
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label={t('common.name')} value={formName} onChange={e => setFormName(e.target.value)} placeholder={t('pricingSchemes.namePlaceholder')} />
              <Select label={t('pricingSchemes.ruleTypeLabel')} value={formRuleType} onChange={e => setFormRuleType(e.target.value as typeof formRuleType)}>
                {RULE_TYPES.map(rt => <option key={rt} value={rt}>{t(`pricingSchemes.ruleType.${rt}`)}</option>)}
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select label={t('pricingSchemes.scopeType')} value={formScopeType} onChange={e => { setFormScopeType(e.target.value as typeof formScopeType); setFormScopeId('') }}>
                <option value="PRODUCT">{t('pricingSchemes.byProduct')}</option>
                <option value="CATEGORY">{t('pricingSchemes.byCategory')}</option>
              </Select>
              <Select label={t('pricingSchemes.scope')} value={formScopeId} onChange={e => setFormScopeId(e.target.value)}>
                <option value="">{t('common.select')}</option>
                {formScopeType === 'PRODUCT'
                  ? products.map(p => <option key={p.id} value={p.id}>{p.productName}{p.sku ? ` (${p.sku})` : ''}</option>)
                  : categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>

            {formRuleType === 'BUY_X_GET_Y_FREE' ? (
              <div className="grid grid-cols-2 gap-4">
                <Input label={t('pricingSchemes.buyQuantity')} type="number" min="1" value={formBuyQuantity} onChange={e => setFormBuyQuantity(e.target.value)} />
                <Input label={t('pricingSchemes.freeQuantity')} type="number" min="1" value={formFreeQuantity} onChange={e => setFormFreeQuantity(e.target.value)} />
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">{t('pricingSchemes.slabBreakpoints')}</p>
                  <button type="button" onClick={addSlab} className="flex items-center gap-1 text-xs font-medium text-brand hover:text-brand/80 transition-colors">
                    <Plus size={12} /> {t('pricingSchemes.addSlab')}
                  </button>
                </div>
                <div className="space-y-2">
                  {formSlabs.map((slab, index) => (
                    <div key={index} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                      <input type="number" min="1" placeholder={t('pricingSchemes.minQuantity')} value={slab.minQty}
                        onChange={e => updateSlab(index, { minQty: Number(e.target.value) || 1 })}
                        className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900" />
                      <input type="number" min="0" max="100" step="0.5" placeholder={t('pricingSchemes.discountPercent')} value={slab.discountPercent}
                        onChange={e => updateSlab(index, { discountPercent: Number(e.target.value) || 0 })}
                        className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900" />
                      <button type="button" onClick={() => removeSlab(index)} disabled={formSlabs.length === 1}
                        className="p-1.5 rounded text-slate-400 hover:text-danger hover:bg-danger/10 disabled:opacity-30 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input label={t('pricingSchemes.startDateOptional')} type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} />
              <Input label={t('pricingSchemes.endDateOptional')} type="date" value={formEndDate} onChange={e => setFormEndDate(e.target.value)} />
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <ConfirmDialog
          open
          title={t('pricingSchemes.deleteSchemeTitle')}
          message={t('pricingSchemes.deleteSchemeMessage')}
          confirmLabel={t('common.delete')}
          loading={deleting}
          onConfirm={handleDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
