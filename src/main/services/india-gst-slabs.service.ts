import { getPrisma } from '../database/db'
import { isIndiaCountry } from '../../shared/data/tax-presets'

type TaxDb = Pick<ReturnType<typeof getPrisma>, 'taxConfiguration'>

// India GST rate structure in force from 22 September 2025: 5, 18 and 40 percent working rates plus nil,
// with special rates of 3 percent (gold, silver, jewellery) and 0.25 percent (rough diamonds).
// 12 and 28 percent were withdrawn on that date.
export const INDIA_GST_SLABS: ReadonlyArray<{ taxName: string; rate: number; isDefault?: boolean }> = [
  { taxName: 'GST 0%', rate: 0 },
  { taxName: 'GST 5%', rate: 5 },
  { taxName: 'GST 18%', rate: 18, isDefault: true },
  { taxName: 'GST 40%', rate: 40 },
  { taxName: 'GST 3%', rate: 3 },
  { taxName: 'GST 0.25%', rate: 0.25 }
]

// CGST and SGST halves of the slabs above (and the exempt row), shown as separate rows for India only.
export const INDIA_GST_SPLIT_CONFIGS: ReadonlyArray<{ taxName: string; taxType: string; rate: number }> = [
  { taxName: 'GST Exempt', taxType: 'GST', rate: 0 },
  { taxName: 'CGST @ 0.125%', taxType: 'CGST', rate: 0.125 },
  { taxName: 'SGST @ 0.125%', taxType: 'SGST', rate: 0.125 },
  { taxName: 'CGST @ 1.5%', taxType: 'CGST', rate: 1.5 },
  { taxName: 'SGST @ 1.5%', taxType: 'SGST', rate: 1.5 },
  { taxName: 'CGST @ 2.5%', taxType: 'CGST', rate: 2.5 },
  { taxName: 'SGST @ 2.5%', taxType: 'SGST', rate: 2.5 },
  { taxName: 'CGST @ 9%', taxType: 'CGST', rate: 9 },
  { taxName: 'SGST @ 9%', taxType: 'SGST', rate: 9 },
  { taxName: 'CGST @ 20%', taxType: 'CGST', rate: 20 },
  { taxName: 'SGST @ 20%', taxType: 'SGST', rate: 20 }
]

// Rates withdrawn on 22 September 2025, as the combined GST rate and as its CGST/SGST half.
export const INDIA_GST_WITHDRAWN_RATES: ReadonlyArray<number> = [12, 28]
const WITHDRAWN_HALVES: ReadonlyArray<number> = [6, 14]

/** Adds the CGST and SGST half rows and the exempt row that are missing. India only: callers check the country. */
export async function addMissingIndiaSplitRows(db: TaxDb): Promise<number> {
  let added = 0
  for (const cfg of INDIA_GST_SPLIT_CONFIGS) {
    const existing = await db.taxConfiguration.findFirst({ where: { taxName: cfg.taxName, taxType: cfg.taxType } })
    if (!existing) {
      await db.taxConfiguration.create({ data: { ...cfg, country: 'IN', isActive: true } })
      added++
    }
  }
  return added
}

/** Adds the current GST slabs that are missing (matched by rate, so a renamed or deactivated row is left alone). India only. */
export async function addMissingIndiaSlabs(db: TaxDb): Promise<number> {
  let added = 0
  for (const slab of INDIA_GST_SLABS) {
    const existing = await db.taxConfiguration.findFirst({ where: { taxType: 'GST', rate: slab.rate } })
    if (existing) continue
    const nameTaken = await db.taxConfiguration.findFirst({ where: { taxName: slab.taxName, taxType: 'GST' } })
    if (nameTaken) continue
    const hasDefault = await db.taxConfiguration.findFirst({ where: { taxType: 'GST', isDefault: true, isActive: true } })
    await db.taxConfiguration.create({ data: { taxName: slab.taxName, taxType: 'GST', rate: slab.rate, country: 'IN', isDefault: slab.isDefault === true && !hasDefault, isActive: true } })
    added++
  }
  return added
}

/**
 * Idempotent startup routine for an existing India GST business: adds the current slabs that are
 * missing and marks the withdrawn 12 and 28 percent rows as older rates (isLegacy). Never deletes, renames or
 * re-activates a row, and never changes a document: old documents keep their stored rates. Does nothing for a
 * business outside India, and nothing before a business exists, so no other country ever gets India rows.
 * The country is free text ("India", "IN", "india"), so it is resolved, not compared exactly.
 */
export async function refreshIndiaGstSlabs(): Promise<void> {
  const db = getPrisma()
  const profile = await db.businessProfile.findFirst({ select: { country: true, taxModel: true } })
  if (!profile || !isIndiaCountry(profile.country)) return

  if (profile.taxModel !== 'GST') return
  await addMissingIndiaSlabs(db)

  await db.taxConfiguration.updateMany({
    where: { isLegacy: false, OR: [{ taxType: 'GST', rate: { in: [...INDIA_GST_WITHDRAWN_RATES] } }, { taxType: { in: ['CGST', 'SGST'] }, rate: { in: [...WITHDRAWN_HALVES] } }] },
    data: { isLegacy: true }
  })
}
