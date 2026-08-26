import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { toLocalISODate } from '../utils/date.util'

// Phase 67 §9.1 — Footwear item 5: seasonal reorder calendar. A shop-defined
// recurring buying-cycle window ("Monsoon", "Wedding/Formal", "Sports", or
// whatever the shop actually stocks for) — free text, never a fixed enum,
// same reasoning Product.season itself already established. Association to
// products is a case-insensitive match against Product.season's own value,
// not a foreign key — a product is tagged once, on the ordinary Product
// form (already available for FOOTWEAR via variant_tracking), and both this
// feature and the pre-existing Season/Collection Sell-Through report pick
// it up automatically.
export interface SeasonalCyclePayload {
  name: string
  startMonth: number
  startDay: number
  endMonth: number
  endDay: number
  leadTimeDays?: number
}

export interface SeasonalCycleRecord {
  id: string
  name: string
  startMonth: number
  startDay: number
  endMonth: number
  endDay: number
  leadTimeDays: number
  isActive: boolean
}

function validatePayload(p: SeasonalCyclePayload): string | null {
  if (!p.name?.trim()) return 'Season name is required.'
  if (!Number.isInteger(p.startMonth) || p.startMonth < 1 || p.startMonth > 12) return 'Start month must be between 1 and 12.'
  if (!Number.isInteger(p.endMonth) || p.endMonth < 1 || p.endMonth > 12) return 'End month must be between 1 and 12.'
  if (!Number.isInteger(p.startDay) || p.startDay < 1 || p.startDay > 31) return 'Start day must be between 1 and 31.'
  if (!Number.isInteger(p.endDay) || p.endDay < 1 || p.endDay > 31) return 'End day must be between 1 and 31.'
  if (p.leadTimeDays != null && (!Number.isInteger(p.leadTimeDays) || p.leadTimeDays < 0)) return 'Lead time must be a non-negative number of days.'
  return null
}

export async function listSeasonalCycles(): Promise<{ success: boolean; data?: SeasonalCycleRecord[]; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const rows = await db.seasonalCycle.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
    return { success: true, data: rows }
  } catch (err) {
    return { success: false, error: { code: 'SEASON-001', message: err instanceof Error ? err.message : 'Failed to list seasonal cycles.' } }
  }
}

export async function createSeasonalCycle(
  payload: SeasonalCyclePayload,
  userId?: string
): Promise<{ success: boolean; data?: SeasonalCycleRecord; error?: { code: string; message: string } }> {
  try {
    const err = validatePayload(payload)
    if (err) return { success: false, error: { code: 'SEASON-002', message: err } }

    const db = getPrisma()
    const row = await db.seasonalCycle.create({
      data: {
        name: payload.name.trim(),
        startMonth: payload.startMonth, startDay: payload.startDay,
        endMonth: payload.endMonth, endDay: payload.endDay,
        leadTimeDays: payload.leadTimeDays ?? 30
      }
    })
    await logAction({ userId, action: 'SEASONAL_CYCLE_CREATED', entityType: 'SeasonalCycle', entityId: row.id, newValue: row })
    return { success: true, data: row }
  } catch (err) {
    return { success: false, error: { code: 'SEASON-003', message: err instanceof Error ? err.message : 'Failed to create seasonal cycle.' } }
  }
}

export async function updateSeasonalCycle(
  payload: SeasonalCyclePayload & { id: string },
  userId?: string
): Promise<{ success: boolean; data?: SeasonalCycleRecord; error?: { code: string; message: string } }> {
  try {
    const err = validatePayload(payload)
    if (err) return { success: false, error: { code: 'SEASON-004', message: err } }

    const db = getPrisma()
    const existing = await db.seasonalCycle.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'SEASON-005', message: 'Seasonal cycle not found.' } }

    const row = await db.seasonalCycle.update({
      where: { id: payload.id },
      data: {
        name: payload.name.trim(),
        startMonth: payload.startMonth, startDay: payload.startDay,
        endMonth: payload.endMonth, endDay: payload.endDay,
        leadTimeDays: payload.leadTimeDays ?? 30
      }
    })
    await logAction({ userId, action: 'SEASONAL_CYCLE_UPDATED', entityType: 'SeasonalCycle', entityId: row.id, oldValue: existing, newValue: row })
    return { success: true, data: row }
  } catch (err) {
    return { success: false, error: { code: 'SEASON-006', message: err instanceof Error ? err.message : 'Failed to update seasonal cycle.' } }
  }
}

export async function deleteSeasonalCycle(
  id: string,
  userId?: string
): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const existing = await db.seasonalCycle.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'SEASON-007', message: 'Seasonal cycle not found.' } }

    // Soft delete, same convention every other "definition" row in this
    // codebase uses (Product, Supplier, etc.) — never hard-deleted, so
    // historical reorder-calendar snapshots elsewhere stay meaningful.
    await db.seasonalCycle.update({ where: { id }, data: { isActive: false } })
    await logAction({ userId, action: 'SEASONAL_CYCLE_DELETED', entityType: 'SeasonalCycle', entityId: id, oldValue: existing })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'SEASON-008', message: err instanceof Error ? err.message : 'Failed to delete seasonal cycle.' } }
  }
}

export type ReorderStatus = 'IN_SEASON' | 'REORDER_NOW' | 'UPCOMING'
export interface SeasonalCalendarProduct {
  productId: string
  productName: string
  stockQty: number
  lowOrOutOfStock: boolean
}
export interface SeasonalCalendarEntry {
  id: string
  name: string
  startMonth: number; startDay: number; endMonth: number; endDay: number
  leadTimeDays: number
  status: ReorderStatus
  daysUntilStart: number
  reorderByDate: string
  nextStartDate: string
  products: SeasonalCalendarProduct[]
  lowOrOutOfStockCount: number
}

// Recurring month/day windows can wrap the year boundary (e.g. Nov 15 -> Jan
// 15) — resolved by finding the NEXT occurrence of the window relative to
// "today" (this year's, or next year's if this year's has already fully
// passed), same reasoning a birthday/anniversary reminder needs.
function resolveCycleWindow(cycle: { startMonth: number; startDay: number; endMonth: number; endDay: number }, today: Date) {
  const year = today.getFullYear()
  const start = new Date(year, cycle.startMonth - 1, cycle.startDay)
  const wraps = cycle.endMonth < cycle.startMonth || (cycle.endMonth === cycle.startMonth && cycle.endDay < cycle.startDay)
  let end = new Date(wraps ? year + 1 : year, cycle.endMonth - 1, cycle.endDay)
  end.setHours(23, 59, 59, 999)

  if (today >= start && today <= end) {
    return { start, end, inSeason: true }
  }
  if (today > end) {
    // This year's (or the wrapped year's) window is over — advance to next year's.
    const nextStart = new Date(year + 1, cycle.startMonth - 1, cycle.startDay)
    const nextEnd = new Date(wraps ? year + 2 : year + 1, cycle.endMonth - 1, cycle.endDay)
    nextEnd.setHours(23, 59, 59, 999)
    return { start: nextStart, end: nextEnd, inSeason: false }
  }
  return { start, end, inSeason: false }
}

export async function getSeasonalReorderCalendar(
  lowStockThreshold = 5
): Promise<{ success: boolean; data?: SeasonalCalendarEntry[]; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const cycles = await db.seasonalCycle.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
    if (cycles.length === 0) return { success: true, data: [] }

    const today = new Date()
    const entries: SeasonalCalendarEntry[] = []

    // SQLite's Prisma provider has no reliable case-insensitive `equals`
    // filter — fetched once and matched per-cycle in JS instead, same as
    // every other free-text matching case this codebase has needed.
    const allSeasonedProducts = await db.product.findMany({
      where: { isActive: true, season: { not: null } },
      select: {
        id: true, productName: true, season: true,
        inventory: { select: { quantity: true } },
        variants: { where: { isActive: true }, select: { stockQty: true } }
      }
    })

    for (const cycle of cycles) {
      const { start, inSeason } = resolveCycleWindow(cycle, today)
      const reorderByDate = new Date(start.getTime() - cycle.leadTimeDays * 86400000)
      const status: ReorderStatus = inSeason ? 'IN_SEASON' : (today >= reorderByDate ? 'REORDER_NOW' : 'UPCOMING')
      const daysUntilStart = inSeason ? 0 : Math.max(0, Math.ceil((start.getTime() - today.getTime()) / 86400000))

      const products = allSeasonedProducts.filter(p => p.season?.trim().toLowerCase() === cycle.name.trim().toLowerCase())

      const calProducts: SeasonalCalendarProduct[] = products.map(p => {
        const stockQty = p.variants.length > 0
          ? p.variants.reduce((sum, v) => sum + v.stockQty, 0)
          : (p.inventory?.quantity ?? 0)
        return { productId: p.id, productName: p.productName, stockQty, lowOrOutOfStock: stockQty <= lowStockThreshold }
      })

      entries.push({
        id: cycle.id, name: cycle.name,
        startMonth: cycle.startMonth, startDay: cycle.startDay, endMonth: cycle.endMonth, endDay: cycle.endDay,
        leadTimeDays: cycle.leadTimeDays,
        status, daysUntilStart,
        reorderByDate: toLocalISODate(reorderByDate), nextStartDate: toLocalISODate(start),
        products: calProducts,
        lowOrOutOfStockCount: calProducts.filter(p => p.lowOrOutOfStock).length
      })
    }

    // Most urgent first — REORDER_NOW ahead of IN_SEASON ahead of UPCOMING,
    // then soonest start date within each group.
    const rank: Record<ReorderStatus, number> = { REORDER_NOW: 0, IN_SEASON: 1, UPCOMING: 2 }
    entries.sort((a, b) => rank[a.status] - rank[b.status] || a.daysUntilStart - b.daysUntilStart)

    return { success: true, data: entries }
  } catch (err) {
    return { success: false, error: { code: 'SEASON-009', message: err instanceof Error ? err.message : 'Failed to compute seasonal reorder calendar.' } }
  }
}
