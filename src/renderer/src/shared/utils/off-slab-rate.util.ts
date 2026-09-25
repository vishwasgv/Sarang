export interface ConfiguredTaxRate { id: string; taxName: string; taxType: string; rate: number; isDefault: boolean; isLegacy?: boolean }

/** True when the typed rate is not one of the configured rates (0 is always accepted). Never blocks saving. */
export function isOffSlabRate(rate: number, configured: ConfiguredTaxRate[]): boolean {
  if (!Number.isFinite(rate) || rate === 0 || configured.length === 0) return false
  const all = new Set<number>()
  for (const c of configured) {
    all.add(c.rate)
    if (c.taxType === 'GST') all.add(c.rate / 2)
  }
  return !all.has(rate)
}
