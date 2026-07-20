import { getPrisma } from '../database/db'
import { logAction } from './audit.service'

// Phase 58 §2 — Marketing Agency: real campaign performance data entry
// (impressions/clicks/conversions/actual spend per period) and a real
// content calendar, replacing ServiceProject.targetChannel/deliverableType/
// adSpendBudget's PLANNED-only fields with what actually happened.

// CampaignPerformanceEntry.actualSpend is a Prisma Decimal field —
// Electron's IPC (structured clone) cannot serialize a Decimal instance.
function serializePerformanceEntry<T extends { actualSpend: unknown }>(e: T): T {
  return { ...e, actualSpend: e.actualSpend == null ? null : Number(e.actualSpend) }
}

export async function listCampaignPerformanceEntries(projectId: string) {
  try {
    const db = getPrisma()
    const items = await db.campaignPerformanceEntry.findMany({ where: { projectId }, orderBy: { periodStart: 'asc' } })
    return { success: true, data: items.map(serializePerformanceEntry) }
  } catch (err) {
    return { success: false, error: { code: 'CPE-001', message: err instanceof Error ? err.message : 'Could not list campaign performance entries.' } }
  }
}

export async function addCampaignPerformanceEntry(payload: {
  projectId: string
  periodStart: string
  periodEnd: string
  impressions?: number
  clicks?: number
  conversions?: number
  actualSpend?: number
  notes?: string
}) {
  try {
    if (!payload.periodStart || !payload.periodEnd) return { success: false, error: { code: 'CPE-002', message: 'Period start and end are required.' } }
    if (new Date(payload.periodEnd) < new Date(payload.periodStart)) return { success: false, error: { code: 'CPE-003', message: 'Period end cannot be before period start.' } }
    const db = getPrisma()
    const project = await db.serviceProject.findUnique({ where: { id: payload.projectId }, select: { id: true } })
    if (!project) return { success: false, error: { code: 'CPE-004', message: 'Campaign (project) not found.' } }

    const entry = await db.campaignPerformanceEntry.create({
      data: {
        projectId: payload.projectId,
        periodStart: new Date(payload.periodStart),
        periodEnd: new Date(payload.periodEnd),
        impressions: payload.impressions ?? null,
        clicks: payload.clicks ?? null,
        conversions: payload.conversions ?? null,
        actualSpend: payload.actualSpend ?? null,
        notes: payload.notes?.trim() || null,
      },
    })
    await logAction({ action: 'CAMPAIGN_PERFORMANCE_ENTRY_ADDED', entityType: 'CampaignPerformanceEntry', entityId: entry.id, newValue: { projectId: payload.projectId } }).catch(() => {})
    return { success: true, data: serializePerformanceEntry(entry) }
  } catch (err) {
    return { success: false, error: { code: 'CPE-005', message: err instanceof Error ? err.message : 'Could not add campaign performance entry.' } }
  }
}

export async function updateCampaignPerformanceEntry(payload: {
  id: string
  periodStart?: string
  periodEnd?: string
  impressions?: number | null
  clicks?: number | null
  conversions?: number | null
  actualSpend?: number | null
  notes?: string | null
}) {
  try {
    const db = getPrisma()
    const { id, periodStart, periodEnd, ...rest } = payload
    const entry = await db.campaignPerformanceEntry.update({
      where: { id },
      data: {
        ...rest,
        ...(periodStart !== undefined ? { periodStart: new Date(periodStart) } : {}),
        ...(periodEnd !== undefined ? { periodEnd: new Date(periodEnd) } : {}),
      },
    })
    await logAction({ action: 'CAMPAIGN_PERFORMANCE_ENTRY_UPDATED', entityType: 'CampaignPerformanceEntry', entityId: id }).catch(() => {})
    return { success: true, data: serializePerformanceEntry(entry) }
  } catch (err) {
    return { success: false, error: { code: 'CPE-006', message: err instanceof Error ? err.message : 'Could not update campaign performance entry.' } }
  }
}

export async function deleteCampaignPerformanceEntry(id: string) {
  try {
    const db = getPrisma()
    await db.campaignPerformanceEntry.delete({ where: { id } })
    await logAction({ action: 'CAMPAIGN_PERFORMANCE_ENTRY_DELETED', entityType: 'CampaignPerformanceEntry', entityId: id }).catch(() => {})
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'CPE-007', message: err instanceof Error ? err.message : 'Could not delete campaign performance entry.' } }
  }
}

// Client-facing performance summary — aggregates all logged periods for a
// campaign into totals + derived rates (CTR/conversion rate), feeding the
// real printable client performance summary. CTR/conversion-rate are only
// computed when their denominator is a real logged number (never divide by
// an absent/zero value into a misleading 0% or Infinity).
export interface CampaignPerformanceSummary {
  projectId: string
  entryCount: number
  totalImpressions: number
  totalClicks: number
  totalConversions: number
  totalActualSpend: number
  ctrPercent: number | null
  conversionRatePercent: number | null
  costPerConversion: number | null
  entries: Array<{
    id: string; periodStart: string; periodEnd: string
    impressions: number | null; clicks: number | null; conversions: number | null; actualSpend: number | null; notes: string | null
  }>
}

export async function getCampaignPerformanceSummary(projectId: string): Promise<{ success: true; data: CampaignPerformanceSummary } | { success: false; error: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const entries = await db.campaignPerformanceEntry.findMany({ where: { projectId }, orderBy: { periodStart: 'asc' } })

    const totalImpressions = entries.reduce((s, e) => s + (e.impressions ?? 0), 0)
    const totalClicks = entries.reduce((s, e) => s + (e.clicks ?? 0), 0)
    const totalConversions = entries.reduce((s, e) => s + (e.conversions ?? 0), 0)
    const totalActualSpend = entries.reduce((s, e) => s + Number(e.actualSpend ?? 0), 0)

    return {
      success: true,
      data: {
        projectId,
        entryCount: entries.length,
        totalImpressions,
        totalClicks,
        totalConversions,
        totalActualSpend,
        ctrPercent: totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : null,
        conversionRatePercent: totalClicks > 0 ? (totalConversions / totalClicks) * 100 : null,
        costPerConversion: totalConversions > 0 ? totalActualSpend / totalConversions : null,
        entries: entries.map((e) => ({
          id: e.id,
          periodStart: e.periodStart.toISOString(),
          periodEnd: e.periodEnd.toISOString(),
          impressions: e.impressions,
          clicks: e.clicks,
          conversions: e.conversions,
          actualSpend: e.actualSpend == null ? null : Number(e.actualSpend),
          notes: e.notes,
        })),
      },
    }
  } catch (err) {
    return { success: false, error: { code: 'CPE-008', message: err instanceof Error ? err.message : 'Could not generate performance summary.' } }
  }
}

// ── Content calendar ────────────────────────────────────────────────────

export async function listContentCalendarItems(projectId: string) {
  try {
    const db = getPrisma()
    const items = await db.contentCalendarItem.findMany({ where: { projectId }, orderBy: { scheduledDate: 'asc' } })
    return { success: true, data: items }
  } catch (err) {
    return { success: false, error: { code: 'CCI-001', message: err instanceof Error ? err.message : 'Could not list content calendar items.' } }
  }
}

export async function createContentCalendarItem(payload: {
  projectId: string
  scheduledDate: string
  contentType?: string
  title: string
  platform?: string
  notes?: string
}) {
  try {
    if (!payload.title.trim()) return { success: false, error: { code: 'CCI-002', message: 'Title is required.' } }
    if (!payload.scheduledDate) return { success: false, error: { code: 'CCI-003', message: 'Scheduled date is required.' } }
    const db = getPrisma()
    const project = await db.serviceProject.findUnique({ where: { id: payload.projectId }, select: { id: true } })
    if (!project) return { success: false, error: { code: 'CCI-004', message: 'Campaign (project) not found.' } }

    const item = await db.contentCalendarItem.create({
      data: {
        projectId: payload.projectId,
        scheduledDate: new Date(payload.scheduledDate),
        contentType: payload.contentType ?? 'SOCIAL_POST',
        title: payload.title.trim(),
        platform: payload.platform?.trim() || null,
        status: 'PLANNED',
        notes: payload.notes?.trim() || null,
      },
    })
    await logAction({ action: 'CONTENT_CALENDAR_ITEM_CREATED', entityType: 'ContentCalendarItem', entityId: item.id, newValue: { projectId: payload.projectId, title: item.title } }).catch(() => {})
    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'CCI-005', message: err instanceof Error ? err.message : 'Could not create content calendar item.' } }
  }
}

export async function updateContentCalendarItem(payload: {
  id: string
  scheduledDate?: string
  contentType?: string
  title?: string
  platform?: string | null
  status?: string
  notes?: string | null
}) {
  try {
    const db = getPrisma()
    const { id, scheduledDate, ...rest } = payload
    const item = await db.contentCalendarItem.update({
      where: { id },
      data: {
        ...rest,
        ...(scheduledDate !== undefined ? { scheduledDate: new Date(scheduledDate) } : {}),
      },
    })
    await logAction({ action: 'CONTENT_CALENDAR_ITEM_UPDATED', entityType: 'ContentCalendarItem', entityId: id }).catch(() => {})
    return { success: true, data: item }
  } catch (err) {
    return { success: false, error: { code: 'CCI-006', message: err instanceof Error ? err.message : 'Could not update content calendar item.' } }
  }
}

export async function deleteContentCalendarItem(id: string) {
  try {
    const db = getPrisma()
    await db.contentCalendarItem.delete({ where: { id } })
    await logAction({ action: 'CONTENT_CALENDAR_ITEM_DELETED', entityType: 'ContentCalendarItem', entityId: id }).catch(() => {})
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'CCI-007', message: err instanceof Error ? err.message : 'Could not delete content calendar item.' } }
  }
}
