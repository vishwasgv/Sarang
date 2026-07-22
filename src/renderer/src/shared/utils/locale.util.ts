import { useBusinessStore } from '@app/store/business.store'

const LOCALE_MAP: Record<string, string> = {
  IN: 'en-IN',
  US: 'en-US',
  EU: 'de-DE',
  UK: 'en-GB',
  ES: 'es-ES',
  FR: 'fr-FR',
  AR: 'ar-SA',
  PT: 'pt-BR',
  ID: 'id-ID',
  CN: 'zh-CN'
}

function getLocale(): string {
  const { getSetting } = useBusinessStore.getState()
  const fmt = getSetting('number_format', 'IN')
  return LOCALE_MAP[fmt] ?? 'en-US'
}

export function formatDate(
  dateStr: string | Date | null | undefined,
  includeTime = false
): string {
  if (!dateStr) return '—'
  try {
    const locale = getLocale()
    const opts: Intl.DateTimeFormatOptions = includeTime
      ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
      : { day: '2-digit', month: 'short', year: 'numeric' }
    return new Date(dateStr).toLocaleDateString(locale, opts)
  } catch {
    return String(dateStr)
  }
}

export function formatDateTime(dateStr: string | Date | null | undefined): string {
  return formatDate(dateStr, true)
}

// Real bug found live 2026-07-22: several screens computed "today" (or a
// date used to QUERY/select which records to fetch — an attendance day, a
// cash-close day, an appointments day-view) via `date.toISOString().split('T')[0]`.
// That extracts the UTC calendar date, which for any timezone ahead of UTC
// (IST is +5:30) lags behind the real local calendar date for the first
// ~5.5 hours after local midnight, every single day — not a one-off. A
// user in that window could view/mark attendance, cash-close, or
// appointments for the WRONG day while the on-screen date label (usually
// built with toLocaleDateString, which IS local-correct) shows the right
// one — a real display-vs-query mismatch, not just a cosmetic label issue.
// Always use this for a date-only (no time-of-day) string used in a query
// or state key; toLocaleDateString remains correct for pure display.
export function toLocalISODate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function formatTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—'
  try {
    const locale = getLocale()
    return new Date(dateStr).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return String(dateStr)
  }
}

export function formatNumber(
  value: number,
  opts?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  try {
    const locale = getLocale()
    return value.toLocaleString(locale, opts)
  } catch {
    return value.toString()
  }
}
