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
