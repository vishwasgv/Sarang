import { computeDocumentTotals } from '../../../../shared/utils/money'
import type { MoneyContext } from './money-context.util'

export interface CartTotalsLine {
  quantity: number
  unitPrice: number
  discountAmount: number
  taxRate: number
  isFreeOfCost?: boolean
}

// The invoice total shown to the cashier. Runs the SAME shared money module the backend's
// createInvoice uses (src/shared/utils/money.ts) with the same inputs (currency decimals,
// invoice_rounding_rule, per-line tax zeroing for free-of-cost lines / tax-exempt customers /
// Composition-scheme businesses), so the total shown is exactly the total that gets saved.
export function computeCartTotals(items: CartTotalsLine[], globalDiscount: number, ctx: MoneyContext, customerTaxExempt = false, pricesIncludeTax = false) {
  const zeroTax = customerTaxExempt || ctx.compositionScheme
  const t = computeDocumentTotals(
    items.map(i => i.isFreeOfCost
      ? { quantity: i.quantity, unitPrice: 0, discountAmount: 0, taxRate: 0 }
      : { quantity: i.quantity, unitPrice: i.unitPrice, discountAmount: i.discountAmount, taxRate: zeroTax ? 0 : i.taxRate }),
    { decimals: ctx.decimals, roundingRule: ctx.roundingRule, globalDiscount, pricesIncludeTax }
  )
  return { subtotal: t.subtotal, discountAmount: t.discountAmount, taxAmount: t.taxAmount, roundingAmount: t.roundingAmount, totalAmount: t.totalAmount, lines: t.lines }
}
