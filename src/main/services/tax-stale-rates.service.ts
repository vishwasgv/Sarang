import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { getCurrentSession } from './auth.service'
import { getTaxPreset, resolveCountryCode, type TaxPreset } from '../../shared/data/tax-presets'
import type { ApiResponse } from '../ipc/channels'

// Older installs outside India were given the rates the app used to seed for everyone (India GST and split
// rows, a VAT 20% row, a Sales Tax 8% row). They stay unless the owner confirms; this lists them and turns
// the confirmed ones off. Rows are only deactivated, never deleted, and documents keep their stored tax.

export interface StaleRate {
  id: string
  taxName: string
  taxType: string
  rate: number
  isDefault: boolean
}

interface RateRow { taxName: string; taxType: string; rate: number }

const SPLIT_NAME = /^(CGST|SGST|IGST) @ [\d.]+%$/
const INDIA_GST_NAMES = new Set(['GST Exempt', 'GST 0%', 'GST 5%', 'GST 12%', 'GST 18%', 'GST 28%'])

/** True when the row is one the app seeded years ago for every business regardless of country. */
export function isOldSeededRate(r: RateRow): boolean {
  if (SPLIT_NAME.test(r.taxName) && ['CGST', 'SGST', 'IGST'].includes(r.taxType)) return true
  if (r.taxType === 'GST' && INDIA_GST_NAMES.has(r.taxName)) return true
  if (r.taxType === 'VAT' && r.taxName === 'VAT 20%' && r.rate === 20) return true
  if (r.taxType === 'SALES_TAX' && r.taxName === 'Sales Tax' && r.rate === 8) return true
  return false
}

/** An old seeded row is stale for a business when its own country's preset has no rate of that type and value. */
export function isStaleForCountry(r: RateRow, preset: TaxPreset | null, countryCode: string | null): boolean {
  if (!countryCode || countryCode === 'IN') return false
  if (!isOldSeededRate(r)) return false
  if (['CGST', 'SGST', 'IGST'].includes(r.taxType)) return true
  const model = preset?.taxModel
  return !(model === r.taxType && preset!.rates.some((p) => p.rate === r.rate))
}

async function candidates(): Promise<StaleRate[]> {
  const db = getPrisma()
  const profile = await db.businessProfile.findFirst({ select: { country: true } })
  const code = resolveCountryCode(profile?.country)
  const preset = getTaxPreset(profile?.country)
  const rows = await db.taxConfiguration.findMany({ where: { isActive: true }, orderBy: [{ taxType: 'asc' }, { rate: 'asc' }] })
  return rows
    .filter((r) => isStaleForCountry(r, preset, code))
    .map((r) => ({ id: r.id, taxName: r.taxName, taxType: r.taxType, rate: r.rate, isDefault: r.isDefault }))
}

export async function listStaleSeededRates(): Promise<ApiResponse<StaleRate[]>> {
  try {
    return { success: true, data: await candidates() }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

/** Turns off the chosen rows, but only those that are still stale for the business's own country. */
export async function deactivateStaleRates(ids: string[]): Promise<ApiResponse<{ deactivated: number }>> {
  try {
    const allowed = new Set((await candidates()).map((c) => c.id))
    const chosen = ids.filter((id) => allowed.has(id))
    if (chosen.length === 0) return { success: true, data: { deactivated: 0 } }
    const db = getPrisma()
    const result = await db.taxConfiguration.updateMany({ where: { id: { in: chosen } }, data: { isActive: false, isDefault: false } })
    await logAction({ userId: getCurrentSession()?.userId, action: 'TAX_STALE_RATES_DEACTIVATED', entityType: 'TaxConfiguration', newValue: { count: result.count } })
    return { success: true, data: { deactivated: result.count } }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}
