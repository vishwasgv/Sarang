import { getCurrencyDecimals, PRICES_INCLUDE_TAX_SETTING_KEY, resolvePricesIncludeTax, resolveRoundingRule, ROUNDING_RULE_SETTING_KEY, type RoundingRule } from '../../../../shared/utils/money'

// What the renderer needs to reproduce the backend's document maths exactly:
// the business currency's decimals and the invoice rounding rule. Pure (no store/React) so it is
// unit-testable from the main-process test suite too.
export interface MoneyContext {
  decimals: number
  roundingRule: RoundingRule
  // GST Composition-scheme businesses bill every outward line at 0% tax.
  compositionScheme: boolean
  // Business default for the per-document "Prices include tax" toggle.
  pricesIncludeTaxDefault: boolean
}

export function buildMoneyContext(
  profile: { currencyCode?: string | null; gstScheme?: string | null } | null | undefined,
  settings: Record<string, string>
): MoneyContext {
  return {
    decimals: getCurrencyDecimals(profile?.currencyCode),
    roundingRule: resolveRoundingRule(settings[ROUNDING_RULE_SETTING_KEY], profile?.currencyCode),
    compositionScheme: profile?.gstScheme === 'COMPOSITION',
    pricesIncludeTaxDefault: resolvePricesIncludeTax(settings[PRICES_INCLUDE_TAX_SETTING_KEY])
  }
}
