import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { toLocalISODate } from '../utils/date.util'

// Phase 67 §9.1 — Agri Inputs item 1: crop-season-aligned credit terms. A
// shop-defined RECURRING harvest date (never a fixed enum — "Kharif",
// "Rabi", "Zaid", or genuinely anything a shop's own region calls it), used
// to compute a CREDIT invoice's real due date from an actual harvest
// occurrence instead of a cashier typing an arbitrary date or counting
// 30/60/90 days on the calendar.
export interface CropSeasonPayload {
  name: string
  harvestMonth: number
  harvestDay: number
}

export interface CropSeasonRecord {
  id: string
  name: string
  harvestMonth: number
  harvestDay: number
  isActive: boolean
}

function validatePayload(p: CropSeasonPayload): string | null {
  if (!p.name?.trim()) return 'Season name is required.'
  if (!Number.isInteger(p.harvestMonth) || p.harvestMonth < 1 || p.harvestMonth > 12) return 'Harvest month must be between 1 and 12.'
  if (!Number.isInteger(p.harvestDay) || p.harvestDay < 1 || p.harvestDay > 31) return 'Harvest day must be between 1 and 31.'
  return null
}

export async function listCropSeasons(): Promise<{ success: boolean; data?: CropSeasonRecord[]; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const rows = await db.cropSeason.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
    return { success: true, data: rows }
  } catch (err) {
    return { success: false, error: { code: 'CROP-001', message: err instanceof Error ? err.message : 'Failed to list crop seasons.' } }
  }
}

export async function createCropSeason(
  payload: CropSeasonPayload,
  userId?: string
): Promise<{ success: boolean; data?: CropSeasonRecord; error?: { code: string; message: string } }> {
  try {
    const err = validatePayload(payload)
    if (err) return { success: false, error: { code: 'CROP-002', message: err } }

    const db = getPrisma()
    const row = await db.cropSeason.create({ data: { name: payload.name.trim(), harvestMonth: payload.harvestMonth, harvestDay: payload.harvestDay } })
    await logAction({ userId, action: 'CROP_SEASON_CREATED', entityType: 'CropSeason', entityId: row.id, newValue: row })
    return { success: true, data: row }
  } catch (err) {
    return { success: false, error: { code: 'CROP-003', message: err instanceof Error ? err.message : 'Failed to create crop season.' } }
  }
}

export async function updateCropSeason(
  payload: CropSeasonPayload & { id: string },
  userId?: string
): Promise<{ success: boolean; data?: CropSeasonRecord; error?: { code: string; message: string } }> {
  try {
    const err = validatePayload(payload)
    if (err) return { success: false, error: { code: 'CROP-004', message: err } }

    const db = getPrisma()
    const existing = await db.cropSeason.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'CROP-005', message: 'Crop season not found.' } }

    const row = await db.cropSeason.update({
      where: { id: payload.id },
      data: { name: payload.name.trim(), harvestMonth: payload.harvestMonth, harvestDay: payload.harvestDay }
    })
    await logAction({ userId, action: 'CROP_SEASON_UPDATED', entityType: 'CropSeason', entityId: row.id, oldValue: existing, newValue: row })
    return { success: true, data: row }
  } catch (err) {
    return { success: false, error: { code: 'CROP-006', message: err instanceof Error ? err.message : 'Failed to update crop season.' } }
  }
}

export async function deleteCropSeason(
  id: string,
  userId?: string
): Promise<{ success: boolean; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const existing = await db.cropSeason.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'CROP-007', message: 'Crop season not found.' } }

    // Soft delete, same convention every other shop-defined "definition" row
    // in this codebase uses — invoices already linked to it keep a real,
    // meaningful cropSeasonId even after the season is retired.
    await db.cropSeason.update({ where: { id }, data: { isActive: false } })
    await logAction({ userId, action: 'CROP_SEASON_DELETED', entityType: 'CropSeason', entityId: id, oldValue: existing })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'CROP-008', message: err instanceof Error ? err.message : 'Failed to delete crop season.' } }
  }
}

// Resolves a recurring month/day to its NEXT real occurrence relative to
// "today" (this year's, or next year's if this year's has already passed) —
// same reasoning Footwear's own SeasonalCycle needed for its buying-cycle
// windows, but simpler here: a single target date, no start/end range.
export function resolveNextHarvestDate(season: { harvestMonth: number; harvestDay: number }, today: Date = new Date()): Date {
  const year = today.getFullYear()
  const thisYear = new Date(year, season.harvestMonth - 1, season.harvestDay)
  thisYear.setHours(23, 59, 59, 999)
  if (thisYear >= today) return new Date(year, season.harvestMonth - 1, season.harvestDay)
  return new Date(year + 1, season.harvestMonth - 1, season.harvestDay)
}

export async function resolveCropSeasonDueDate(
  cropSeasonId: string
): Promise<{ success: boolean; data?: { dueDate: string }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const season = await db.cropSeason.findUnique({ where: { id: cropSeasonId } })
    if (!season) return { success: false, error: { code: 'CROP-009', message: 'Crop season not found.' } }
    const dueDate = resolveNextHarvestDate(season)
    return { success: true, data: { dueDate: toLocalISODate(dueDate) } }
  } catch (err) {
    return { success: false, error: { code: 'CROP-010', message: err instanceof Error ? err.message : 'Failed to resolve the due date for this crop season.' } }
  }
}
