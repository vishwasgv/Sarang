import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { getCurrentSession } from './auth.service'
import { INDIA_GST_SLABS, INDIA_GST_SPLIT_CONFIGS, addMissingIndiaSlabs, addMissingIndiaSplitRows } from './india-gst-slabs.service'
import { getTaxPreset, type TaxPreset } from '../../shared/data/tax-presets'
import type { ApiResponse } from '../ipc/channels'

type TaxDb = Pick<ReturnType<typeof getPrisma>, 'taxConfiguration'>

interface PlannedRate { taxName: string; taxType: string; rate: number; country: string; isDefault: boolean }

/**
 * Rates of the preset that the business does not have yet. A rate is skipped when a row with the same name and
 * type exists (active or not), or, for a non-zero rate, when a row of that type already carries the rate under
 * another name (an owner may have renamed it). Zero rates are matched by name only, because zero-rated,
 * exempt and nil-rated rows all carry 0.
 */
async function planMissingRates(db: TaxDb, preset: TaxPreset): Promise<PlannedRate[]> {
  if (preset.taxModel === 'NONE') return []
  const taxType = preset.taxModel
  let hasDefault = !!(await db.taxConfiguration.findFirst({ where: { taxType, isDefault: true, isActive: true } }))
  const planned: PlannedRate[] = []
  for (const rate of preset.rates) {
    const sameName = await db.taxConfiguration.findFirst({ where: { taxName: rate.name, taxType } })
    if (sameName) continue
    if (rate.rate > 0) {
      const sameRate = await db.taxConfiguration.findFirst({ where: { taxType, rate: rate.rate } })
      if (sameRate) continue
    }
    const makeDefault = rate.isDefault === true && !hasDefault
    if (makeDefault) hasDefault = true
    planned.push({ taxName: rate.name, taxType, rate: rate.rate, country: preset.code, isDefault: makeDefault })
  }
  return planned
}

/**
 * Adds the preset's missing rates. Idempotent: never deletes, renames, re-activates or changes an existing row,
 * and never touches a document. India adds its GST slabs and split rows through the India routines.
 */
export async function addMissingPresetRates(db: TaxDb, preset: TaxPreset): Promise<number> {
  if (preset.code === 'IN') return (await addMissingIndiaSlabs(db)) + (await addMissingIndiaSplitRows(db))
  const planned = await planMissingRates(db, preset)
  for (const p of planned) await db.taxConfiguration.create({ data: { ...p, isActive: true } })
  return planned.length
}

export interface TaxPresetStatus {
  hasPreset: boolean
  country: string
  code: string | null
  name: string | null
  taxLabel: string | null
  asOf: string | null
  sources: string[]
  notes: string[]
  languageLock: 'en' | null
  totalRates: number
  missingRates: number
}

/** Status of the preset for THE BUSINESS'S OWN country only; no other country's preset is ever reported. */
export async function getTaxPresetStatus(): Promise<ApiResponse<TaxPresetStatus>> {
  try {
    const db = getPrisma()
    const profile = await db.businessProfile.findFirst({ select: { country: true } })
    const country = profile?.country ?? ''
    const preset = getTaxPreset(country)
    if (!preset) {
      return { success: true, data: { hasPreset: false, country, code: null, name: null, taxLabel: null, asOf: null, sources: [], notes: [], languageLock: null, totalRates: 0, missingRates: 0 } }
    }
    const missing = preset.code === 'IN'
      ? await countMissingIndia(db)
      : (await planMissingRates(db, preset)).length
    return {
      success: true,
      data: {
        hasPreset: true, country, code: preset.code, name: preset.name, taxLabel: preset.taxLabel, asOf: preset.asOf,
        sources: preset.sources, notes: preset.notes ?? [], languageLock: preset.languageLock,
        totalRates: preset.rates.length, missingRates: missing
      }
    }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

async function countMissingIndia(db: TaxDb): Promise<number> {
  let missing = 0
  for (const s of INDIA_GST_SLABS) {
    const byRate = await db.taxConfiguration.findFirst({ where: { taxType: 'GST', rate: s.rate } })
    const byName = byRate ? null : await db.taxConfiguration.findFirst({ where: { taxName: s.taxName, taxType: 'GST' } })
    if (!byRate && !byName) missing++
  }
  for (const c of INDIA_GST_SPLIT_CONFIGS) {
    if (!(await db.taxConfiguration.findFirst({ where: { taxName: c.taxName, taxType: c.taxType } }))) missing++
  }
  return missing
}

/** Loads the missing rates for the business's own country. The country is never taken from the caller. */
export async function loadTaxPresetForBusiness(): Promise<ApiResponse<{ added: number; name: string }>> {
  try {
    const db = getPrisma()
    const profile = await db.businessProfile.findFirst({ select: { country: true } })
    const preset = getTaxPreset(profile?.country)
    if (!preset) return { success: false, error: { code: 'TAX-010', message: 'There are no ready-made tax rates for your country. Add your rates with Add Tax.' } }
    const added = await db.$transaction(async (tx) => addMissingPresetRates(tx, preset))
    await logAction({ userId: getCurrentSession()?.userId, action: 'TAX_PRESET_LOADED', entityType: 'TaxConfiguration', newValue: { country: preset.code, added } })
    return { success: true, data: { added, name: preset.name } }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}
