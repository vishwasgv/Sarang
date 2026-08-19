import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Award, RefreshCw, Settings, Gift } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Badge } from '@shared/ui/atoms/Badge'
import { Modal } from '@shared/ui/molecules/Modal'
import { ConfirmDialog } from '@shared/ui/molecules/ConfirmDialog'
import { SkeletonTable } from '@shared/ui/Skeleton'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'

interface LoyaltyProgram {
  id: string
  isActive: boolean
  punchesRequired: number
  rewardDescription: string
  minPurchaseAmount: number
}
interface LoyaltyCardRow {
  id: string
  customerId: string
  currentPunches: number
  totalPunchesEarned: number
  totalRewardsRedeemed: number
  readyForReward: boolean
  customer: { id: string; customerName: string; phone: string | null }
}

// Phase 67 §9.1 — Retail: simple visit-based loyalty punch-card. Punches
// accrue automatically at sale time (billing.service.ts's createInvoice) —
// this screen is config (Program Settings) plus a live view of every
// customer's current punch balance, with Redeem as the one manual action.
export function LoyaltyProgramScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const canManage = hasPermission('loyaltyProgram.manage')

  const [program, setProgram] = useState<LoyaltyProgram | null>(null)
  const [cards, setCards] = useState<LoyaltyCardRow[]>([])
  const [punchesRequired, setPunchesRequired] = useState(10)
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [redeemTarget, setRedeemTarget] = useState<LoyaltyCardRow | null>(null)
  const [redeeming, setRedeeming] = useState(false)

  const [formActive, setFormActive] = useState(true)
  const [formPunchesRequired, setFormPunchesRequired] = useState('10')
  const [formReward, setFormReward] = useState('')
  const [formMinPurchase, setFormMinPurchase] = useState('0')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [pRes, cRes] = await Promise.all([
        window.api.loyaltyProgram.get(),
        window.api.loyaltyProgram.listCards()
      ])
      if (pRes.success) setProgram((pRes.data as LoyaltyProgram | null) ?? null)
      if (cRes.success) {
        const d = cRes.data as { punchesRequired: number; rows: LoyaltyCardRow[] }
        setPunchesRequired(d.punchesRequired)
        setCards(d.rows ?? [])
      }
    } catch {
      toastError(t('common.error'), t('loyaltyProgram.couldNotLoad'))
    } finally {
      setLoading(false)
    }
  }, [toastError, t])

  useEffect(() => { load() }, [load])

  function openSettings() {
    setFormActive(program?.isActive ?? true)
    setFormPunchesRequired(String(program?.punchesRequired ?? 10))
    setFormReward(program?.rewardDescription ?? '')
    setFormMinPurchase(String(program?.minPurchaseAmount ?? 0))
    setShowSettings(true)
  }

  async function handleSaveSettings() {
    if (!formReward.trim()) { toastError(t('loyaltyProgram.missingFields'), t('loyaltyProgram.rewardRequired')); return }
    if (!formPunchesRequired || Number(formPunchesRequired) < 1) { toastError(t('loyaltyProgram.missingFields'), t('loyaltyProgram.punchesRequiredInvalid')); return }
    setSaving(true)
    try {
      const res = await window.api.loyaltyProgram.upsert({
        isActive: formActive,
        punchesRequired: Number(formPunchesRequired),
        rewardDescription: formReward.trim(),
        minPurchaseAmount: Number(formMinPurchase) || 0
      })
      if (res.success) {
        toastSuccess(t('loyaltyProgram.programSaved'), '')
        setShowSettings(false)
        load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('loyaltyProgram.couldNotSave'))
      }
    } catch {
      toastError(t('common.error'), t('loyaltyProgram.couldNotSave'))
    } finally {
      setSaving(false)
    }
  }

  async function handleRedeem() {
    if (!redeemTarget) return
    setRedeeming(true)
    try {
      const res = await window.api.loyaltyProgram.redeem(redeemTarget.customerId)
      if (res.success) {
        toastSuccess(t('loyaltyProgram.rewardRedeemed'), '')
        setRedeemTarget(null)
        load()
      } else {
        toastError(t('common.error'), res.error?.message ?? t('loyaltyProgram.couldNotRedeem'))
      }
    } catch {
      toastError(t('common.error'), t('loyaltyProgram.couldNotRedeem'))
    } finally {
      setRedeeming(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center">
              <Award size={18} className="text-brand" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('loyaltyProgram.title')}</h1>
              <p className="text-xs text-slate-400">{t('loyaltyProgram.subtitle', { count: cards.length })}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-brand hover:border-brand transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            {canManage && (
              <Button size="sm" variant="secondary" icon={<Settings size={14} />} onClick={openSettings}>{t('loyaltyProgram.programSettings')}</Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto dark:bg-slate-950">
        {loading && cards.length === 0 ? (
          <div className="p-6"><SkeletonTable rows={6} cols={5} /></div>
        ) : !program ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
            <Award size={40} className="opacity-30" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('loyaltyProgram.noProgramYet')}</p>
            {canManage && <Button size="sm" icon={<Settings size={14} />} onClick={openSettings}>{t('loyaltyProgram.programSettings')}</Button>}
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-slate-400">
            <Award size={40} className="opacity-30" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('loyaltyProgram.noCardsYet')}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
                <th className="text-start px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('loyaltyProgram.customer')}</th>
                <th className="text-start px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('loyaltyProgram.progress')}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('loyaltyProgram.totalEarned')}</th>
                <th className="text-end px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('loyaltyProgram.totalRedeemed')}</th>
                <th className="text-end px-6 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {cards.map(c => {
                const pct = Math.min(100, Math.round((c.currentPunches / punchesRequired) * 100))
                return (
                  <tr key={c.id} className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-6 py-3">
                      <div className="font-semibold text-dark dark:text-slate-100">{c.customer.customerName}</div>
                      {c.customer.phone && <div className="text-xs text-slate-400">{c.customer.phone}</div>}
                    </td>
                    <td className="px-4 py-3 min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div className={`h-full rounded-full ${c.readyForReward ? 'bg-success' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{c.currentPunches}/{punchesRequired}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-end text-slate-500 dark:text-slate-400">{c.totalPunchesEarned}</td>
                    <td className="px-4 py-3 text-end text-slate-500 dark:text-slate-400">{c.totalRewardsRedeemed}</td>
                    <td className="px-6 py-3 text-end">
                      {canManage && c.readyForReward && (
                        <button onClick={() => setRedeemTarget(c)} className="inline-flex items-center gap-1 text-xs font-semibold text-success hover:text-success/80 transition-colors">
                          <Gift size={12} />{t('loyaltyProgram.redeem')}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showSettings && (
        <Modal open onClose={() => setShowSettings(false)} title={t('loyaltyProgram.programSettings')} size="md"
          footer={<>
            <Button variant="secondary" onClick={() => setShowSettings(false)} disabled={saving}>{t('common.cancel')}</Button>
            <Button onClick={handleSaveSettings} loading={saving}>{t('common.save')}</Button>
          </>}
        >
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-dark dark:text-slate-200">
              <input type="checkbox" checked={formActive} onChange={e => setFormActive(e.target.checked)} className="rounded" />
              {t('loyaltyProgram.isActive')}
            </label>
            <Input label={t('loyaltyProgram.punchesRequired')} type="number" min="1" step="1" value={formPunchesRequired} onChange={e => setFormPunchesRequired(e.target.value)} />
            <Input label={t('loyaltyProgram.rewardDescription')} value={formReward} onChange={e => setFormReward(e.target.value)} placeholder={t('loyaltyProgram.rewardPlaceholder')} />
            <Input label={t('loyaltyProgram.minPurchaseAmount')} type="number" min="0" step="0.01" value={formMinPurchase} onChange={e => setFormMinPurchase(e.target.value)} />
            <p className="text-xs text-slate-400">{t('loyaltyProgram.settingsHint')}</p>
          </div>
        </Modal>
      )}

      {redeemTarget && (
        <ConfirmDialog
          open
          title={t('loyaltyProgram.redeemTitle')}
          message={t('loyaltyProgram.redeemMessage', { name: redeemTarget.customer.customerName, reward: program?.rewardDescription ?? '' })}
          confirmLabel={t('loyaltyProgram.redeem')}
          loading={redeeming}
          onConfirm={handleRedeem}
          onClose={() => setRedeemTarget(null)}
        />
      )}
    </div>
  )
}
