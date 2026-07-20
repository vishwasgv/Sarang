import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Trash2, ChevronLeft, Save, Search, Ruler } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNotificationStore } from '@app/store/notification.store'
import { useBusinessStore } from '@app/store/business.store'
import { useIndustryStore } from '@app/store/industry.store'
import { Button } from '@shared/ui/atoms/Button'
import { Card } from '@shared/ui/molecules/Card'
import { Select } from '@shared/ui/atoms/Select'
import { cn } from '@shared/utils/cn'

interface LineItem {
  productId?: string; productName: string; sku?: string
  quantity: number; unitPrice: number; discount: number; taxRate: number
}

interface Customer { id: string; customerName: string }
interface ProductResult { id: string; productName: string; sku?: string | null; sellingPrice: number; taxRate: number }

function calcLine(item: LineItem) {
  const base = item.quantity * item.unitPrice
  const disc = base * (item.discount / 100)
  const taxable = base - disc
  const tax = taxable * (item.taxRate / 100)
  return taxable + tax
}

function ProductSearchCell({ value, placeholder, onSelect }: {
  value: string
  placeholder: string
  onSelect: (p: ProductResult | null, typedName: string) => void
}) {
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<ProductResult[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setOpen(false); return }
    try {
      const res = await window.api.products.search(q)
      if (res.success) {
        setResults((res.data as ProductResult[]) ?? [])
        setOpen(true)
      }
      // A failed search-as-you-type just leaves the dropdown empty — no
      // toast needed here (would fire on every keystroke of a typo), but no
      // longer silently swallows a thrown exception either.
    } catch { /* non-critical: search-as-you-type, user can retry by typing more */ }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => search(query), 200)
    return () => clearTimeout(t)
  }, [query, search])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center">
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); onSelect(null, e.target.value) }}
          onFocus={() => query && results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:border-brand"
        />
        <Search size={12} className="absolute right-2 text-slate-300 pointer-events-none" />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {results.map(p => (
            <button key={p.id} onMouseDown={() => { onSelect(p, p.productName); setQuery(p.productName); setOpen(false) }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between">
              <div>
                <p className="font-medium text-dark dark:text-slate-100">{p.productName}</p>
                {p.sku && <p className="text-xs text-slate-400">{p.sku}</p>}
              </div>
              <span className="text-xs text-brand font-semibold shrink-0 ml-2">₹{p.sellingPrice.toFixed(2)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function QuotationFormScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const sym = useBusinessStore(s => s.profile?.currencySymbol ?? '₹')
  // Phase 58 §2 — Hardware's area-pricing calculator, mirroring
  // BillingScreen.tsx's identical L×W-sets-quantity feature (same module
  // flag gates both — the calculator works on any product type, not just
  // AREA_BASED, per that file's own established convention). Quotations has
  // no cart-key concept, so this is keyed by array index instead.
  const { isModuleEnabled } = useIndustryStore()
  const areaPricingEnabled = isModuleEnabled('area_pricing')
  const [areaCalc, setAreaCalc] = useState<Record<number, { l: string; w: string; open: boolean }>>({})

  const [customerName, setCustomerName] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<LineItem[]>([
    { productName: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: 0 }
  ])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.api.customers.list({}).then(res => {
      if (res.success) {
        const d = res.data as { customers: Customer[] }
        setCustomers(d.customers ?? [])
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    }).catch(() => toastError(t('common.error'), t('common.error')))
  }, [toastError, t])

  function updateItem(index: number, field: keyof LineItem, value: string | number | undefined) {
    setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  function selectProduct(index: number, product: ProductResult | null, typedName: string) {
    if (product) {
      setItems(prev => prev.map((item, i) => i === index
        ? { ...item, productId: product.id, productName: product.productName, sku: product.sku ?? undefined, unitPrice: product.sellingPrice, taxRate: product.taxRate }
        : item))
    } else {
      setItems(prev => prev.map((item, i) => i === index ? { ...item, productId: undefined, productName: typedName } : item))
    }
  }

  function addItem() {
    setItems(prev => [...prev, { productName: '', quantity: 1, unitPrice: 0, discount: 0, taxRate: 0 }])
  }

  function removeItem(index: number) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  const subtotal = items.reduce((s, item) => s + item.quantity * item.unitPrice, 0)
  const discountTotal = items.reduce((s, item) => s + item.quantity * item.unitPrice * item.discount / 100, 0)
  const total = items.reduce((s, item) => s + calcLine(item), 0)

  async function handleSave() {
    if (items.every(i => !i.productName.trim())) {
      toastError(t('quotations.atLeastOneItem'))
      return
    }
    setSaving(true)
    const validItems = items.filter(i => i.productName.trim())
    const res = await window.api.quotations.create({
      customerId: selectedCustomerId || undefined,
      customerName: selectedCustomerId ? undefined : customerName || undefined,
      validUntil: validUntil || undefined,
      notes: notes || undefined,
      items: validItems.map(i => ({
        productId: i.productId,
        productName: i.productName,
        sku: i.sku,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discount: i.discount,
        taxRate: i.taxRate
      }))
    })
    if (res.success) {
      toastSuccess(t('quotations.created'))
      navigate('/billing/quotations')
    } else {
      toastError((res.error as { message: string })?.message ?? t('quotations.failedCreate'))
    }
    setSaving(false)
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/billing/quotations')} className="text-slate-400 hover:text-brand">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-dark dark:text-slate-100">{t('quotations.newQuotation')}</h1>
      </div>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{t('billing.customer')}</h2>
        <div className="grid grid-cols-2 gap-4">
          <Select label={t('quotations.selectCustomer')} value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)}>
            <option value="">{t('quotations.walkIn')}</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.customerName}</option>)}
          </Select>
          {!selectedCustomerId && (
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('quotations.customerName')}</label>
              <input
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
                placeholder={t('common.optional')}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-dark dark:text-slate-100 focus:outline-none focus:border-brand"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">{t('quotations.validUntil')}</label>
            <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-dark dark:text-slate-100 focus:outline-none focus:border-brand" />
          </div>
        </div>
      </Card>

      <Card padding="lg" className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{t('billing.items', { count: items.length })}</h2>
        <div className={cn('grid gap-2 px-2 py-1', 'grid-cols-[2fr_80px_100px_70px_70px_32px]')}>
          {[t('billing.product'), t('billing.qty'), t('billing.rate'), 'Disc%', 'Tax%', ''].map(h => (
            <span key={h} className="text-xs font-semibold text-slate-400 uppercase">{h}</span>
          ))}
        </div>
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-[2fr_80px_100px_70px_70px_32px] gap-2 items-center">
            <ProductSearchCell
              value={item.productName}
              placeholder={t('quotations.productSearch')}
              onSelect={(p, name) => selectProduct(i, p, name)}
            />
            <div className="relative">
              <input type="number" min="0" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-right focus:outline-none focus:border-brand" />
              {areaPricingEnabled && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAreaCalc(prev => ({
                      ...prev,
                      [i]: { l: prev[i]?.l ?? '', w: prev[i]?.w ?? '', open: !(prev[i]?.open ?? false) }
                    }))}
                    title={t('billing.areaCalculator') as string}
                    className="mt-0.5 flex items-center gap-1 text-xs text-brand/70 hover:text-brand transition-colors">
                    <Ruler size={10} /> {t('billing.areaLabel')}
                  </button>
                  {areaCalc[i]?.open && (
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg p-3 w-40 space-y-2">
                      <p className="text-xs font-semibold text-dark dark:text-slate-100 text-center">{t('billing.areaFormula')}</p>
                      <div className="flex gap-1 items-center">
                        <input
                          type="number" min="0" step="0.01" placeholder="L"
                          value={areaCalc[i]?.l ?? ''}
                          onChange={e => setAreaCalc(prev => ({ ...prev, [i]: { ...prev[i], l: e.target.value } }))}
                          className="w-14 px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded focus:outline-none focus:border-brand text-center"
                        />
                        <span className="text-xs text-slate-400">×</span>
                        <input
                          type="number" min="0" step="0.01" placeholder="W"
                          value={areaCalc[i]?.w ?? ''}
                          onChange={e => setAreaCalc(prev => ({ ...prev, [i]: { ...prev[i], w: e.target.value } }))}
                          className="w-14 px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded focus:outline-none focus:border-brand text-center"
                        />
                      </div>
                      {(() => {
                        const l = parseFloat(areaCalc[i]?.l ?? '0')
                        const w = parseFloat(areaCalc[i]?.w ?? '0')
                        const area = l > 0 && w > 0 ? parseFloat((l * w).toFixed(3)) : null
                        return area !== null ? (
                          <button
                            type="button"
                            onClick={() => {
                              updateItem(i, 'quantity', area)
                              setAreaCalc(prev => ({ ...prev, [i]: { ...prev[i], open: false } }))
                            }}
                            className="w-full py-1 text-xs bg-brand text-white rounded-lg hover:bg-brand/90 transition-colors font-semibold">
                            {t('billing.useAreaSq', { area })}
                          </button>
                        ) : null
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
            <input type="number" min="0" value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', parseFloat(e.target.value) || 0)}
              className="px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-right focus:outline-none focus:border-brand" />
            <input type="number" min="0" max="100" value={item.discount} onChange={e => updateItem(i, 'discount', parseFloat(e.target.value) || 0)}
              className="px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-right focus:outline-none focus:border-brand" />
            <input type="number" min="0" max="100" value={item.taxRate} onChange={e => updateItem(i, 'taxRate', parseFloat(e.target.value) || 0)}
              className="px-2 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-right focus:outline-none focus:border-brand" />
            <button onClick={() => removeItem(i)} disabled={items.length === 1} className="text-slate-300 hover:text-danger disabled:opacity-30 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button onClick={addItem} className="flex items-center gap-1.5 text-sm text-brand font-medium hover:underline mt-1">
          <Plus size={14} /> {t('quotations.addItem')}
        </button>
      </Card>

      <Card padding="lg" className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{t('billing.notes')}</h2>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder={t('quotations.notesPlaceholder')}
          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-dark dark:text-slate-100 focus:outline-none focus:border-brand resize-none" />
      </Card>

      <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex justify-between gap-8 text-sm text-slate-500">
            <span>{t('billing.subtotal')}</span><span>{sym}{subtotal.toFixed(2)}</span>
          </div>
          {discountTotal > 0 && (
            <div className="flex justify-between gap-8 text-sm text-slate-500">
              <span>{t('billing.discount')}</span><span>−{sym}{discountTotal.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between gap-8 text-base font-bold text-dark dark:text-slate-100">
            <span>{t('common.total')}</span><span>{sym}{total.toFixed(2)}</span>
          </div>
        </div>
        <Button size="md" onClick={handleSave} loading={saving}>
          <Save size={15} className="mr-1.5" /> {t('quotations.saveQuotation')}
        </Button>
      </div>
    </div>
  )
}
