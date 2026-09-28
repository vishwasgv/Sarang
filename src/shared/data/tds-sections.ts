// Common TDS sections offered as suggestions on a supplier payment. Rates are typical figures for
// illustration; the rate that applies depends on the payee, the PAN and the year, so the owner and their
// accountant decide. The section text a payment stores is free, so a section not listed here still works.
// The Income-tax Act 2025 (in force 1 April 2026) folds these sections into section 393(1); `newRef` is the
// matching serial (rates carried over unchanged, checked 2026-09-28 against two published mappings). The
// stored value stays the familiar section number so older payments group with newer ones in the TDS report.

export interface TdsSection {
  code: string
  label: string
  typicalRatePercent: number
  /** Section 393(1) reference under the Income-tax Act 2025, for payments made on or after 1 April 2026. */
  newRef: string
}

export const TDS_SECTIONS: readonly TdsSection[] = [
  { code: '194C', label: 'Contractors and sub-contractors', typicalRatePercent: 1, newRef: '393(1) Sl.6(i)' },
  { code: '194H', label: 'Commission or brokerage', typicalRatePercent: 2, newRef: '393(1) Sl.1(ii)' },
  { code: '194I(a)', label: 'Rent of plant and machinery', typicalRatePercent: 2, newRef: '393(1) Sl.2(ii)' },
  { code: '194I(b)', label: 'Rent of land, building or furniture', typicalRatePercent: 10, newRef: '393(1) Sl.2(ii)' },
  { code: '194J', label: 'Professional or technical fees', typicalRatePercent: 10, newRef: '393(1) Sl.6(iii)' },
  { code: '194A', label: 'Interest other than on securities', typicalRatePercent: 10, newRef: '393(1) Sl.5(ii)' },
  { code: '194Q', label: 'Purchase of goods', typicalRatePercent: 0.1, newRef: '393(1) Sl.8(ii)' }
]

/** Groups free-text section entries: trims, upper-cases, and shows a blank entry as "Not given". */
export function normalizeTdsSection(raw: string | null | undefined): string {
  const v = (raw ?? '').trim().toUpperCase()
  return v === '' ? 'NOT GIVEN' : v
}
