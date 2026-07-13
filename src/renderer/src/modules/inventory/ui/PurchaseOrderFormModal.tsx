import React, { useEffect, useRef, useState } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, Search } from 'lucide-react'
import { Modal } from '@shared/ui/molecules/Modal'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'
import { cn } from '@shared/utils/cn'

const itemSchema = z.object({
  productId: z.string().min(1, 'Select a product'),
  quantity: z.coerce.number().positive('Must be > 0'),
  unitCost: z.coerce.number().min(0, 'Cannot be negative'),
  taxRate: z.coerce.number().min(0).max(100).default(0)
})

const schema = z.object({
  supplierId: z.string().min(1, 'Select a supplier'),
  expectedDate: z.string().optional(),
  notes: z.string().max(500).optional(),
  items: z.array(itemSchema).min(1, 'Add at least one item')
})

type FormValues = z.infer<typeof schema>

interface Supplier { id: string; supplierName: string; supplierCode: string }
interface Product { id: string; productName: string; sku?: string | null; unit: string; productType: string; costPrice: number }

interface PurchaseOrderFormModalProps {
  open: boolean
  onClose: () => void
  onSaved: (poId: string) => void
}

// Plain <select> with 500 options has no type-to-filter — this gives the same
// product list a searchable dropdown instead, filtering client-side over the
// already-loaded products (no extra IPC round trip).
function ProductPicker({ products, value, onChange, error }: {
  products: Product[]
  value: string
  onChange: (productId: string) => void
  error?: string
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const selected = products.find(p => p.id === value)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const results = query.trim()
    ? products.filter(p =>
        p.productName.toLowerCase().includes(query.toLowerCase()) ||
        (p.sku ?? '').toLowerCase().includes(query.toLowerCase())
      ).slice(0, 50)
    : products.slice(0, 50)

  return (
    <div className="relative" ref={wrapRef}>
      <div className="relative">
        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={open ? query : (selected ? `${selected.productName}${selected.sku ? ` (${selected.sku})` : ''}` : '')}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true) }}
          onFocus={() => { setQuery(''); setOpen(true) }}
          placeholder="Search product…"
          className="w-full h-8 pl-6 pr-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand text-slate-700 dark:text-slate-300"
        />
      </div>
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">No products match.</p>
          ) : (
            results.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onChange(p.id); setQuery(''); setOpen(false) }}
                className={cn('w-full text-left px-3 py-2 text-sm hover:bg-brand/5 transition-colors', p.id === value && 'bg-brand/5')}
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

export function PurchaseOrderFormModal({ open, onClose, onSaved }: PurchaseOrderFormModalProps) {
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loadingData, setLoadingData] = useState(true)

  const { control, register, handleSubmit, watch, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { supplierId: '', expectedDate: '', notes: '', items: [{ productId: '', quantity: 1, unitCost: 0, taxRate: 0 }] }
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = watch('items')

  useEffect(() => {
    if (!open) return
    reset({ supplierId: '', expectedDate: '', notes: '', items: [{ productId: '', quantity: 1, unitCost: 0, taxRate: 0 }] })
    async function loadOptions() {
      setLoadingData(true)
      try {
        const [sRes, pRes] = await Promise.all([
          window.api.suppliers.list({ limit: 200 }),
          window.api.products.list({ isActive: true, limit: 500 })
        ])
        if (sRes.success) {
          // suppliers.list returns a paginated wrapper ({ suppliers, total,
          // page, limit, pages }), not a bare array — casting sRes.data
          // straight to Supplier[] (as this used to) left `suppliers` state
          // holding that wrapper object, and every suppliers.map() below
          // threw "suppliers.map is not a function", making the Purchase
          // Order form's supplier dropdown permanently empty/broken. Found
          // live 2026-07-13 while setting up test data, not a hypothetical.
          const d = sRes.data as { suppliers: Supplier[] }
          setSuppliers(d.suppliers ?? [])
        } else {
          toastError('Error', sRes.error?.message ?? 'Failed to load suppliers.')
        }
        if (pRes.success) {
          const d = pRes.data as { products: Product[] }
          setProducts((d.products ?? []).filter(p => p.productType === 'STANDARD'))
        } else {
          toastError('Error', pRes.error?.message ?? 'Failed to load products.')
        }
      } catch {
        toastError('Error', 'Failed to load suppliers or products.')
      } finally {
        setLoadingData(false)
      }
    }
    loadOptions()
  }, [open, reset])

  function handleProductChange(index: number, productId: string, onChange: (v: string) => void) {
    const previousProductId = watchedItems[index]?.productId
    onChange(productId)
    const product = products.find(p => p.id === productId)
    // Always re-fill on an actual product change — leaving a previously
    // auto-filled (or stale) cost in place when the product changes would
    // silently price the new line item at the old product's cost.
    if (product && productId !== previousProductId) {
      setValue(`items.${index}.unitCost`, product.costPrice ?? 0)
    }
  }

  const subtotal = watchedItems.reduce((sum, item) => {
    const base = (Number(item.quantity) || 0) * (Number(item.unitCost) || 0)
    return sum + base
  }, 0)
  const taxAmount = watchedItems.reduce((sum, item) => {
    const base = (Number(item.quantity) || 0) * (Number(item.unitCost) || 0)
    return sum + (base * ((Number(item.taxRate) || 0) / 100))
  }, 0)
  const totalAmount = subtotal + taxAmount

  async function onSubmit(values: FormValues) {
    try {
      const res = await window.api.purchaseOrders.create(values)
      if (res.success) {
        const po = res.data as { id: string; poNumber: string }
        toastSuccess('PO Created', `Purchase order ${po.poNumber} has been saved as draft.`)
        onSaved(po.id)
      } else {
        toastError('Error', res.error?.message ?? 'Failed to create purchase order.')
      }
    } catch {
      toastError('Error', 'Failed to create purchase order.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Purchase Order"
      size="xl"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>Save as Draft</Button>
        </>
      }
    >
      {loadingData ? (
        <div className="space-y-3 py-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />)}
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          {/* Supplier + Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Select label="Supplier" required error={errors.supplierId?.message} {...register('supplierId')}>
                <option value="">Select supplier…</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplierName} ({s.supplierCode})</option>)}
              </Select>
            </div>
            <Input label="Expected Delivery Date" type="date" {...register('expectedDate')} />
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Items</p>
              <button type="button" onClick={() => append({ productId: '', quantity: 1, unitCost: 0, taxRate: 0 })}
                className="flex items-center gap-1 text-xs font-medium text-brand hover:text-brand/80 transition-colors">
                <Plus size={12} /> Add Item
              </button>
            </div>

            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 px-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Product</span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Qty</span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Unit Cost</span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Tax %</span>
                <span />
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-start bg-slate-50 dark:bg-slate-800 rounded-lg p-2">
                  <div>
                    <Controller
                      control={control}
                      name={`items.${index}.productId`}
                      render={({ field: f }) => (
                        <ProductPicker
                          products={products}
                          value={f.value}
                          onChange={(productId) => handleProductChange(index, productId, f.onChange)}
                        />
                      )}
                    />
                    {errors.items?.[index]?.productId && (
                      <p className="text-xs text-danger mt-0.5">{errors.items[index].productId?.message}</p>
                    )}
                  </div>
                  <div>
                    <input type="number" min="1" step="1" {...register(`items.${index}.quantity`)}
                      className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand" />
                  </div>
                  <div>
                    <input type="number" min="0" step="0.01" {...register(`items.${index}.unitCost`)}
                      className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand" />
                  </div>
                  <div>
                    <input type="number" min="0" max="100" step="0.5" {...register(`items.${index}.taxRate`)}
                      className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand" />
                  </div>
                  <button type="button" onClick={() => { if (fields.length > 1) remove(index) }}
                    disabled={fields.length === 1}
                    className="p-1.5 rounded text-slate-400 hover:text-danger hover:bg-danger/10 disabled:opacity-30 transition-colors mt-0.5">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {errors.items?.root && <p className="text-xs text-danger">{errors.items.root.message}</p>}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Subtotal</span>
              <span>{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Tax</span>
              <span>{taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-dark dark:text-slate-100 border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-1.5">
              <span>Total</span>
              <span>{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">Notes (optional)</label>
            <textarea {...register('notes')} rows={2} placeholder="Internal notes…"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand resize-none text-slate-700 dark:text-slate-300 placeholder-slate-400" />
          </div>
        </form>
      )}
    </Modal>
  )
}
