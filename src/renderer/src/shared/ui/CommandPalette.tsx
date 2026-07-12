import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Package, Users, Truck, Receipt, ArrowRight, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { api } from '@renderer/services/ipc-client'
import { useBusinessStore } from '@app/store/business.store'
import { cn } from '@shared/utils/cn'

interface SearchProduct { id: string; productName: string; sku?: string | null; sellingPrice: number }
interface SearchCustomer { id: string; customerName: string; phone?: string | null; customerCode?: string | null }
interface SearchSupplier { id: string; supplierName: string; phone?: string | null }
interface SearchInvoice { id: string; invoiceNumber: string; totalAmount: number; status: string }

interface SearchResults {
  products: SearchProduct[]
  customers: SearchCustomer[]
  suppliers: SearchSupplier[]
  invoices: SearchInvoice[]
}

interface ResultItem {
  id: string
  label: string
  sub?: string
  path: string
  category: string
  icon: React.ReactNode
}

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const profile = useBusinessStore(s => s.profile)
  const sym = profile?.currencySymbol ?? '₹'
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults(null)
      setSelectedIdx(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); setLoading(false); return }
    setLoading(true)
    const res = await api.search.global({ query: q })
    setLoading(false)
    if (res.success && res.data) setResults(res.data as SearchResults)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) { setResults(null); setLoading(false); return }
    setLoading(true)
    debounceRef.current = setTimeout(() => search(query), 200)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, search])

  const flatItems: ResultItem[] = results ? [
    ...results.products.map(p => ({
      id: p.id, label: p.productName, sub: `${sym}${p.sellingPrice.toFixed(2)}${p.sku ? ` · ${p.sku}` : ''}`,
      path: '/products', category: 'Products',
      icon: <Package size={14} className="text-brand" />
    })),
    ...results.customers.map(c => ({
      id: c.id, label: c.customerName, sub: [c.customerCode, c.phone].filter(Boolean).join(' · '),
      path: `/customers/${c.id}`, category: 'Customers',
      icon: <Users size={14} className="text-success" />
    })),
    ...results.suppliers.map(s => ({
      id: s.id, label: s.supplierName, sub: s.phone ?? undefined,
      path: `/suppliers/${s.id}`, category: 'Suppliers',
      icon: <Truck size={14} className="text-warning" />
    })),
    ...results.invoices.map(inv => ({
      id: inv.id, label: inv.invoiceNumber, sub: `${sym}${inv.totalAmount.toFixed(2)} · ${inv.status}`,
      path: `/billing/${inv.id}`, category: 'Invoices',
      icon: <Receipt size={14} className="text-slate-500" />
    })),
  ] : []

  const totalItems = flatItems.length

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, totalItems - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && flatItems[selectedIdx]) {
      navigate(flatItems[selectedIdx].path)
      onClose()
    }
  }

  function handleSelect(item: ResultItem) {
    navigate(item.path)
    onClose()
  }

  const categories = [...new Set(flatItems.map(i => i.category))]

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="fixed top-[15vh] left-1/2 -translate-x-1/2 w-full max-w-xl z-50 px-4"
          >
            <div role="dialog" aria-modal="true" aria-label="Global search" className="bg-white dark:bg-slate-900 rounded-2xl shadow-modal dark:shadow-none dark:border dark:border-slate-700 overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <Search size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => { setQuery(e.target.value); setSelectedIdx(0) }}
                  onKeyDown={handleKeyDown}
                  placeholder="Search products, customers, suppliers, invoices…"
                  aria-label="Search"
                  aria-autocomplete="list"
                  aria-controls="command-palette-results"
                  className="flex-1 text-sm text-dark dark:text-slate-100 bg-transparent placeholder-slate-400 focus:outline-none"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-slate-300 hover:text-slate-500 transition-colors">
                    <X size={14} />
                  </button>
                )}
                <kbd className="hidden sm:flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div id="command-palette-results" className="max-h-80 overflow-y-auto py-2" role="listbox" aria-label="Search results">
                {loading && (
                  <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400">
                    <div className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                    Searching…
                  </div>
                )}

                {!loading && query.length > 1 && flatItems.length === 0 && (
                  <div className="px-4 py-6 text-center">
                    <Search size={24} className="text-slate-200 dark:text-slate-700 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No results for "{query}"</p>
                  </div>
                )}

                {!loading && !query && (
                  <div className="px-4 py-6 text-center">
                    <p className="text-xs text-slate-400">Type to search products, customers, suppliers, or invoices</p>
                  </div>
                )}

                {!loading && flatItems.length > 0 && categories.map(cat => {
                  const catItems = flatItems.filter(i => i.category === cat)
                  return (
                    <div key={cat}>
                      <p className="px-4 py-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{cat}</p>
                      {catItems.map(item => {
                        const globalIdx = flatItems.indexOf(item)
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            onMouseEnter={() => setSelectedIdx(globalIdx)}
                            className={cn(
                              'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                              selectedIdx === globalIdx
                                ? 'bg-brand/5 dark:bg-brand/10'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                            )}
                          >
                            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                              {item.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-dark dark:text-slate-100 truncate">{item.label}</p>
                              {item.sub && <p className="text-xs text-slate-400 truncate">{item.sub}</p>}
                            </div>
                            <ArrowRight size={13} className={cn(
                              'shrink-0 transition-opacity',
                              selectedIdx === globalIdx ? 'text-brand opacity-100' : 'text-slate-300 opacity-0'
                            )} />
                          </button>
                        )
                      })}
                    </div>
                  )
                })}
              </div>

              {/* Footer hint */}
              <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-100 dark:border-slate-700 text-[10px] text-slate-400">
                <span><kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px]">↑↓</kbd> navigate</span>
                <span><kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px]">↵</kbd> open</span>
                <span><kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px]">esc</kbd> close</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
