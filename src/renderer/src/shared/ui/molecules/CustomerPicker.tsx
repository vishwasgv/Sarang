import { useState, useEffect, useRef } from 'react'
import { UserPlus, X, Plus, Search } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { cn } from '@shared/utils/cn'

export interface CustomerLite {
  id: string
  customerName: string
  phone: string | null
  email?: string | null
}

interface CustomerPickerProps {
  value: CustomerLite | null
  onChange: (customer: CustomerLite | null) => void
  placeholder?: string
  label?: string
  className?: string
}

// Debounced phone/name search + inline quick-add, replicating BillingScreen's
// customer picker. Every screen that attaches a Customer to a booking/order
// should reuse this instead of a capped api.customers.list dropdown with no
// search — that pattern can't find a returning customer by phone and offers
// no way to add a new one inline, so staff either re-type details every visit
// or accidentally create duplicate Customer rows.
export function CustomerPicker({ value, onChange, placeholder, label, className }: CustomerPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerLite[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [quickName, setQuickName] = useState('')
  const [quickPhone, setQuickPhone] = useState('')
  const [quickAdding, setQuickAdding] = useState(false)
  const [quickError, setQuickError] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!query.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      const res = await api.customers.search(query)
      if (res.success) setResults(((res.data as CustomerLite[]) ?? []))
    }, 200)
    return () => clearTimeout(t)
  }, [query])

  async function handleQuickAdd() {
    if (!quickName.trim()) { setQuickError('Name is required.'); return }
    setQuickAdding(true)
    setQuickError('')
    const res = await api.customers.create({ customerName: quickName.trim(), phone: quickPhone.trim() || undefined })
    if (res.success) {
      onChange(res.data as CustomerLite)
      setShowQuickAdd(false)
      setQuickName('')
      setQuickPhone('')
      setQuery('')
      setResults([])
    } else {
      setQuickError(res.error?.message ?? 'Failed to add customer.')
    }
    setQuickAdding(false)
  }

  if (value) {
    return (
      <div className={className}>
        {label && <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">{label}</label>}
        <div className="flex items-center justify-between gap-2 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 bg-white dark:bg-slate-900">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">{value.customerName}</p>
            {value.phone && <p className="text-xs text-gray-500 dark:text-slate-400">{value.phone}</p>}
          </div>
          <button type="button" onClick={() => { onChange(null); setQuery('') }} className="text-gray-400 hover:text-red-600 shrink-0">
            <X size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      {label && <label className="block text-sm font-medium text-gray-700 mb-1 dark:text-slate-300">{label}</label>}
      {!showQuickAdd ? (
        <>
          <div className="relative" ref={dropdownRef}>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 pointer-events-none" />
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setShowDropdown(true) }}
                onFocus={() => setShowDropdown(true)}
                placeholder={placeholder ?? 'Search by name or phone...'}
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
              />
            </div>
            {showDropdown && results.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg shadow-lg z-20 max-h-44 overflow-y-auto">
                {results.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { onChange(c); setQuery(''); setShowDropdown(false); setResults([]) }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-800 text-left border-b border-gray-50 dark:border-slate-800 last:border-0 text-sm"
                  >
                    <span className="font-medium text-gray-900 dark:text-slate-100">{c.customerName}</span>
                    {c.phone && <span className="text-xs text-gray-400 dark:text-slate-500">{c.phone}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setShowQuickAdd(true); setShowDropdown(false) }}
            className="mt-1.5 flex items-center gap-1.5 text-xs text-brand hover:text-blue-600 transition-colors"
          >
            <Plus size={12} /> Add new customer
          </button>
        </>
      ) : (
        <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">New Customer</p>
            <button type="button" onClick={() => { setShowQuickAdd(false); setQuickError('') }} className="text-gray-400 hover:text-red-600">
              <X size={14} />
            </button>
          </div>
          <input
            value={quickName}
            onChange={(e) => setQuickName(e.target.value)}
            placeholder="Customer name *"
            className={cn('w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100')}
          />
          <input
            value={quickPhone}
            onChange={(e) => setQuickPhone(e.target.value)}
            placeholder="Phone (optional)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-slate-100"
          />
          {quickError && <p className="text-red-600 text-xs">{quickError}</p>}
          <button
            type="button"
            onClick={handleQuickAdd}
            disabled={quickAdding}
            className="w-full flex items-center justify-center gap-1.5 bg-brand text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-600 disabled:opacity-50"
          >
            <UserPlus size={14} /> {quickAdding ? 'Adding...' : 'Add & Select'}
          </button>
        </div>
      )}
    </div>
  )
}
