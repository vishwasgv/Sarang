import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@shared/ui/atoms/Button'
import { Card } from '@shared/ui/molecules/Card'
import { useBusinessStore } from '@app/store/business.store'
import { useAuthStore } from '@app/store/auth.store'
import { useNotificationStore } from '@app/store/notification.store'

interface ProfileFields { creditInterestEnabled?: boolean; creditInterestRatePercent?: number; creditInterestType?: string }

// Interest on overdue customer balances. Off unless the owner turns it on; it is charged per overdue invoice from its own due date,
// and only when someone presses "Charge interest" on the customer page.
export function LateInterestCard() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const profile = useBusinessStore((s) => s.profile) as (ProfileFields & Record<string, unknown>) | null
  const setProfile = useBusinessStore((s) => s.setProfile)
  const canEdit = useAuthStore((s) => s.hasPermission('settings.modify'))
  const [enabled, setEnabled] = useState(false)
  const [rate, setRate] = useState('')
  const [type, setType] = useState('SIMPLE')

  useEffect(() => {
    setEnabled(!!profile?.creditInterestEnabled)
    setRate(profile?.creditInterestRatePercent ? String(profile.creditInterestRatePercent) : '')
    setType(profile?.creditInterestType === 'COMPOUND' ? 'COMPOUND' : 'SIMPLE')
  }, [profile])

  async function save() {
    const res = await window.api.businessProfile.update({ creditInterestEnabled: enabled, creditInterestRatePercent: Number(rate) || 0, creditInterestType: type })
    if (!res.success) { toastError(t('common.error'), res.error?.message ?? ''); return }
    const fresh = await window.api.businessProfile.get()
    if (fresh.success && fresh.data) setProfile(fresh.data as Parameters<typeof setProfile>[0])
    toastSuccess(t('common.saved'))
  }

  const field = 'h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-dark dark:text-slate-100'
  return (
    <Card padding="lg" className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-dark dark:text-slate-100">{t('settings.lateInterest.title')}</h3>
        <p className="text-sm text-slate-500 mt-1">{t('settings.lateInterest.hint')}</p>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input type="checkbox" checked={enabled} disabled={!canEdit} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4 accent-brand" />
        {t('settings.lateInterest.enable')}
      </label>
      {enabled && (
        <div className="flex flex-wrap items-center gap-3">
          <input type="number" min={0} max={100} step="0.1" value={rate} disabled={!canEdit} onChange={(e) => setRate(e.target.value)} placeholder={t('settings.lateInterest.ratePlaceholder')} className={`${field} w-44`} />
          <select value={type} disabled={!canEdit} onChange={(e) => setType(e.target.value)} className={field}>
            <option value="SIMPLE">{t('settings.lateInterest.simple')}</option>
            <option value="COMPOUND">{t('settings.lateInterest.compound')}</option>
          </select>
        </div>
      )}
      {canEdit && <Button onClick={save}>{t('common.save')}</Button>}
    </Card>
  )
}
