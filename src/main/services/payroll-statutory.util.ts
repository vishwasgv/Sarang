import { roundCurrency } from './currency.service'

// PF, ESI and Professional Tax the way the business has configured them (rates are the owner's, never built in).

export interface StatutoryConfig {
  statutoryPfPercent: number | null
  statutoryEsiPercent: number | null
  statutoryEsiWageCeiling: number | null
  statutoryProfessionalTax: number | null
}

export interface StatutoryAmounts {
  pf: number | null
  esi: number | null
  professionalTax: number | null
}

/** What the configured rates say should be deducted from this basic salary; null where a head is not configured. */
export function expectedStatutory(basic: number, cfg: StatutoryConfig): StatutoryAmounts {
  const pf = cfg.statutoryPfPercent && cfg.statutoryPfPercent > 0 ? roundCurrency(basic * (cfg.statutoryPfPercent / 100)) : null
  let esi: number | null = null
  if (cfg.statutoryEsiPercent && cfg.statutoryEsiPercent > 0) {
    const eligible = !cfg.statutoryEsiWageCeiling || basic <= cfg.statutoryEsiWageCeiling
    esi = eligible ? roundCurrency(basic * (cfg.statutoryEsiPercent / 100)) : 0
  }
  const professionalTax = cfg.statutoryProfessionalTax && cfg.statutoryProfessionalTax > 0 ? roundCurrency(cfg.statutoryProfessionalTax) : null
  return { pf, esi, professionalTax }
}

export type StatutoryHead = 'pf' | 'esi' | 'professionalTax' | 'other'

/** Sorts deduction lines from a payslip into the statutory heads by their names; anything else is "other". */
export function splitDeductions(lines: Array<{ name: string; amount: number }>): Record<StatutoryHead, number> {
  const out: Record<StatutoryHead, number> = { pf: 0, esi: 0, professionalTax: 0, other: 0 }
  for (const l of lines) {
    if (!l || !(l.amount > 0)) continue
    const n = String(l.name ?? '').trim().toLowerCase()
    const head: StatutoryHead = n === 'pf' || n === 'provident fund' || n === 'epf' ? 'pf' : n === 'esi' || n === 'esic' ? 'esi' : n === 'professional tax' || n === 'pt' ? 'professionalTax' : 'other'
    out[head] = roundCurrency(out[head] + l.amount)
  }
  return out
}
