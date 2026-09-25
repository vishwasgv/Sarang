import { gstPresentationLines, type GstRateTax } from '../../../../shared/utils/gst-presentation'
import { taxLabelForCountry } from '../../../../shared/data/tax-presets'

// The business's country, kept here by the business store, so a UK shop's tax line says VAT, an Australian shop's
// says GST and a Dutch shop's says BTW without every caller passing the country.
let activeCountry: string | null = null
export function setActiveTaxCountry(country: string | null | undefined): void {
  activeCountry = country ?? null
}

/** Returns the short label for a tax model (used in UI and print). */
export function getTaxLabel(taxModel: string): string {
  const local = taxLabelForCountry(activeCountry, taxModel)
  if (local) return local
  switch (taxModel) {
    case 'GST': return 'GST'
    case 'VAT': return 'VAT'
    case 'SALES_TAX': return 'Sales Tax'
    case 'CUSTOM': return 'Tax'
    default: return 'Tax'
  }
}

/** "CGST 9.00, SGST 9.00" for a message body; empty when there is no tax. */
export function taxLinesText(lines: Array<{ label: string; amount: number }>, format: (n: number) => string): string {
  return lines.map(l => `${l.label} ${format(l.amount)}`).join(', ')
}

/** Display lines for a tax amount. For GST the document's own gstType decides: CGST + SGST (split exactly,
 *  per rate when rateTaxes is given), a single IGST line, or a single combined GST line. The lines always
 *  add back to taxAmount. All other models show one line. */
export function splitTaxLines(taxModel: string, taxAmount: number, gstType?: string | null, decimals = 2, rateTaxes?: GstRateTax[]): Array<{ label: string; amount: number }> {
  if (!(taxAmount > 0)) return []
  if (taxModel === 'GST') return gstPresentationLines(gstType, taxAmount, decimals, rateTaxes)
  return [{ label: getTaxLabel(taxModel), amount: taxAmount }]
}
