// Currency formatting + money-math engine — used by service layer for
// invoicing, reports, and everywhere else amounts are computed or displayed.
// Renderer uses currency.util.ts via Zustand store for display-only formatting.
//
// All arithmetic is delegated to src/shared/utils/money.ts (exact integer minor
// units, no floating-point drift), the same module the renderer uses.
import {
  computeDocumentTotals,
  getCurrencyDecimals as sharedGetCurrencyDecimals,
  roundMoney,
  sumMoney,
  taxOnAmount
} from '../../shared/utils/money'

// Any number, numeric string or Prisma.Decimal (all stringify to a plain decimal).
type DecimalInput = number | string | { toString(): string }

const LOCALE_MAP: Record<string, string> = {
  IN: 'en-IN',
  US: 'en-US',
  EU: 'de-DE',
  UK: 'en-GB'
}

// Decimal places per ISO 4217 currency (JPY/KRW 0, BHD/KWD/OMR 3, else 2) live in the
// shared money module so the renderer applies the identical table.
export const getCurrencyDecimals = sharedGetCurrencyDecimals

// Decimals of the business's own currency (a business has exactly one), kept here so every amount rounded
// without an explicit `decimals` uses the currency's real minor unit instead of a hard-coded 2. Set by
// getBusinessCurrencyDecimals() (called at startup and by money flows); defaults to 2 until known.
let activeDecimals = 2
export function setActiveCurrencyDecimals(decimals: number): void {
  activeDecimals = Number.isInteger(decimals) && decimals >= 0 && decimals <= 4 ? decimals : 2
}
export function getActiveCurrencyDecimals(): number {
  return activeDecimals
}

// Tolerance for "is this balance settled": one cent for 0/2-decimal currencies, half a milli for 3-decimal ones,
// so a 0.005 KWD shortfall is not silently treated as paid.
export function moneyEpsilon(decimals: number = activeDecimals): number {
  return decimals >= 3 ? 0.0005 : 0.01
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

export function roundCurrency(amount: DecimalInput, decimals: number = activeDecimals): number {
  return roundMoney(amount, decimals)
}

export function calculateTax(amount: DecimalInput, taxRate: DecimalInput, decimals: number = activeDecimals): number {
  return taxOnAmount(amount, taxRate, decimals)
}

// Exact sum, rounded once at the end (see shared/utils/money.ts).
export function sumCurrency(amounts: DecimalInput[], decimals: number = activeDecimals): number {
  return sumMoney(amounts, decimals)
}

export function calculateLineTotal(qty: DecimalInput, unitPrice: DecimalInput, discountAmount: DecimalInput = 0, taxRate: DecimalInput = 0, decimals: number = activeDecimals, pricesIncludeTax = false): {
  subtotal: number
  discountAmount: number
  taxAmount: number
  lineTotal: number
} {
  const t = computeDocumentTotals([{ quantity: qty, unitPrice, discountAmount, taxRate }], { decimals, pricesIncludeTax })
  const l = t.lines[0]
  return { subtotal: l.gross, discountAmount: l.discountAmount, taxAmount: l.tax, lineTotal: l.total }
}

// A flat invoice-level discount is allocated proportionally to each line's own
// taxable value (last line absorbs the rounding remainder), then tax is
// recomputed per line on the reduced base — Section 15(3) CGST Act: a discount
// recorded on the invoice at time of supply is excluded from the value of
// supply. The algorithm itself lives in the shared money module.
export function allocateGlobalDiscount(
  items: { lineTaxable: DecimalInput; taxRate: DecimalInput }[],
  globalDiscount: DecimalInput,
  decimals: number = activeDecimals
): { lineTaxable: number; lineTax: number }[] {
  const t = computeDocumentTotals(
    items.map(i => ({ quantity: 1, unitPrice: i.lineTaxable, taxRate: i.taxRate })),
    { decimals, globalDiscount }
  )
  return t.lines.map(l => ({ lineTaxable: l.taxable, lineTax: l.tax }))
}
