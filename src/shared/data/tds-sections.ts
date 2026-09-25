// Common TDS sections offered as suggestions on a supplier payment. Rates are typical figures for
// illustration; the rate that applies depends on the payee, the PAN and the year, so the owner and their
// accountant decide. The section text a payment stores is free, so a section not listed here still works.

export interface TdsSection {
  code: string
  label: string
  typicalRatePercent: number
}

export const TDS_SECTIONS: readonly TdsSection[] = [
  { code: '194C', label: 'Contractors and sub-contractors', typicalRatePercent: 1 },
  { code: '194H', label: 'Commission or brokerage', typicalRatePercent: 2 },
  { code: '194I(a)', label: 'Rent of plant and machinery', typicalRatePercent: 2 },
  { code: '194I(b)', label: 'Rent of land, building or furniture', typicalRatePercent: 10 },
  { code: '194J', label: 'Professional or technical fees', typicalRatePercent: 10 },
  { code: '194A', label: 'Interest other than on securities', typicalRatePercent: 10 },
  { code: '194Q', label: 'Purchase of goods', typicalRatePercent: 0.1 }
]

/** Groups free-text section entries: trims, upper-cases, and shows a blank entry as "Not given". */
export function normalizeTdsSection(raw: string | null | undefined): string {
  const v = (raw ?? '').trim().toUpperCase()
  return v === '' ? 'NOT GIVEN' : v
}
