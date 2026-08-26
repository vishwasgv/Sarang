import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { PiggyBank, Plus, RefreshCw, Wallet, Gift } from 'lucide-react'
import { Card } from '@shared/ui/molecules/Card'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { Badge } from '@shared/ui/atoms/Badge'
import { CustomerPicker, type CustomerLite } from '@shared/ui/molecules/CustomerPicker'
import { useAuthStore } from '@app/store/auth.store'
import { useBusinessStore } from '@app/store/business.store'
import { useNotificationStore } from '@app/store/notification.store'

interface GoldSavingsInstallment { id: string; amount: number; paymentMethod: string | null; paidAt: string }
interface GoldSavingsScheme {
  id: string; schemeNumber: string; customerId: string
  metalType: string; monthlyAmount: number; tenureMonths: number; startDate: string
  status: 'ACTIVE' | 'REDEEMED' | 'CLOSED'
  totalDeposited: number; bonusAmount: number; redeemedAmount: number | null; redeemedAt: string | null
  invoiceId: string | null
  customer: { id: string; customerName: string; phone: string | null }
  installments: GoldSavingsInstallment[]
}

const METAL_TYPES = ['GOLD', 'SILVER', 'PLATINUM']

// Phase 67 §9.1 — Jewellery item 1: Gold savings (chit) scheme ledger, "the
// single most-requested feature in Indian jewellery retail" per the source
// audit. Deliberately standalone record-keeping, same design as
// MetalExchangeScreen — see gold-savings.service.ts's own header comment
// for why redemption isn't wired atomically into billing.service.ts.
export function GoldSavingsScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const hasPermission = useAuthStore((s) => s.hasPermission)
  const sym = useBusinessStore((s) => s.profile?.currencySymbol ?? '₹')
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const canManage = hasPermission('jewellery.manageExchanges')

  const [schemes, setSchemes] = useState<GoldSavingsScheme[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [pickedCustomer, setPickedCustomer] = useState<CustomerLite | null>(null)
  const [metalType, setMetalType] = useState('GOLD')
  const [monthlyAmount, setMonthlyAmount] = useState('')
  const [tenureMonths, setTenureMonths] = useState('11')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const [installTarget, setInstallTarget] = useState<GoldSavingsScheme | null>(null)
  const [installAmount, setInstallAmount] = useState('')
  const [installing, setInstalling] = useState(false)

  const [redeemTarget, setRedeemTarget] = useState<GoldSavingsScheme | null>(null)
  const [bonusAmount, setBonusAmount] = useState('0')
  const [redeeming, setRedeeming] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await window.api.goldSavings.list()
      if (res.success) setSchemes((res.data as GoldSavingsScheme[]) ?? [])
      else toastError(t('common.error'), res.error?.message ?? t('common.error'))
    } catch {
      toastError(t('common.error'), t('common.error'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { void load() }, [load])

  function resetForm() {
    setPickedCustomer(null)
    setMonthlyAmount('')
    setTenureMonths('11')
    setStartDate(new Date().toISOString().slice(0, 10))
    setNotes('')
    setError('')
  }

  async function handleCreate() {
    setError('')
    if (!pickedCustomer) { setError(t('jewellery.selectCustomer')); return }
    const monthly = Number(monthlyAmount)
    if (!Number.isFinite(monthly) || monthly <= 0) { setError(t('jewellery.validAmountRequired')); return }
    const tenure = Number(tenureMonths)
    if (!Number.isInteger(tenure) || tenure <= 0) { setError(t('jewellery.validTenureRequired')); return }
    setSaving(true)
    try {
      const res = await window.api.goldSavings.create({
        customerId: pickedCustomer.id, metalType, monthlyAmount: monthly, tenureMonths: tenure, startDate,
        notes: notes.trim() || undefined,
      })
      if (res.success) {
        const data = res.data as GoldSavingsScheme
        toastSuccess(t('jewellery.schemeCreated'), t('jewellery.schemeCreatedDesc', { number: data.schemeNumber }))
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

  async function handleRecordInstallment() {
    if (!installTarget) return
    const amount = Number(installAmount)
    if (!Number.isFinite(amount) || amount <= 0) return
    setInstalling(true)
    try {
      const res = await window.api.goldSavings.recordInstallment({ schemeId: installTarget.id, amount })
      if (res.success) {
        toastSuccess(t('jewellery.installmentRecorded'), t('jewellery.installmentRecordedDesc', { amount: `${sym}${amount.toFixed(2)}` }))
        setInstallTarget(null)
        setInstallAmount('')
        await load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } finally {
      setInstalling(false)
    }
  }

  async function handleRedeem() {
    if (!redeemTarget) return
    const bonus = Number(bonusAmount) || 0
    setRedeeming(true)
    try {
      const res = await window.api.goldSavings.redeem({ schemeId: redeemTarget.id, bonusAmount: bonus })
      if (res.success) {
        toastSuccess(t('jewellery.schemeRedeemed'), t('jewellery.schemeRedeemedDesc'))
        setRedeemTarget(null)
        setBonusAmount('0')
        await load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } finally {
      setRedeeming(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-dark flex items-center gap-2"><PiggyBank size={20} /> {t('jewellery.goldSavings')}</h2>
          <p className="text-sm text-slate-400">{t('jewellery.goldSavingsDesc')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => void load()} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:border-slate-300 transition-colors">
            <RefreshCw size={14} /> {t('jewellery.refresh')}
          </button>
          {canManage && (
            <Button size="sm" onClick={() => setShowForm((s) => !s)} icon={<Plus size={14} />}>{t('jewellery.newScheme')}</Button>
          )}
        </div>
      </div>

      {showForm && canManage && (
        <Card padding="md" className="space-y-3">
          <CustomerPicker value={pickedCustomer} onChange={setPickedCustomer} label={t('jewellery.customer')} />
          <div className="grid grid-cols-4 gap-3">
            <Select label={t('jewellery.metalType')} value={metalType} onChange={(e) => setMetalType(e.target.value)}>
              {METAL_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
            <Input label={t('jewellery.monthlyAmount')} type="number" step="0.01" min="0" value={monthlyAmount} onChange={(e) => setMonthlyAmount(e.target.value)} />
            <Input label={t('jewellery.tenureMonths')} type="number" step="1" min="1" value={tenureMonths} onChange={(e) => setTenureMonths(e.target.value)} />
            <Input label={t('jewellery.startDate')} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <Input label={t('jewellery.notes')} value={notes} onChange={(e) => setNotes(e.target.value)} />
          {error && <p className="text-xs text-danger bg-red-50 border border-red-100 rounded-md px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setShowForm(false); resetForm() }}>{t('jewellery.cancel')}</Button>
            <Button size="sm" onClick={() => void handleCreate()} loading={saving}>{t('jewellery.createScheme')}</Button>
          </div>
        </Card>
      )}

      {installTarget && (
        <Card padding="md" className="space-y-3 border-brand/40">
          <p className="text-sm font-semibold text-dark">{t('jewellery.recordInstallmentTitle', { number: installTarget.schemeNumber })}</p>
          <Input label={t('jewellery.installmentAmount')} type="number" step="0.01" min="0" value={installAmount} onChange={(e) => setInstallAmount(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setInstallTarget(null); setInstallAmount('') }} disabled={installing}>{t('jewellery.cancel')}</Button>
            <Button size="sm" onClick={() => void handleRecordInstallment()} loading={installing}>{t('jewellery.record')}</Button>
          </div>
        </Card>
      )}

      {redeemTarget && (
        <Card padding="md" className="space-y-3 border-brand/40">
          <p className="text-sm font-semibold text-dark">{t('jewellery.redeemSchemeTitle', { number: redeemTarget.schemeNumber })}</p>
          <p className="text-xs text-slate-400">{t('jewellery.redeemHint', { amount: `${sym}${redeemTarget.totalDeposited.toFixed(2)}` })}</p>
          <Input label={t('jewellery.bonusAmount')} type="number" step="0.01" min="0" value={bonusAmount} onChange={(e) => setBonusAmount(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => { setRedeemTarget(null); setBonusAmount('0') }} disabled={redeeming}>{t('jewellery.cancel')}</Button>
            <Button size="sm" onClick={() => void handleRedeem()} loading={redeeming}>{t('jewellery.redeem')}</Button>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">{t('jewellery.loading')}</div>
      ) : schemes.length === 0 ? (
        <Card padding="lg" className="text-center py-12">
          <PiggyBank size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('jewellery.noSchemes')}</p>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {schemes.map((s) => (
              <div key={s.id} className="px-5 py-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm dark:text-slate-100">{s.schemeNumber}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-slate-800 dark:text-slate-400">{s.metalType}</span>
                    <Badge variant={s.status === 'ACTIVE' ? 'success' : s.status === 'REDEEMED' ? 'neutral' : 'warning'} size="sm">{t(`jewellery.schemeStatus.${s.status}`)}</Badge>
                  </div>
                  <div className="text-sm text-gray-800 mt-1 dark:text-slate-200">{s.customer.customerName}</div>
                  <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap dark:text-slate-400">
                    <span>{t('jewellery.monthlyOverTenure', { amount: `${sym}${s.monthlyAmount.toFixed(2)}`, tenure: s.tenureMonths })}</span>
                    <span className="font-semibold text-dark dark:text-slate-100">{t('jewellery.deposited', { amount: `${sym}${s.totalDeposited.toFixed(2)}` })}</span>
                    {s.status === 'REDEEMED' && <span>{t('jewellery.redeemedFor', { amount: `${sym}${(s.redeemedAmount ?? 0).toFixed(2)}` })}</span>}
                  </div>
                </div>
                {canManage && s.status === 'ACTIVE' && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => { setInstallTarget(s); setInstallAmount(String(s.monthlyAmount)) }} className="text-xs px-3 py-1.5 rounded-lg bg-brand/5 text-brand border border-brand/20 hover:bg-brand/10 flex items-center gap-1 font-medium">
                      <Wallet size={12} /> {t('jewellery.addInstallment')}
                    </button>
                    <button onClick={() => setRedeemTarget(s)} className="text-xs px-3 py-1.5 rounded-lg bg-warning/5 text-warning border border-warning/20 hover:bg-warning/10 flex items-center gap-1 font-medium">
                      <Gift size={12} /> {t('jewellery.redeem')}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
