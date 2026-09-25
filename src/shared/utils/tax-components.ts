// A tax rate can be made up of named parts, for example a 12% rate that is 5% federal GST plus 7% provincial PST.
// The parts are presentation and reporting only: the amount charged always comes from the combined rate in money.ts,
// and these helpers only divide that same amount between the parts, exactly.

import { prorateAmount, roundMoney, sumMoney } from './money'

export interface TaxComponent {
  name: string
  rate: number
}

export interface TaxComponentAmount extends TaxComponent {
  amount: number
}

export function parseTaxComponents(raw: string | null | undefined): TaxComponent[] {
  if (!raw) return []
  try {
    const v: unknown = JSON.parse(raw)
    if (!Array.isArray(v)) return []
    return v
      .filter((c): c is TaxComponent => !!c && typeof c.name === 'string' && c.name.trim() !== '' && typeof c.rate === 'number' && c.rate > 0)
      .map((c) => ({ name: c.name.trim(), rate: c.rate }))
  } catch {
    return []
  }
}

/** Null when the parts are fine (or there are none); otherwise what is wrong. */
export function validateTaxComponents(totalRate: number, components: TaxComponent[]): string | null {
  if (components.length === 0) return null
  if (components.length < 2) return 'Split a rate into at least two parts, or leave the parts empty.'
  if (components.length > 6) return 'A rate can have at most 6 parts.'
  if (components.some((c) => !c.name.trim())) return 'Every part needs a name.'
  if (components.some((c) => !(c.rate > 0))) return 'Every part needs a rate above zero.'
  const names = components.map((c) => c.name.trim().toLowerCase())
  if (new Set(names).size !== names.length) return 'Each part needs a different name.'
  const sum = components.reduce((a, c) => a + c.rate, 0)
  if (Math.abs(sum - totalRate) > 0.0001) return `The parts add up to ${Math.round(sum * 10000) / 10000}% but the rate is ${totalRate}%.`
  return null
}

/** Divides a tax amount between the parts in proportion to their rates; the last part takes the remainder, so the parts always add back to the amount. */
export function splitTaxByComponents(taxAmount: number, components: TaxComponent[], decimals: number): TaxComponentAmount[] {
  if (components.length === 0) return []
  const totalRate = components.reduce((a, c) => a + c.rate, 0)
  const out: TaxComponentAmount[] = []
  let used = 0
  components.forEach((c, i) => {
    const isLast = i === components.length - 1
    const amount = isLast ? roundMoney(taxAmount - used, decimals) : prorateAmount(taxAmount, c.rate, totalRate, decimals)
    used = sumMoney([used, amount], decimals)
    out.push({ ...c, amount })
  })
  return out
}
