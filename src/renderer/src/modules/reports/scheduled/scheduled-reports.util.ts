// Reports saved to a folder on a schedule. The schedule list is kept in one setting; this file holds the pure
// rules: when a schedule is due, which dates it covers and what the file is called.

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY'
export type FileFormat = 'CSV' | 'XLSX'

export interface ScheduledReport {
  id: string
  reportId: string
  frequency: Frequency
  format: FileFormat
  folder: string
  enabled: boolean
  /** ISO date (YYYY-MM-DD) of the last period that was saved; empty when never run. */
  lastPeriodEnd: string
}

export const SCHEDULE_SETTING_KEY = 'scheduled_reports'

const pad = (n: number) => String(n).padStart(2, '0')
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** The last complete period before `now`: yesterday, last Monday to Sunday, or last calendar month. */
export function lastCompletePeriod(frequency: Frequency, now: Date): { dateFrom: string; dateTo: string } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (frequency === 'DAILY') {
    const y = new Date(today); y.setDate(y.getDate() - 1)
    return { dateFrom: isoDate(y), dateTo: isoDate(y) }
  }
  if (frequency === 'WEEKLY') {
    const sinceMonday = (today.getDay() + 6) % 7
    const end = new Date(today); end.setDate(end.getDate() - sinceMonday - 1)
    const start = new Date(end); start.setDate(start.getDate() - 6)
    return { dateFrom: isoDate(start), dateTo: isoDate(end) }
  }
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const end = new Date(today.getFullYear(), today.getMonth(), 0)
  return { dateFrom: isoDate(start), dateTo: isoDate(end) }
}

/** Due when the last complete period has not been saved yet. A schedule made today first runs for that period. */
export function isDue(s: ScheduledReport, now: Date): boolean {
  if (!s.enabled || !s.folder || !s.reportId) return false
  return s.lastPeriodEnd < lastCompletePeriod(s.frequency, now).dateTo
}

export function fileNameFor(reportLabel: string, period: { dateFrom: string; dateTo: string }): string {
  const range = period.dateFrom === period.dateTo ? period.dateFrom : `${period.dateFrom} to ${period.dateTo}`
  return `${reportLabel} ${range}`
}

export function parseSchedules(raw: string | null | undefined): ScheduledReport[] {
  if (!raw) return []
  try {
    const list = JSON.parse(raw) as unknown
    if (!Array.isArray(list)) return []
    return list.filter((x): x is ScheduledReport =>
      !!x && typeof x === 'object' && typeof (x as ScheduledReport).id === 'string' && typeof (x as ScheduledReport).reportId === 'string'
      && ['DAILY', 'WEEKLY', 'MONTHLY'].includes((x as ScheduledReport).frequency) && ['CSV', 'XLSX'].includes((x as ScheduledReport).format))
      .map((x) => ({ ...x, folder: String(x.folder ?? ''), enabled: x.enabled !== false, lastPeriodEnd: String(x.lastPeriodEnd ?? '') }))
  } catch {
    return []
  }
}
