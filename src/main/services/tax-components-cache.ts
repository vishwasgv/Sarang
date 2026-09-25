import { getPrisma } from '../database/db'
import { parseTaxComponents, splitTaxByComponents, type TaxComponent } from '../../shared/utils/tax-components'
import { sumMoney } from '../../shared/utils/money'

// The named parts of each tax rate that has any (see shared/utils/tax-components.ts), kept in memory so the
// synchronous document templates can show "GST 5% / PST 7%" instead of one "Tax" line.

let byRate = new Map<number, TaxComponent[]>()

const rateKey = (rate: number) => Math.round(rate * 10000) / 10000

export function setTaxComponentsCache(rows: Array<{ rate: number; components: string | null; isDefault?: boolean }>): void {
  const next = new Map<number, TaxComponent[]>()
  // Defaults first so they win when two rates share a value.
  for (const r of [...rows].sort((a, b) => Number(!!b.isDefault) - Number(!!a.isDefault))) {
    const parts = parseTaxComponents(r.components)
    if (parts.length >= 2 && !next.has(rateKey(r.rate))) next.set(rateKey(r.rate), parts)
  }
  byRate = next
}

export async function refreshTaxComponentsCache(): Promise<void> {
  try {
    const rows = await getPrisma().taxConfiguration.findMany({ where: { isActive: true, components: { not: null } }, select: { rate: true, components: true, isDefault: true } })
    setTaxComponentsCache(rows)
  } catch {
    // no parts known: documents keep the single Tax line
  }
}

export function taxComponentsForRate(rate: number): TaxComponent[] {
  return byRate.get(rateKey(rate)) ?? []
}

/**
 * Tax lines for a document broken down by tax parts. Each rate that has parts is split (exactly); tax at any other
 * rate stays in one "Tax" line. Returns null when nothing has parts or the lines do not add up to the document's tax,
 * so the caller keeps its own single line.
 */
export function taxLinesByComponents(
  rateTaxes: Array<{ taxRate: number; taxAmount: number }>,
  documentTax: number,
  decimals: number
): Array<{ label: string; amount: number }> | null {
  if (byRate.size === 0 || rateTaxes.length === 0) return null
  const groups = new Map<number, number[]>()
  for (const r of rateTaxes) {
    if (!(r.taxAmount > 0)) continue
    const k = rateKey(r.taxRate)
    groups.set(k, [...(groups.get(k) ?? []), r.taxAmount])
  }
  const lines: Array<{ label: string; amount: number }> = []
  const other: number[] = []
  let anyParts = false
  for (const [rate, amounts] of groups) {
    const tax = sumMoney(amounts, decimals)
    const parts = taxComponentsForRate(rate)
    if (parts.length === 0) { other.push(tax); continue }
    anyParts = true
    for (const p of splitTaxByComponents(tax, parts, decimals)) {
      const label = `${p.name} ${p.rate}%`
      const existing = lines.find((l) => l.label === label)
      if (existing) existing.amount = sumMoney([existing.amount, p.amount], decimals)
      else lines.push({ label, amount: p.amount })
    }
  }
  if (!anyParts) return null
  if (other.length > 0) lines.push({ label: 'Tax', amount: sumMoney(other, decimals) })
  const total = sumMoney(lines.map((l) => l.amount), decimals)
  return Math.abs(total - documentTax) <= (decimals >= 3 ? 0.002 : 0.02) ? lines.filter((l) => l.amount !== 0) : null
}
