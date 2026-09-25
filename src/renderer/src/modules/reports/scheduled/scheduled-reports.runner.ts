import { useEffect } from 'react'
import { i18n } from '../../../i18n'
import { useAuthStore } from '@app/store/auth.store'
import { useBusinessStore } from '@app/store/business.store'
import { genericReportExport, isGenericReport } from '../ui/GenericReportViews'
import { SCHEDULE_SETTING_KEY, fileNameFor, isDue, lastCompletePeriod, parseSchedules, type ScheduledReport } from './scheduled-reports.util'

// Saves due reports to their folders while the app is open. Runs when the app starts and every 10 minutes after.

const CHECK_EVERY_MS = 10 * 60 * 1000

export async function loadSchedules(): Promise<ScheduledReport[]> {
  const res = await window.api.settings.get(SCHEDULE_SETTING_KEY)
  return res.success ? parseSchedules(res.data as string | null) : []
}

export async function storeSchedules(list: ScheduledReport[]): Promise<boolean> {
  const res = await window.api.settings.set({ key: SCHEDULE_SETTING_KEY, value: JSON.stringify(list) })
  return res.success
}

/** Saves one schedule's last complete period. Returns the saved path, or the reason it could not be saved. */
export async function runSchedule(s: ScheduledReport, now: Date): Promise<{ ok: true; path: string } | { ok: false; message: string }> {
  if (!isGenericReport(s.reportId)) return { ok: false, message: 'This report cannot be saved on a schedule.' }
  const period = lastCompletePeriod(s.frequency, now)
  const res = await window.api.reports.generic({ id: s.reportId, dateFrom: period.dateFrom, dateTo: period.dateTo, asOf: period.dateTo })
  if (!res.success || !res.data) return { ok: false, message: res.error?.message ?? 'The report could not be built.' }
  const t = i18n.t.bind(i18n)
  const symbol = useBusinessStore.getState().profile?.currencySymbol ?? ''
  const table = genericReportExport(res.data, t, symbol)
  const label = t(`reports.defs.${s.reportId}.label`)
  const saved = await window.api.reportFiles.save({
    folder: s.folder, fileName: fileNameFor(label, period), format: s.format, sheetName: label, headers: table.headers, rows: table.rows
  })
  if (!saved.success) return { ok: false, message: saved.error?.message ?? 'The file could not be saved.' }
  return { ok: true, path: (saved.data as { path: string }).path }
}

let running = false

/** One pass over every schedule that is due; records the period that was saved so it is not saved twice. */
export async function runDueSchedules(now = new Date()): Promise<void> {
  if (running) return
  running = true
  try {
    const list = await loadSchedules()
    let changed = false
    for (const s of list) {
      if (!isDue(s, now)) continue
      const result = await runSchedule(s, now)
      if (result.ok) {
        s.lastPeriodEnd = lastCompletePeriod(s.frequency, now).dateTo
        changed = true
      }
    }
    if (changed) await storeSchedules(list)
  } catch {
    /* a failed pass is tried again at the next check */
  } finally {
    running = false
  }
}

export function useScheduledReportRunner(): void {
  const canRun = useAuthStore((s) => s.hasPermission('reports.export') && s.hasPermission('settings.modify'))
  useEffect(() => {
    if (!canRun) return
    void runDueSchedules()
    const timer = setInterval(() => { void runDueSchedules() }, CHECK_EVERY_MS)
    return () => clearInterval(timer)
  }, [canRun])
}
