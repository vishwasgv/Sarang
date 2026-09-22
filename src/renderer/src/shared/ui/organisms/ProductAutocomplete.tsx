import React, { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@shared/utils/cn'

export interface ProductOption {
  id: string
  productName: string
  sku?: string | null
  unit?: string
  productType?: string
  sellingPrice?: number
  costPrice?: number
  taxRate?: number
}

interface ProductAutocompleteProps {
  value: string
  onChange: (product: ProductOption) => void
  error?: string
  placeholder?: string
  disabled?: boolean
  /** Extra products.search() params beyond the text query, e.g. excluding already-picked lines. */
  excludeIds?: string[]
  /** Only show results whose productType matches, e.g. 'STANDARD' to exclude service-type items a caller handles separately (a plain string, not a function, so it doesn't cause a re-fetch loop from a new closure identity on every render). Small effect on the already-small (20-item) result budget — not worth a backend round trip for. */
  onlyProductType?: string
}

/**
 * REAL BUG found+fixed 2026-09-22 (1500+ product stress test): every one of
 * this app's ~14 "pick a product for this line item" pickers was a local,
 * duplicated copy of the same component — each pre-loaded one capped batch
 * (limit 500-1000) into the parent screen and filtered it client-side as
 * the owner typed. A product past that cap couldn't be found by typing its
 * exact name, and even where a picker DID somehow show it, the parent's own
 * separate `products.find(p => p.id === productId)` lookup (used to
 * auto-fill unitPrice/taxRate) would also fail to find it in that same
 * capped array. This shared component replaces all of them: it searches the
 * real server-side products:search endpoint (already proven correct and
 * already used by every OTHER product picker in this app — BillingScreen,
 * QuotationFormScreen, etc.) on every keystroke, and hands the FULL matched
 * product back to the caller on selection so no second, capped-array lookup
 * is ever needed.
 */
export function ProductAutocomplete({ value, onChange, error, placeholder, disabled, excludeIds, onlyProductType }: ProductAutocompleteProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<ProductOption[]>([])
  const [selectedLabel, setSelectedLabel] = useState('')
  const wrapRef = useRef<HTMLDivElement>(null)

  // Resolve a display label for `value` whenever it changes from outside
  // (e.g. editing an existing line item) — we don't assume the caller still
  // has this product in some locally-loaded array.
  useEffect(() => {
    if (!value) { setSelectedLabel(''); return }
    let cancelled = false
    ;(async () => {
      const res = await window.api.products.get(value)
      if (!cancelled && res.success && res.data) {
        const p = res.data as ProductOption
        setSelectedLabel(`${p.productName}${p.sku ? ` (${p.sku})` : ''}`)
      }
    })()
    return () => { cancelled = true }
  }, [value])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(async () => {
      const res = await window.api.products.search(query.trim())
      if (res.success) {
        const excluded = new Set(excludeIds ?? [])
        let list = ((res.data as ProductOption[]) ?? []).filter((p) => !excluded.has(p.id))
        if (onlyProductType) list = list.filter((p) => p.productType === onlyProductType)
        setResults(list)
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [query, open, excludeIds, onlyProductType])

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <Search size={12} className="absolute start-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={open ? query : selectedLabel}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true) }}
          onFocus={() => { setQuery(''); setOpen(true) }}
          placeholder={placeholder ?? 'Search product…'}
          disabled={disabled}
          className="w-full h-8 ps-6 pe-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand text-slate-700 dark:text-slate-300 disabled:opacity-60"
        />
      </div>
      {open && (
        <div className="absolute start-0 end-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">{t('common.noResults')}</p>
          ) : (
            results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onChange(p); setQuery(''); setOpen(false) }}
                className={cn('w-full text-start px-3 py-2 text-sm hover:bg-brand/5 transition-colors', p.id === value && 'bg-brand/5')}
              >
                <p className="text-dark dark:text-slate-100">{p.productName}</p>
                {p.sku && <p className="text-xs text-slate-400">SKU: {p.sku}</p>}
              </button>
            ))
          )}
        </div>
      )}
      {error && <p className="text-xs text-danger mt-0.5">{error}</p>}
    </div>
  )
}
