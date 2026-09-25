import { useEffect, useState } from 'react'
import type { ConfiguredTaxRate } from './off-slab-rate.util'

export { isOffSlabRate, type ConfiguredTaxRate } from './off-slab-rate.util'

let cache: ConfiguredTaxRate[] | null = null

// The tax rates the owner has configured (Settings > Tax Configuration), for rate pickers and the soft
// "not one of your saved rates" warning. Loaded once and shared; refreshed when a screen mounts fresh.
export function useConfiguredTaxRates(): ConfiguredTaxRate[] {
  const [rates, setRates] = useState<ConfiguredTaxRate[]>(cache ?? [])
  useEffect(() => {
    let alive = true
    window.api.tax.list().then(res => {
      if (!alive || !res.success || !res.data) return
      cache = res.data as ConfiguredTaxRate[]
      setRates(cache)
    }).catch(() => {})
    return () => { alive = false }
  }, [])
  return rates
}
