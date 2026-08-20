import { getPrisma } from '../database/db'

// Phase 67 §9.1 — General: "Which template fits you?" wizard. Genuinely
// greenfield — no confidence/similarity concept existed anywhere in this
// codebase before this file (confirmed via a dedicated research pass).
// Deliberately scoped to a small set of UNAMBIGUOUS signals rather than a
// full classifier against all 41 BusinessType values: each signal here maps
// to exactly one template and requires a genuine minimum row count, not a
// single stray test product, so a GENERAL business only ever gets a
// suggestion it's actually earned through real usage. If more than one
// signal clears its threshold, the strongest (highest count) wins — never
// show more than one suggestion at once.
export type TemplateSuggestionType = 'HARDWARE' | 'JEWELLERY' | 'RENTAL' | 'RESTAURANT' | 'REPAIR' | 'SERVICE' | 'RETAIL'

export interface TemplateSuggestion {
  businessType: TemplateSuggestionType
  matchedCount: number
  signalKey: 'cartonProducts' | 'jewelleryProducts' | 'rentalProducts' | 'kotOrders' | 'repairJobs' | 'appointments' | 'variantOrLooseProducts'
}

const MIN_BUSINESS_AGE_DAYS = 7

// Each candidate's minimum row count before it's considered a genuine
// pattern rather than incidental/test data.
const THRESHOLDS = {
  cartonProducts: 3,
  jewelleryProducts: 3,
  rentalProducts: 3,
  kotOrders: 3,
  repairJobs: 3,
  appointments: 5,
  variantOrLooseProducts: 5
} as const

async function computeSignalCounts(): Promise<Record<keyof typeof THRESHOLDS, number>> {
  const db = getPrisma()
  const [cartonProducts, jewelleryProducts, rentalProducts, kotOrders, repairTickets, jobCards, appointments, variantProducts, looseProducts] = await Promise.all([
    db.product.count({ where: { isActive: true, sellByPack: true } }),
    db.product.count({ where: { isActive: true, metalType: { not: null } } }),
    db.product.count({ where: { isActive: true, isRentable: true } }),
    db.kOT.count(),
    db.repairTicket.count(),
    db.jobCard.count(),
    db.appointment.count(),
    db.productVariant.count(),
    db.product.count({ where: { isActive: true, sellByWeight: true } })
  ])

  return {
    cartonProducts,
    jewelleryProducts,
    rentalProducts,
    kotOrders,
    repairJobs: repairTickets + jobCards,
    appointments,
    variantOrLooseProducts: variantProducts + looseProducts
  }
}

const SIGNAL_TO_TEMPLATE: Record<keyof typeof THRESHOLDS, TemplateSuggestionType> = {
  cartonProducts: 'HARDWARE',
  jewelleryProducts: 'JEWELLERY',
  rentalProducts: 'RENTAL',
  kotOrders: 'RESTAURANT',
  repairJobs: 'REPAIR',
  appointments: 'SERVICE',
  variantOrLooseProducts: 'RETAIL'
}

export async function getTemplateSuggestion(): Promise<{ success: true; data: TemplateSuggestion | null } | { success: false; error: { code: string; message: string } }> {
  try {
    const db = getPrisma()
    const profile = await db.businessProfile.findFirst({ select: { businessType: true, createdAt: true } })
    if (!profile || profile.businessType !== 'GENERAL') return { success: true, data: null }

    const ageDays = (Date.now() - profile.createdAt.getTime()) / 86400000
    if (ageDays < MIN_BUSINESS_AGE_DAYS) return { success: true, data: null }

    const counts = await computeSignalCounts()

    let best: TemplateSuggestion | null = null
    for (const key of Object.keys(THRESHOLDS) as (keyof typeof THRESHOLDS)[]) {
      const count = counts[key]
      if (count < THRESHOLDS[key]) continue
      if (!best || count > best.matchedCount) {
        best = { businessType: SIGNAL_TO_TEMPLATE[key], matchedCount: count, signalKey: key }
      }
    }

    return { success: true, data: best }
  } catch (err) {
    return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to compute template suggestion.' } }
  }
}
