import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Tag, Plus, Trash2, Search } from 'lucide-react'
import { api } from '@renderer/services/ipc-client'
import { useNotificationStore } from '@app/store/notification.store'
import { formatCurrency } from '@shared/utils/currency.util'
import { Card } from '@shared/ui/molecules/Card'

// Phase 58 §2 — Distributor customer-class/negotiated pricing. Plain CRUD
// over CustomerClassPrice (unique per productId+customerClass) — resolved
// server-side by resolveCustomerPrice at every add-to-cart/accept site
// (BulkOrderScreen, the field-order accept flow), never trusted from here.

interface Product { id: string; productName: string; sku?: string | null; sellingPrice: number }
interface ClassPrice {
  id: string; productId: string; customerClass: string; price: number
  product: { productName: string; sellingPrice: number }
}

export function CustomerPricingScreen() {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [prices, setPrices] = useState<ClassPrice[]>([])
  const [loading, setLoading] = useState(true)

  const [productQuery, setProductQuery] = useState('')
  const [productResults, setProductResults] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [customerClass, setCustomerClass] = useState('')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await api.products.listCustomerClassPrices()
      if (res.success && res.data) setPrices(res.data as ClassPrice[])
      else toastError(t('distributor.pricing.error'), res.error?.message ?? t('distributor.pricing.couldNotLoad'))
    } catch {
      toastError(t('distributor.pricing.error'), t('distributor.pricing.couldNotLoad'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!productQuery.trim()) { setProductResults([]); return }
    const timer = setTimeout(async () => {
      try {
        const res = await api.products.search(productQuery.trim())
        if (res.success && res.data) setProductResults(res.data as Product[])
      } catch {
        // search failures shouldn't block the rest of the screen
      }
    }, 250)
    return () => clearTimeout(timer)
  }, [productQuery])

  async function handleAdd() {
    if (!selectedProduct) { toastError(t('distributor.pricing.noProduct'), t('distributor.pricing.noProductMessage')); return }
    if (!customerClass.trim()) { toastError(t('distributor.pricing.noClass'), t('distributor.pricing.noClassMessage')); return }
    const parsedPrice = parseFloat(price)
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) { toastError(t('distributor.pricing.invalidPrice'), t('distributor.pricing.invalidPriceMessage')); return }

    setSaving(true)
    try {
      const res = await api.products.upsertCustomerClassPrice({ productId: selectedProduct.id, customerClass: customerClass.trim().toUpperCase(), price: parsedPrice })
      if (res.success) {
        toastSuccess(t('distributor.pricing.priceSet'), t('distributor.pricing.priceSetMessage', { customerClass: customerClass.trim().toUpperCase(), productName: selectedProduct.productName }))
        setSelectedProduct(null); setProductQuery(''); setCustomerClass(''); setPrice('')
        load()
      } else {
        toastError(t('distributor.pricing.error'), (res.error as { message?: string })?.message ?? t('distributor.pricing.couldNotSave'))
      }
    } catch {
      toastError(t('distributor.pricing.error'), t('distributor.pricing.couldNotSave'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await api.products.deleteCustomerClassPrice(id)
      if (res.success) { toastSuccess(t('distributor.pricing.removed'), t('distributor.pricing.removedMessage')); load() }
      else toastError(t('distributor.pricing.error'), res.error?.message ?? t('distributor.pricing.couldNotRemove'))
    } catch {
      toastError(t('distributor.pricing.error'), t('distributor.pricing.couldNotRemove'))
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-bold text-dark dark:text-slate-100">{t('distributor.pricing.title')}</h2>
        <p className="text-sm text-slate-400">{t('distributor.pricing.subtitle')}</p>
      </div>

      <Card padding="lg" className="space-y-3">
        <h3 className="text-sm font-semibold text-dark dark:text-slate-100 flex items-center gap-2"><Plus size={15} /> {t('distributor.pricing.addTitle')}</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="relative col-span-3 sm:col-span-1">
            {selectedProduct ? (
              <div className="flex items-center justify-between px-3 py-2 rounded-lg border border-brand/30 bg-brand/5 text-sm h-[38px]">
                <span className="truncate text-dark dark:text-slate-100">{selectedProduct.productName}</span>
                <button onClick={() => { setSelectedProduct(null); setProductQuery('') }} className="text-slate-400 hover:text-danger shrink-0 ml-2">×</button>
              </div>
            ) : (
              <>
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={productQuery} onChange={e => setProductQuery(e.target.value)}
                  placeholder={t('distributor.pricing.searchProduct')}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:border-brand" />
                {productResults.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
                    {productResults.slice(0, 8).map(p => (
                      <button key={p.id} onClick={() => { setSelectedProduct(p); setProductResults([]) }}
                        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-brand/5 dark:hover:bg-brand/10 text-sm border-b border-slate-50 dark:border-slate-800 last:border-0">
                        <span className="text-dark dark:text-slate-100 truncate">{p.productName}</span>
                        <span className="text-xs text-slate-400 shrink-0">{formatCurrency(p.sellingPrice)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
          <input value={customerClass} onChange={e => setCustomerClass(e.target.value)}
            placeholder={t('distributor.pricing.classPlaceholder')}
            className="col-span-3 sm:col-span-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:border-brand" />
          <input value={price} onChange={e => setPrice(e.target.value)} type="number" min="0" step="0.01"
            placeholder={t('distributor.pricing.pricePlaceholder')}
            className="col-span-3 sm:col-span-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 rounded-lg focus:outline-none focus:border-brand" />
        </div>
        <button onClick={handleAdd} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors disabled:opacity-50">
          {saving ? t('distributor.pricing.saving') : t('distributor.pricing.save')}
        </button>
      </Card>

      <Card padding="none" className="overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-5 py-2.5 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-400 uppercase">
          <div className="col-span-5">{t('distributor.pricing.columnProduct')}</div>
          <div className="col-span-3">{t('distributor.pricing.columnClass')}</div>
          <div className="col-span-2 text-right">{t('distributor.pricing.columnListPrice')}</div>
          <div className="col-span-1 text-right">{t('distributor.pricing.columnPrice')}</div>
          <div className="col-span-1"></div>
        </div>
        {loading ? (
          <p className="p-5 text-sm text-slate-400">{t('distributor.pricing.loading')}</p>
        ) : prices.length === 0 ? (
          <p className="p-5 text-sm text-slate-400">{t('distributor.pricing.empty')}</p>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-slate-800">
            {prices.map(cp => (
              <div key={cp.id} className="grid grid-cols-12 gap-2 px-5 py-3 items-center dark:bg-slate-900">
                <div className="col-span-5 text-sm text-dark dark:text-slate-100 truncate">{cp.product.productName}</div>
                <div className="col-span-3">
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand bg-brand/10 px-2 py-0.5 rounded"><Tag size={10} />{cp.customerClass}</span>
                </div>
                <div className="col-span-2 text-right text-xs text-slate-400 line-through">{formatCurrency(cp.product.sellingPrice)}</div>
                <div className="col-span-1 text-right text-sm font-semibold text-dark dark:text-slate-100">{formatCurrency(cp.price)}</div>
                <div className="col-span-1 text-right">
                  <button onClick={() => handleDelete(cp.id)} className="text-slate-300 hover:text-danger transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
