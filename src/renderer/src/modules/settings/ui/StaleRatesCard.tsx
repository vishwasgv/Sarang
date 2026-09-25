import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@shared/ui/atoms/Button'
import { Card } from '@shared/ui/molecules/Card'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'

interface StaleRate { id: string; taxName: string; taxType: string; rate: number; isDefault: boolean }

// Shown only when a business outside India still holds the rates the app used to seed for everyone.
export function StaleRatesCard({ onChanged }: { onChanged: () => void }) {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const [rates, setRates] = useState<StaleRate[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await window.api.tax.staleRates()
    if (res.success && res.data) {
      const list = res.data as StaleRate[]
      setRates(list)
      setPicked(new Set(list.map((r) => r.id)))
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (rates.length === 0 || !hasPermission('settings.modifyTax')) return null

  async function turnOff() {
    setBusy(true)
    try {
      const res = await window.api.tax.deactivateStale({ ids: Array.from(picked) })
      if (!res.success) { toastError(t('common.error'), t('settings.tax.stale.failed')); return }
      toastSuccess(t('settings.tax.stale.done'), String((res.data as { deactivated: number }).deactivated))
      await load()
      onChanged()
    } catch {
      toastError(t('common.error'), t('settings.tax.stale.failed'))
    } finally { setBusy(false) }
  }

  return (
    <Card padding="md" className="space-y-3">
      <h3 className="font-semibold text-dark dark:text-slate-100">{t('settings.tax.stale.title')}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">{t('settings.tax.stale.help')}</p>
      <ul className="space-y-1">
        {rates.map((r) => (
          <li key={r.id}>
            <label className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 min-h-[44px]">
              <input
                type="checkbox" className="w-5 h-5" checked={picked.has(r.id)}
                onChange={(e) => setPicked((prev) => { const next = new Set(prev); if (e.target.checked) next.add(r.id); else next.delete(r.id); return next })}
              />
              {r.taxName} <span className="text-slate-400">({r.taxType} {r.rate}%)</span>
            </label>
          </li>
        ))}
      </ul>
      <Button onClick={turnOff} loading={busy} disabled={picked.size === 0}>{t('settings.tax.stale.turnOff')}</Button>
    </Card>
  )
}
