import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Tag, RefreshCw, Plus, Clock } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Badge } from '@shared/ui/atoms/Badge'
import { Modal } from '@shared/ui/molecules/Modal'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { SkeletonTable } from '@shared/ui/Skeleton'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { formatDate } from '@shared/utils/locale.util'

interface PriceMarkdown {
  id: string
  productId: string
  originalPrice: number
  markdownPrice: number
  startDate: string
  endDate: string
  status: 'ACTIVE' | 'REVERTED' | 'CANCELLED' | 'SKIPPED_MANUAL_OVERRIDE'
  revertedAt: string | null
  product: { id: string; productName: string; sku: string | null }
}
interface Product { id: string; productName: string; sku?: string | null; productType: string; sellingPrice: number }

// Phase 67 §9.1 — Retail: time-boxed markdown workflow. Mirrors
// PricingSchemesScreen.tsx's own established layout — create-only for rule
// details (cancel is the only post-creation action, same convention as
// PricingSchemes/ApprovalWorkflows), plain (non-search) product dropdown.
export function PriceMarkdownsScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canManage = hasPermission('priceMarkdowns.manage')

  const [markdowns, setMarkdowns] = useState<PriceMarkdown[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [checking, setChecking] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<PriceMarkdown | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const [formProductId, setFormProductId] = useState('')
  const [formMarkdownPrice, setFormMarkdownPrice] = useState('')
  const [formEndDate, setFormEndDate] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [mRes, pRes] = await Promise.all([
        window.api.priceMarkdowns.list(),
        window.api.products.list({ isActive: true, limit: 500 })
      ])
      if (mRes.success) setMarkdowns((mRes.data as PriceMarkdown[]) ?? [])
      else toastError(t('common.error'), mRes.error?.message ?? t('priceMarkdowns.couldNotLoad'))
      if (pRes.success) setProducts(((pRes.data as { products: Product[] }).products ?? []).filter(p => p.productType === 'STANDARD'))
    } catch {
      toastError(t('common.error'), t('priceMarkdowns.couldNotLoad'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setFormProductId('')
    setFormMarkdownPrice('')
    setFormEndDate('')
    setShowCreate(true)
  }

  async function handleSave() {
    if (!formProductId) { toastError(t('priceMarkdowns.missingFields'), t('priceMarkdowns.productRequired')); return }
    if (!formMarkdownPrice || Number(formMarkdownPrice) < 0) { toastError(t('priceMarkdowns.missingFields'), t('priceMarkdowns.markdownPriceRequired')); return }
    if (!formEndDate) { toastError(t('priceMarkdowns.missingFields'), t('priceMarkdowns.endDateRequired')); return }
    setSaving(true)
    try {
      const res = await window.api.priceMarkdowns.create({
        productId: formProductId,
        markdownPrice: Number(formMarkdownPrice),
        endDate: formEndDate
      })
      if (res.success) {
        toastSuccess(t('priceMarkdowns.markdownCreated'), '')
        setShowCreate(false)
        load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('priceMarkdowns.couldNotCreate'))
      }
    } catch {
      toastError(t('common.error'), t('priceMarkdowns.couldNotCreate'))
    } finally {
      setSaving(false)
    }
  }

  async function handleCancel() {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      const res = await window.api.priceMarkdowns.cancel(cancelTarget.id)
      if (res.success) {
        toastSuccess(t('priceMarkdowns.markdownCancelled'), '')
        setCancelTarget(null)
        load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('priceMarkdowns.couldNotCancel'))
      }
    } catch {
      toastError(t('common.error'), t('priceMarkdowns.couldNotCancel'))
    } finally {
      setCancelling(false)
    }
  }

  async function handleCheckNow() {
    setChecking(true)
    try {
      const res = await window.api.priceMarkdowns.evaluateNow()
      if (res.success) {
        const d = res.data as { evaluated: number; reverted: number; skippedManualOverride: number }
        toastSuccess(t('priceMarkdowns.checkComplete'), t('priceMarkdowns.checkCompleteDetail', { reverted: d.reverted, evaluated: d.evaluated }))
        load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('priceMarkdowns.couldNotCheck'))
      }
    } catch {
      toastError(t('common.error'), t('priceMarkdowns.couldNotCheck'))
    } finally {
      setChecking(false)
    }
  }

  function statusVariant(status: PriceMarkdown['status']): 'success' | 'neutral' | 'warning' | 'info' {
    if (status === 'ACTIVE') return 'success'
    if (status === 'REVERTED') return 'neutral'
    if (status === 'CANCELLED') return 'neutral'
    return 'warning'
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
              <Tag size={18} className="text-brand" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('priceMarkdowns.title')}</h1>
              <p className="text-xs text-slate-400">{t('priceMarkdowns.subtitle', { count: markdowns.length })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            {canManage && (
              <Button size="sm" variant="secondary" icon={<Clock size={14} />} onClick={handleCheckNow} loading={checking}>{t('priceMarkdowns.checkNow')}</Button>
            )}
            {canManage && (
              <Button size="sm" icon={<Plus size={14} />} onClick={openCreate}>{t('priceMarkdowns.newMarkdown')}</Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto dark:bg-slate-950">
        {loading && markdowns.length === 0 ? (
          <div className="p-6"><SkeletonTable rows={6} cols={6} /></div>
        ) : markdowns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
            <Tag size={40} className="opacity-30" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('priceMarkdowns.noMarkdownsYet')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                <th className="text-start px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('priceMarkdowns.product')}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('priceMarkdowns.originalPrice')}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('priceMarkdowns.markdownPrice')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('priceMarkdowns.endDate')}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.status')}</th>
                <th className="text-end px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {markdowns.map(m => (
                <tr key={m.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-3 font-semibold text-dark dark:text-slate-100">{m.product.productName}</td>
                  <td className="px-4 py-3 text-end text-slate-500 dark:text-slate-400">{formatCurrency(m.originalPrice)}</td>
                  <td className="px-4 py-3 text-end font-semibold text-danger">{formatCurrency(m.markdownPrice)}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-xs">{formatDate(m.endDate)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={statusVariant(m.status)} size="sm">{t(`priceMarkdowns.status.${m.status}`)}</Badge>
                  </td>
                  <td className="px-6 py-3 text-end">
                    {canManage && m.status === 'ACTIVE' && (
                      <button onClick={() => setCancelTarget(m)} className="text-xs font-semibold text-danger hover:text-danger/80 transition-colors">{t('common.cancel')}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreate && (
        <Modal open onClose={() => setShowCreate(false)} title={t('priceMarkdowns.newMarkdown')} size="md"
          footer={<>
            <Button variant="secondary" onClick={() => setShowCreate(false)} disabled={saving}>{t('common.cancel')}</Button>
            <Button onClick={handleSave} loading={saving}>{t('common.create')}</Button>
          </>}
        >
          <div className="space-y-4">
            <Select label={t('priceMarkdowns.product')} value={formProductId} onChange={e => setFormProductId(e.target.value)}>
              <option value="">{t('common.select')}</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.productName}{p.sku ? ` (${p.sku})` : ''} — {formatCurrency(p.sellingPrice)}</option>)}
            </Select>
            <Input label={t('priceMarkdowns.markdownPrice')} type="number" min="0" step="0.01" value={formMarkdownPrice} onChange={e => setFormMarkdownPrice(e.target.value)} />
            <Input label={t('priceMarkdowns.endDate')} type="date" value={formEndDate} onChange={e => setFormEndDate(e.target.value)} />
            <p className="text-xs text-slate-400">{t('priceMarkdowns.createHint')}</p>
          </div>
        </Modal>
      )}

      {cancelTarget && (
        <ConfirmDialog
          open
          title={t('priceMarkdowns.cancelMarkdownTitle')}
          message={t('priceMarkdowns.cancelMarkdownMessage')}
          confirmLabel={t('common.cancel')}
          loading={cancelling}
          onConfirm={handleCancel}
          onClose={() => setCancelTarget(null)}
        />
      )}
    </div>
  )
}
