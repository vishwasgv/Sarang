export const DASHBOARD_SECTIONS = ['ask', 'kpis', 'revenue', 'outstanding', 'activity', 'quick'] as const
export type DashboardSection = (typeof DASHBOARD_SECTIONS)[number]

export function dashboardHiddenKey(userId: string | null | undefined): string {
  return `sarang-dashboard-hidden-${userId ?? 'anon'}`
}

export function parseHiddenSections(raw: string | null): DashboardSection[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return DASHBOARD_SECTIONS.filter((s) => parsed.includes(s))
  } catch {
    return []
  }
}

export function toggleSection(hidden: DashboardSection[], section: DashboardSection): DashboardSection[] {
  return hidden.includes(section) ? hidden.filter((s) => s !== section) : [...hidden, section]
}
