import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@shared/ui/atoms/Button'
import { Card } from '@shared/ui/molecules/Card'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'
import { useAuthStore } from '@app/store/auth.store'
import { GENERIC_REPORT_IDS } from '../ui/GenericReportViews'
import { loadSchedules, storeSchedules, runSchedule } from './scheduled-reports.runner'
import type { Frequency, FileFormat, ScheduledReport } from './scheduled-reports.util'

// Settings card: reports the app saves to a folder by itself while it is open.
export function ScheduledReportsCard() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { hasPermission } = useAuthStore()
  const [list, setList] = useState<ScheduledReport[]>([])
  const [reportId, setReportId] = useState<string>(GENERIC_REPORT_IDS[0])
  const [frequency, setFrequency] = useState<Frequency>('MONTHLY')
  const [format, setFormat] = useState<FileFormat>('XLSX')
  const [folder, setFolder] = useState('')
  const canEdit = hasPermission('settings.modify') && hasPermission('reports.export')

  useEffect(() => { loadSchedules().then(setList).catch(() => {}) }, [])

  async function chooseFolder() {
    const res = await window.api.reportFiles.chooseFolder()
    if (res.success && res.data) setFolder(res.data as string)
  }

  async function persist(next: ScheduledReport[]) {
    if (!(await storeSchedules(next))) { toastError(t('common.error'), t('reports.scheduled.couldNotSave')); return }
    setList(next)
  }

  async function add() {
    if (!folder) { toastError(t('common.error'), t('reports.scheduled.folderRequired')); return }
    const item: ScheduledReport = { id: `${Date.now()}`, reportId, frequency, format, folder, enabled: true, lastPeriodEnd: '' }
    await persist([...list, item])
    toastSuccess(t('reports.scheduled.added'))
  }

  async function runNow(s: ScheduledReport) {
    const r = await runSchedule(s, new Date())
    if (r.ok) toastSuccess(t('reports.scheduled.savedTo'), r.path)
    else toastError(t('common.error'), r.message)
  }

  return (
    <Card padding="md" className="space-y-4 max-w-3xl mt-6">
      <div>
        <h3 className="font-semibold text-dark dark:text-slate-100">{t('reports.scheduled.title')}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('reports.scheduled.help')}</p>
      </div>

      {list.length > 0 && (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {list.map((s) => (
            <li key={s.id} className="py-3 flex flex-wrap items-center gap-3 text-sm">
              <div className="flex-1 min-w-[12rem]">
                <div className="font-medium text-dark dark:text-slate-100">{t(`reports.defs.${s.reportId}.label`)}</div>
                <div className="text-xs text-slate-500">{t(`reports.scheduled.freq.${s.frequency}`)} · {s.format} · {s.folder}</div>
              </div>
              {canEdit && (
                <>
                  <Button size="sm" variant="outline" onClick={() => runNow(s)}>{t('reports.scheduled.saveNow')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => persist(list.map((x) => (x.id === s.id ? { ...x, enabled: !x.enabled } : x)))}>{s.enabled ? t('reports.scheduled.pause') : t('reports.scheduled.resume')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => persist(list.filter((x) => x.id !== s.id))}>{t('common.delete')}</Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <div className="grid sm:grid-cols-2 gap-3">
          <Select label={t('reports.scheduled.report')} value={reportId} onChange={(e) => setReportId(e.target.value)}>
            {GENERIC_REPORT_IDS.map((id) => <option key={id} value={id}>{t(`reports.defs.${id}.label`)}</option>)}
          </Select>
          <Select label={t('reports.scheduled.frequency')} value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
            {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map((f) => <option key={f} value={f}>{t(`reports.scheduled.freq.${f}`)}</option>)}
          </Select>
          <Select label={t('reports.scheduled.format')} value={format} onChange={(e) => setFormat(e.target.value as FileFormat)}>
            <option value="XLSX">Excel</option>
            <option value="CSV">CSV</option>
          </Select>
          <div>
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('reports.scheduled.folder')}</div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={chooseFolder}>{t('reports.scheduled.chooseFolder')}</Button>
              <span className="text-xs text-slate-500 break-all">{folder}</span>
            </div>
          </div>
          <div className="sm:col-span-2"><Button onClick={add}>{t('reports.scheduled.add')}</Button></div>
        </div>
      )}
      <p className="text-xs text-slate-400">{t('reports.scheduled.note')}</p>
    </Card>
  )
}
