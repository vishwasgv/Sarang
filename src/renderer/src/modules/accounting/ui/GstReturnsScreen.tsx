import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileJson } from 'lucide-react'
import { Button } from '@shared/ui/atoms/Button'
import { Card } from '@shared/ui/molecules/Card'
import { useNotificationStore } from '@app/store/notification.store'
import { toLocalISODate } from '@shared/utils/locale.util'

type Kind = 'gstr1' | 'gstr3b'

function thisMonth(): string {
  return toLocalISODate(new Date()).slice(0, 7)
}

export function GstReturnsScreen() {
  const { t } = useTranslation()
  const { error: toastError, success: toastSuccess } = useNotificationStore()
  const [month, setMonth] = useState(thisMonth)
  const [busy, setBusy] = useState<Kind | null>(null)

  async function download(kind: Kind) {
    setBusy(kind)
    try {
      const res = kind === 'gstr1'
        ? await window.api.gstReturns.exportGstr1({ month })
        : await window.api.gstReturns.exportGstr3b({ month })
      if (!res.success) { toastError(t('common.error'), res.error?.message ?? t('accounting.gstReturns.couldNotPrepare')); return }
      const data = res.data as { saved: boolean; path?: string } | undefined
      if (data?.saved) toastSuccess(t('accounting.gstReturns.saved'), data.path ?? '')
    } catch {
      toastError(t('common.error'), t('accounting.gstReturns.couldNotPrepare'))
    } finally { setBusy(null) }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand/10 flex items-center justify-center"><FileJson size={18} className="text-brand" /></div>
          <div>
            <h1 className="text-lg font-bold text-dark dark:text-slate-100">{t('accounting.gstReturns.title')}</h1>
            <p className="text-xs text-slate-400">{t('accounting.gstReturns.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 dark:bg-slate-950 space-y-6 max-w-3xl">
        <Card padding="md" className="space-y-3">
          <label className="block text-sm font-semibold text-dark dark:text-slate-100" htmlFor="gst-month">{t('accounting.gstReturns.month')}</label>
          <input
            id="gst-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)}
            className="h-12 px-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 text-base focus:outline-none focus:ring-2 focus:ring-brand"
          />
        </Card>

        <Card padding="md" className="space-y-2">
          <h2 className="font-semibold text-dark dark:text-slate-100">{t('accounting.gstReturns.gstr1Title')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('accounting.gstReturns.gstr1Help')}</p>
          <Button onClick={() => download('gstr1')} loading={busy === 'gstr1'} disabled={!month}>{t('accounting.gstReturns.download')}</Button>
        </Card>

        <Card padding="md" className="space-y-2">
          <h2 className="font-semibold text-dark dark:text-slate-100">{t('accounting.gstReturns.gstr3bTitle')}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('accounting.gstReturns.gstr3bHelp')}</p>
          <Button onClick={() => download('gstr3b')} loading={busy === 'gstr3b'} disabled={!month}>{t('accounting.gstReturns.download')}</Button>
        </Card>

        <p className="text-xs text-slate-400">{t('accounting.gstReturns.disclaimer')}</p>
      </div>
    </div>
  )
}
