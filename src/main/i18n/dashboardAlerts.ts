import messages from './dashboardAlerts.locales.json'

type MessageDict = Record<string, string>
const ALL_MESSAGES = messages as Record<string, MessageDict>

// Main-process-only i18n for Dashboard Spotlight alerts (Phase D). The
// renderer's language preference lives only in localStorage, so the current
// language must be passed in explicitly on each call (see
// analytics.service.ts's getDashboardAlerts) — the main process has no
// access to it otherwise.
export function formatDashboardAlert(
  lang: string,
  key: string,
  count: number | undefined,
  params: Record<string, string | number> = {}
): string {
  const dict = ALL_MESSAGES[lang] ?? ALL_MESSAGES.en
  const resolvedKey = count !== undefined ? `${key}_${count === 1 ? 'one' : 'other'}` : key
  let template = dict[resolvedKey] ?? ALL_MESSAGES.en[resolvedKey] ?? resolvedKey
  const allParams: Record<string, string | number> = count !== undefined ? { count, ...params } : params
  for (const [k, v] of Object.entries(allParams)) {
    template = template.split(`{{${k}}}`).join(String(v))
  }
  return template
}
