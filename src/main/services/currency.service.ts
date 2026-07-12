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
