// Currency formatting + money-math engine — used by service layer for
// invoicing, reports, and everywhere else amounts are computed or displayed.
// Renderer uses currency.util.ts via Zustand store for display-only formatting.
//
// All arithmetic below runs on Prisma.Decimal (decimal.js, already bundled
// with @prisma/client — no extra dependency) instead of plain JS numbers.
// IEEE754 doubles cannot represent most decimal fractions exactly (the
// classic 0.1 + 0.2 !== 0.3 problem), and that representation error
// compounds across multi-line invoices — summing dozens of line taxes/totals
// with `+=` on floats can land a fraction of a cent off. Decimal instances
// are only converted to `number` once, at the very end of each function,
// which is safe because nothing further is computed from that value here.
import { Prisma } from '@prisma/client'

const { Decimal } = Prisma
type DecimalInput = number | string | Prisma.Decimal

const LOCALE_MAP: Record<string, string> = {
  IN: 'en-IN',
  US: 'en-US',
  EU: 'de-DE',
  UK: 'en-GB'
}

// ISO 4217 currencies whose minor unit isn't 2 decimal places. Rounding a
// JPY or KRW invoice to "100.00" is wrong (they have no subunit in practice);
// rounding a BHD/KWD/OMR invoice to 2dp silently drops real fils/baisa value.
// Every currency not listed here defaults to 2, which covers the vast
// majority (USD, EUR, GBP, INR, AED, SGD, ...).
const ZERO_DECIMAL_CURRENCIES = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF'])
const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND'])

export function getCurrencyDecimals(currencyCode?: string | null): number {
  if (!currencyCode) return 2
  if (ZERO_DECIMAL_CURRENCIES.has(currencyCode)) return 0
  if (THREE_DECIMAL_CURRENCIES.has(currencyCode)) return 3
  return 2
}

export function formatAmount(amount: number, currencySymbol: string, numberFormat = 'IN', decimals = 2, symbolPosition: 'prefix' | 'suffix' = 'prefix'): string {
  try {
    const locale = LOCALE_MAP[numberFormat] ?? 'en-IN'
    const formatted = new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(amount)
    return symbolPosition === 'suffix' ? `${formatted}${currencySymbol}` : `${currencySymbol}${formatted}`
  } catch {
    return symbolPosition === 'suffix' ? `${amount.toFixed(decimals)}${currencySymbol}` : `${currencySymbol}${amount.toFixed(decimals)}`
  }
}

export function roundCurrency(amount: DecimalInput, decimals = 2): number {
  return new Decimal(amount).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber()
}

export function calculateTax(amount: DecimalInput, taxRate: DecimalInput, decimals = 2): number {
  return new Decimal(amount).mul(taxRate).div(100).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber()
}

// Sums a list of amounts using Decimal addition throughout, only converting
// to `number` on the final result — avoids the drift that `array.reduce((s,
// x) => s + x, 0)` accumulates when done on plain floats.
export function sumCurrency(amounts: DecimalInput[], decimals = 2): number {
  const total = amounts.reduce((acc: Prisma.Decimal, x) => acc.add(new Decimal(x)), new Decimal(0))
  return total.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP).toNumber()
}

export function calculateLineTotal(qty: DecimalInput, unitPrice: DecimalInput, discountAmount: DecimalInput = 0, taxRate: DecimalInput = 0, decimals = 2): {
  subtotal: number
  discountAmount: number
  taxAmount: number
  lineTotal: number
} {
  const subtotalD = new Decimal(qty).mul(unitPrice).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP)
  const discountD = Decimal.min(new Decimal(discountAmount), subtotalD).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP)
  const taxableD = subtotalD.sub(discountD)
  const taxAmountD = taxableD.mul(taxRate).div(100).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP)
  const lineTotalD = taxableD.add(taxAmountD)
  return {
    subtotal: subtotalD.toNumber(),
    discountAmount: discountD.toNumber(),
    taxAmount: taxAmountD.toNumber(),
    lineTotal: lineTotalD.toNumber()
  }
}

// Fresh-audit fix (2026-08-11) — real GST compliance bug: a global/invoice-level
// discount (BillingScreen.tsx's globalDiscount field) was previously subtracted
// from the total only AFTER tax, so GST was charged on the pre-discount subtotal
// even though Section 15(3) CGST Act excludes a discount recorded on the invoice
// at time of supply from the value of supply. Per-line discounts already flowed
// correctly into tax (calculateLineTotal above) — this function closes the same
// gap for the invoice-level case.
//
// A flat global discount can't just be subtracted from the summed tax, because
// lines can carry different tax rates — it has to be allocated proportionally to
// each line's own taxable value first, then tax recomputed per line on the
// reduced base, the same way a mixed-rate invoice is actually required to be
// split. The last line absorbs whatever rounding remainder is left so the sum of
// allocated shares exactly equals the global discount to the paisa — the same
// remainder-absorption convention tax.util.ts already uses for CGST/SGST.
export function allocateGlobalDiscount(
  items: { lineTaxable: DecimalInput; taxRate: DecimalInput }[],
  globalDiscount: DecimalInput,
  decimals = 2
): { lineTaxable: number; lineTax: number }[] {
  const gd = new Decimal(globalDiscount).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP)
  const totalTaxableD = items.reduce((acc, i) => acc.add(new Decimal(i.lineTaxable)), new Decimal(0))

  if (gd.lte(0) || totalTaxableD.lte(0) || items.length === 0) {
    // No global discount to allocate — recompute tax from each line's own
    // taxable base unchanged, so this is a true no-op for the common case.
    return items.map(i => {
      const taxableD = new Decimal(i.lineTaxable).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP)
      const taxD = taxableD.mul(i.taxRate).div(100).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP)
      return { lineTaxable: taxableD.toNumber(), lineTax: taxD.toNumber() }
    })
  }

  let allocatedSoFar = new Decimal(0)
  return items.map((item, idx) => {
    const taxableD = new Decimal(item.lineTaxable).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP)
    const isLast = idx === items.length - 1
    const shareD = isLast
      ? gd.sub(allocatedSoFar)
      : gd.mul(taxableD).div(totalTaxableD).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP)
    if (!isLast) allocatedSoFar = allocatedSoFar.add(shareD)
    const newTaxableD = Decimal.max(0, taxableD.sub(shareD))
    const newTaxD = newTaxableD.mul(item.taxRate).div(100).toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP)
    return { lineTaxable: newTaxableD.toNumber(), lineTax: newTaxD.toNumber() }
  })
}
