import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Repeat, Plus, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Badge } from '@shared/ui/atoms/Badge'
import { CustomerPicker, type CustomerLite } from '@shared/ui/molecules/CustomerPicker'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { useAuthStore } from '@app/store/auth.store'
import { useBusinessStore } from '@app/store/business.store'
import { useNotificationStore } from '@app/store/notification.store'
import { formatCurrency } from '@shared/utils/currency.util'

interface FurnitureTradeIn {
  id: string
  tradeInNumber: string
  customerId: string | null
  customerName: string | null
  itemDescription: string
  condition: string | null
  tradeInValue: number
  invoiceId: string | null
  notes: string | null
  createdAt: string
  customer: { id: string; customerName: string; phone: string | null } | null
}

// Phase 69 — Furniture vertical. Mirrors MetalExchangeScreen.tsx's UI pattern
// exactly (jewellery.ts's exchange screen), swapping the metal-rate-derived
// value for a direct shop-assessed figure.
export function FurnitureTradeInScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const sym = useBusinessStore((s) => s.profile?.currencySymbol ?? '₹')
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canManage = hasPermission('furnitureTradeIn.manage')

  const [tradeIns, setTradeIns] = useState<FurnitureTradeIn[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [pickedCustomer, setPickedCustomer] = useState<CustomerLite | null>(null)
  const [walkInName, setWalkInName] = useState('')
  const [itemDescription, setItemDescription] = useState('')
  const [condition, setCondition] = useState('')
  const [tradeInValue, setTradeInValue] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [linkTarget, setLinkTarget] = useState<FurnitureTradeIn | null>(null)
  const [linkInvoiceNumber, setLinkInvoiceNumber] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<FurnitureTradeIn | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [linking, setLinking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.furnitureTradeIn.list()
      if (res.success) setTradeIns((res.data as FurnitureTradeIn[]) ?? [])
      else toastError(t('furniture.tradeIn.errorTitle'), res.error?.message ?? t('furniture.tradeIn.couldNotLoadTradeIns'))
    } catch {
      toastError(t('furniture.tradeIn.errorTitle'), t('furniture.tradeIn.couldNotLoadTradeIns'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { void load() }, [load])

  function resetForm() {
    setPickedCustomer(null)
    setWalkInName('')
    setItemDescription('')
    setCondition('')
    setTradeInValue('')
    setNotes('')
    setError('')
  }

  async function handleCreate() {
    setError('')
    if (!pickedCustomer && !walkInName.trim()) { setError(t('furniture.tradeIn.selectCustomerOrWalkInError')); return }
    if (!itemDescription.trim()) { setError(t('furniture.tradeIn.itemDescriptionRequiredError')); return }
    const value = Number(tradeInValue)
    if (!Number.isFinite(value) || value <= 0) { setError(t('furniture.tradeIn.invalidValueError')); return }
    setSaving(true)
    try {
      const res = await window.api.furnitureTradeIn.create({
        customerId: pickedCustomer?.id,
        customerName: pickedCustomer ? undefined : walkInName.trim(),
        itemDescription: itemDescription.trim(),
        condition: condition.trim() || undefined,
        tradeInValue: value,
        notes: notes.trim() || undefined,
      })
      if (res.success) {
        const data = res.data as FurnitureTradeIn
        toastSuccess(t('furniture.tradeIn.tradeInRecordedTitle'), t('furniture.tradeIn.tradeInRecordedMessage', { number: data.tradeInNumber, amount: formatCurrency(data.tradeInValue) }))
        setShowForm(false)
        resetForm()
        await load()
      } else {
        setError(res.error?.message ?? t('furniture.tradeIn.couldNotRecordTradeIn'))
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await window.api.furnitureTradeIn.delete({ id: deleteTarget.id })
      if (res.success) { toastSuccess(t('furniture.tradeIn.deletedTitle'), t('furniture.tradeIn.deletedMessage')); setDeleteTarget(null); await load() }
      else toastError(t('furniture.tradeIn.errorTitle'), res.error?.message ?? t('furniture.tradeIn.couldNotDeleteTradeIn'))
    } finally {
      setDeleting(false)
    }
  }

  async function handleLink() {
    if (!linkTarget || !linkInvoiceNumber.trim() || linking) return
    setLinking(true)
    try {
      const res = await window.api.furnitureTradeIn.linkToInvoice({ tradeInId: linkTarget.id, invoiceId: linkInvoiceNumber.trim() })
      if (res.success) {
        toastSuccess(t('furniture.tradeIn.linkedTitle'), t('furniture.tradeIn.linkedMessage'))
        setLinkTarget(null)
        setLinkInvoiceNumber('')
        await load()
      } else {
        toastError(t('furniture.tradeIn.errorTitle'), res.error?.message ?? t('furniture.tradeIn.couldNotLinkTradeIn'))
      }
    } finally {
      setLinking(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark flex items-center gap-2"><Repeat size={20} /> {t('furniture.tradeIn.title')}</h2>
          <p className="text-sm text-slate-400">{t('furniture.tradeIn.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:border-slate-300 transition-colors">
            <RefreshCw size={14} /> {t('common.refresh')}
          </button>
          {canManage && (
            <Button size="sm" onClick={() => setShowForm((s) => !s)} icon={<Plus size={14} />}>{t('furniture.tradeIn.recordTradeIn')}</Button>
          )}
        </div>
      </div>

      {showForm && canManage && (
        <Card padding="md" className="space-y-3">
          {pickedCustomer ? (
            <CustomerPicker value={pickedCustomer} onChange={setPickedCustomer} label={t('furniture.tradeIn.customerLabel')} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <CustomerPicker value={pickedCustomer} onChange={setPickedCustomer} label={t('furniture.tradeIn.customerOptionalLabel')} />
              <Input label={t('furniture.tradeIn.walkInNameLabel')} placeholder={t('furniture.tradeIn.walkInNamePlaceholder')} value={walkInName} onChange={(e) => setWalkInName(e.target.value)} disabled={!!pickedCustomer} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('furniture.tradeIn.itemDescriptionLabel')} placeholder={t('furniture.tradeIn.itemDescriptionPlaceholder')} value={itemDescription} onChange={(e) => setItemDescription(e.target.value)} />
            <Input label={t('furniture.tradeIn.conditionLabel')} placeholder={t('furniture.tradeIn.conditionPlaceholder')} value={condition} onChange={(e) => setCondition(e.target.value)} />
          </div>
          <Input label={t('furniture.tradeIn.tradeInValueLabel', { sym })} type="number" step="0.01" min="0" value={tradeInValue} onChange={(e) => setTradeInValue(e.target.value)} />
          <Input label={t('common.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
          {error && <p className="text-xs text-danger bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setShowForm(false); resetForm() }}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={() => void handleCreate()} loading={saving}>{t('furniture.tradeIn.record')}</Button>
          </div>
        </Card>
      )}

      {linkTarget && (
        <Card padding="md" className="space-y-3 border-brand/40">
          <p className="text-sm font-semibold text-dark">{t('furniture.tradeIn.markAppliedTitle', { number: linkTarget.tradeInNumber })}</p>
          <Input label={t('furniture.tradeIn.invoiceIdLabel')} placeholder={t('furniture.tradeIn.invoiceIdPlaceholder')} value={linkInvoiceNumber} onChange={(e) => setLinkInvoiceNumber(e.target.value)} />
          <p className="text-xs text-slate-400">{t('furniture.tradeIn.creditsAgainstInvoice', { amount: formatCurrency(linkTarget.tradeInValue) })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setLinkTarget(null)} disabled={linking}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={() => void handleLink()} loading={linking}>{t('furniture.tradeIn.link')}</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">{t('common.loading')}</div>
      ) : tradeIns.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <Repeat size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('furniture.tradeIn.emptyTitle')}</p>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {tradeIns.map((x) => (
              <div key={x.id} className="px-5 py-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm dark:text-slate-100">{x.tradeInNumber}</span>
                    {x.invoiceId ? (
                      <Badge variant="success" size="sm">{t('furniture.tradeIn.appliedTo', { invoiceId: x.invoiceId })}</Badge>
                    ) : (
                      <Badge variant="warning" size="sm">{t('furniture.tradeIn.notYetApplied')}</Badge>
                    )}
                  </div>
                  <div className="text-sm text-gray-800 mt-1 dark:text-slate-200">{x.customer?.customerName ?? x.customerName ?? t('furniture.tradeIn.walkIn')}</div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap dark:text-slate-400">
                    <span>{x.itemDescription}{x.condition ? ` — ${x.condition}` : ''}</span>
                    <span className="font-semibold text-dark dark:text-slate-100">{t('furniture.tradeIn.amountCredit', { amount: formatCurrency(x.tradeInValue) })}</span>
                    <span>{new Date(x.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!x.invoiceId && canManage && (
                    <button onClick={() => { setLinkTarget(x); setLinkInvoiceNumber('') }} className="text-xs px-3 py-1.5 rounded-lg bg-brand/5 text-brand border border-brand/20 hover:bg-brand/10 flex items-center gap-1 font-medium">
                      <CheckCircle2 size={12} /> {t('furniture.tradeIn.markApplied')}
                    </button>
                  )}
                  {!x.invoiceId && canManage && (
                    <button onClick={() => setDeleteTarget(x)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg dark:text-slate-500"><Trash2 size={14} /></button>
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
        title={t('furniture.tradeIn.deleteTitle')}
        message={t('furniture.tradeIn.deleteMessage')}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}
