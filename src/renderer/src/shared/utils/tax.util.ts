/** Returns the short label for a tax model (used in UI and print). */
export function getTaxLabel(taxModel: string): string {
  switch (taxModel) {
    case 'GST': return 'GST'
    case 'VAT': return 'VAT'
    case 'SALES_TAX': return 'Sales Tax'
    case 'CUSTOM': return 'Tax'
    default: return 'Tax'
  }
}

/** Splits a tax amount into display lines based on the active tax model and,
 *  for GST, the invoice's own gstType. GST + intra-state → CGST + SGST (50/50).
 *  GST + inter-state (IGST) → single IGST line — showing CGST/SGST on an
 *  inter-state sale is legally incorrect under GST. All other models → single line. */
export function splitTaxLines(taxModel: string, taxAmount: number, gstType?: string | null): Array<{ label: string; amount: number }> {
  if (taxAmount <= 0) return []
  if (taxModel === 'GST') {
    if (gstType === 'IGST') return [{ label: 'IGST', amount: taxAmount }]
    // Round CGST down to the paisa and give SGST the remainder, instead of
    // splitting in plain float division (e.g. 0.03/2 → 0.015 displays as an
    // awkward third decimal on one or both lines). The two lines still sum
    // to exactly taxAmount.
    const cgst = Math.floor(taxAmount * 50) / 100
    const sgst = Math.round((taxAmount - cgst) * 100) / 100
    return [
      { label: 'CGST', amount: cgst },
      { label: 'SGST', amount: sgst }
    ]
  }
  return [{ label: getTaxLabel(taxModel), amount: taxAmount }]
}
