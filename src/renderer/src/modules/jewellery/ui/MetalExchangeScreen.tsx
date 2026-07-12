import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Repeat, Plus, RefreshCw, Trash2, CheckCircle2 } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Badge } from '@shared/ui/atoms/Badge'
import { CustomerPicker, type CustomerLite } from '@shared/ui/molecules/CustomerPicker'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { useAuthStore } from '@app/store/auth.store'
import { useBusinessStore } from '@app/store/business.store'
import { useNotificationStore } from '@app/store/notification.store'

interface MetalExchange {
  id: string
  exchangeNumber: string
  customerId: string | null
  customerName: string | null
  metalType: string
  purity: string
  grossWeight: number
  deductionWeight: number
  netWeight: number
  ratePerGram: number
  valueGiven: number
  invoiceId: string | null
  notes: string | null
  createdAt: string
  customer: { id: string; customerName: string; phone: string | null } | null
}

const METAL_TYPES = ['GOLD', 'SILVER', 'PLATINUM']

// Fresh-audit build (2026-07-12) — Jewellery vertical, old-metal exchange
// (buyback/trade-in). Deliberately standalone record-keeping, not wired
// into billing.service.ts's invoice creation — see MetalExchange's own
// schema comment for why. Staff apply the computed valueGiven as an
// ordinary invoice-level discount on the customer's purchase, then mark
// this record linked via "Mark Applied to Sale". i18n-wired from the start
// (JEWELLERY defaults to languageLock:'multi', a founder decision).
export function MetalExchangeScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const sym = useBusinessStore((s) => s.profile?.currencySymbol ?? '₹')
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canManage = hasPermission('jewellery.manageExchanges')

  const [exchanges, setExchanges] = useState<MetalExchange[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [pickedCustomer, setPickedCustomer] = useState<CustomerLite | null>(null)
  const [walkInName, setWalkInName] = useState('')
  const [metalType, setMetalType] = useState('GOLD')
  const [purity, setPurity] = useState('')
  const [grossWeight, setGrossWeight] = useState('')
  const [deductionWeight, setDeductionWeight] = useState('0')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [linkTarget, setLinkTarget] = useState<MetalExchange | null>(null)
  const [linkInvoiceNumber, setLinkInvoiceNumber] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<MetalExchange | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.metalExchange.list()
      if (res.success) setExchanges((res.data as MetalExchange[]) ?? [])
      else toastError(t('common.error'), res.error?.message ?? t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { void load() }, [load])

  function resetForm() {
    setPickedCustomer(null)
    setWalkInName('')
    setPurity('')
    setGrossWeight('')
    setDeductionWeight('0')
    setNotes('')
    setError('')
  }

  async function handleCreate() {
    setError('')
    if (!pickedCustomer && !walkInName.trim()) { setError(t('jewellery.selectCustomerOrWalkIn')); return }
    if (!purity.trim()) { setError(t('jewellery.purityRequired')); return }
    const gross = Number(grossWeight)
    if (!Number.isFinite(gross) || gross <= 0) { setError(t('jewellery.validWeightRequired')); return }
    const deduction = Number(deductionWeight) || 0
    setSaving(true)
    try {
      const res = await window.api.metalExchange.create({
        customerId: pickedCustomer?.id,
        customerName: pickedCustomer ? undefined : walkInName.trim(),
        metalType, purity: purity.trim(), grossWeight: gross, deductionWeight: deduction,
        notes: notes.trim() || undefined,
      })
      if (res.success) {
        const data = res.data as MetalExchange
        toastSuccess(t('jewellery.exchangeRecorded'), t('jewellery.exchangeRecordedDesc', { number: data.exchangeNumber, amount: `${sym}${data.valueGiven.toFixed(2)}` }))
        setShowForm(false)
        resetForm()
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
    const res = await window.api.metalExchange.delete({ id: deleteTarget.id })
    setDeleting(false)
    if (res.success) { toastSuccess(t('jewellery.deleted'), t('jewellery.rateDeleted')); setDeleteTarget(null); await load() }
    else toastError(t('common.error'), res.error?.message ?? t('common.error'))
  }

  async function handleLink() {
    if (!linkTarget || !linkInvoiceNumber.trim()) return
    const res = await window.api.metalExchange.linkToInvoice({ exchangeId: linkTarget.id, invoiceId: linkInvoiceNumber.trim() })
    if (res.success) {
      toastSuccess(t('jewellery.linked'), t('jewellery.linkedDesc'))
      setLinkTarget(null)
      setLinkInvoiceNumber('')
      await load()
    } else {
      toastError(t('common.error'), res.error?.message ?? t('common.error'))
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark flex items-center gap-2"><Repeat size={20} /> {t('jewellery.exchanges')}</h2>
          <p className="text-sm text-slate-400">{t('jewellery.exchangesDesc')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:border-slate-300 transition-colors">
            <RefreshCw size={14} /> {t('jewellery.refresh')}
          </button>
          {canManage && (
            <Button size="sm" onClick={() => setShowForm((s) => !s)} icon={<Plus size={14} />}>{t('jewellery.recordExchange')}</Button>
          )}
        </div>
      </div>

      {showForm && canManage && (
        <Card padding="md" className="space-y-3">
          {pickedCustomer ? (
            <CustomerPicker value={pickedCustomer} onChange={setPickedCustomer} label={t('jewellery.customer')} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <CustomerPicker value={pickedCustomer} onChange={setPickedCustomer} label={t('jewellery.customerOptional')} />
              <Input label={t('jewellery.walkInName')} placeholder={t('billing.walkIn')} value={walkInName} onChange={(e) => setWalkInName(e.target.value)} disabled={!!pickedCustomer} />
            </div>
          )}
          <div className="grid grid-cols-4 gap-3">
            <Select label={t('jewellery.metalType')} value={metalType} onChange={(e) => setMetalType(e.target.value)}>
              {METAL_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
            <Input label={`${t('jewellery.purity')} (${t('jewellery.purityPlaceholder')})`} value={purity} onChange={(e) => setPurity(e.target.value)} />
            <Input label={t('jewellery.grossWeight')} type="number" step="0.001" min="0" value={grossWeight} onChange={(e) => setGrossWeight(e.target.value)} />
            <Input label={t('jewellery.deductionWeight')} type="number" step="0.001" min="0" value={deductionWeight} onChange={(e) => setDeductionWeight(e.target.value)} />
          </div>
          <Input label={t('jewellery.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
          {error && <p className="text-xs text-danger bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setShowForm(false); resetForm() }}>{t('jewellery.cancel')}</Button>
            <Button size="sm" onClick={() => void handleCreate()} loading={saving}>{t('jewellery.computeAndRecord')}</Button>
          </div>
        </Card>
      )}

      {linkTarget && (
        <Card padding="md" className="space-y-3 border-brand/40">
          <p className="text-sm font-semibold text-dark">{t('jewellery.markAppliedTitle', { number: linkTarget.exchangeNumber })}</p>
          <Input label={t('jewellery.invoiceNumber')} placeholder={t('jewellery.invoiceNumberPlaceholder')} value={linkInvoiceNumber} onChange={(e) => setLinkInvoiceNumber(e.target.value)} />
          <p className="text-xs text-slate-400">{t('jewellery.linkHint', { amount: `${sym}${linkTarget.valueGiven.toFixed(2)}` })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setLinkTarget(null)}>{t('jewellery.cancel')}</Button>
            <Button size="sm" onClick={() => void handleLink()}>{t('jewellery.link')}</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">{t('jewellery.loading')}</div>
      ) : exchanges.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <Repeat size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('jewellery.noExchanges')}</p>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {exchanges.map((x) => (
              <div key={x.id} className="px-5 py-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm dark:text-slate-100">{x.exchangeNumber}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400">{x.metalType} {x.purity}</span>
                    {x.invoiceId ? (
                      <Badge variant="success" size="sm">{t('jewellery.appliedTo', { invoiceId: x.invoiceId })}</Badge>
                    ) : (
                      <Badge variant="warning" size="sm">{t('jewellery.notYetApplied')}</Badge>
                    )}
                  </div>
                  <div className="text-sm text-gray-800 mt-1 dark:text-slate-200">{x.customer?.customerName ?? x.customerName ?? t('billing.walkIn')}</div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap dark:text-slate-400">
                    <span>{t('jewellery.netWeightRate', { weight: x.netWeight.toFixed(3), rate: `${sym}${x.ratePerGram}` })}</span>
                    <span className="font-semibold text-dark dark:text-slate-100">{sym}{x.valueGiven.toFixed(2)} {t('jewellery.credit')}</span>
                    <span>{new Date(x.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {!x.invoiceId && canManage && (
                    <button onClick={() => { setLinkTarget(x); setLinkInvoiceNumber('') }} className="text-xs px-3 py-1.5 rounded-lg bg-brand/5 text-brand border border-brand/20 hover:bg-brand/10 flex items-center gap-1 font-medium">
                      <CheckCircle2 size={12} /> {t('jewellery.markApplied')}
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
        title={t('jewellery.deleted')}
        message={t('jewellery.confirmDeleteExchange')}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}
