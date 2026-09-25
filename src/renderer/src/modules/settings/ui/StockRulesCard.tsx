import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@shared/ui/atoms/Button'
import { Card } from '@shared/ui/molecules/Card'
import { useBusinessStore } from '@app/store/business.store'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'

const KEY = 'allow_negative_inventory'

// Whether a sale may take stock below zero (for shops that sell before they record the purchase).
export function StockRulesCard() {
  const { t } = useTranslation()
  const { getSetting, settings, setSettings } = useBusinessStore()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const [allow, setAllow] = useState(getSetting(KEY, 'false') === 'true')
  const [saving, setSaving] = useState(false)
  const canEdit = hasPermission('settings.modify')

  async function save() {
    setSaving(true)
    try {
      const res = await window.api.settings.set({ key: KEY, value: allow ? 'true' : 'false' })
      if (!res.success) { toastError(t('common.error'), t('settings.stockRules.saveFailed')); return }
      setSettings({ ...settings, [KEY]: allow ? 'true' : 'false' })
      toastSuccess(t('settings.stockRules.saved'))
    } catch {
      toastError(t('common.error'), t('settings.stockRules.saveFailed'))
    } finally { setSaving(false) }
  }

  return (
    <Card padding="md" className="space-y-3 max-w-2xl mt-6">
      <h3 className="font-semibold text-dark dark:text-slate-100">{t('settings.stockRules.title')}</h3>
      <label className="flex items-start gap-3 min-h-[44px] text-sm text-slate-700 dark:text-slate-200">
        <input type="checkbox" className="w-5 h-5 mt-0.5" checked={allow} disabled={!canEdit} onChange={(e) => setAllow(e.target.checked)} />
        <span>
          {t('settings.stockRules.allowNegative')}
          <span className="block text-xs text-slate-500 dark:text-slate-400">{t('settings.stockRules.allowNegativeHelp')}</span>
        </span>
      </label>
      {canEdit && <Button size="sm" onClick={save} loading={saving}>{t('common.save')}</Button>}
    </Card>
  )
}
