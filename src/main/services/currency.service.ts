// Currency formatting engine — used by service layer for reports
// Renderer uses currency.util.ts via Zustand store

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

export function roundCurrency(amount: number, decimals = 2): number {
  return Math.round(amount * Math.pow(10, decimals)) / Math.pow(10, decimals)
}

export function calculateTax(amount: number, taxRate: number): number {
  return roundCurrency((amount * taxRate) / 100)
}

export function calculateLineTotal(qty: number, unitPrice: number, discountAmount = 0, taxRate = 0): {
  subtotal: number
  discountAmount: number
  taxAmount: number
  lineTotal: number
} {
  const subtotal = roundCurrency(qty * unitPrice)
  const discount = roundCurrency(Math.min(discountAmount, subtotal))
  const taxableAmount = subtotal - discount
  const taxAmount = calculateTax(taxableAmount, taxRate)
  const lineTotal = roundCurrency(taxableAmount + taxAmount)
  return { subtotal, discountAmount: discount, taxAmount, lineTotal }
}
