import React, { useEffect, useRef, useState } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, Search } from 'lucide-react'
import { Modal } from '@shared/ui/molecules/Modal'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'
import { cn } from '@shared/utils/cn'
import { SupplierFormModal } from './SupplierFormModal'

// A line is either a real product (productId) or a free-text service
// (serviceDescription) — mirrors PurchaseOrderFormModal's own item shape,
// see bill.validation.ts's BillItemSchema for the server-side twin.
const itemSchema = z.object({
  lineType: z.enum(['PRODUCT', 'SERVICE']),
  productId: z.string().optional(),
  serviceDescription: z.string().optional(),
  serviceCategoryId: z.string().optional(),
  quantity: z.coerce.number().positive('Must be > 0'),
  unitCost: z.coerce.number().min(0, 'Cannot be negative'),
  discountAmount: z.coerce.number().min(0).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(0)
}).refine(item => item.lineType === 'PRODUCT' ? !!item.productId : !!item.serviceDescription?.trim(), {
  message: 'Select a product or enter a service description'
})

const schema = z.object({
  supplierId: z.string().min(1, 'Select a supplier'),
  billDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().max(500).optional(),
  isReverseCharge: z.boolean().default(false),
  items: z.array(itemSchema).min(1, 'Add at least one item')
})

type FormValues = z.infer<typeof schema>

interface Supplier { id: string; supplierName: string; supplierCode: string }
interface Product { id: string; productName: string; sku?: string | null; unit: string; productType: string; costPrice: number }
interface ExpenseCategory { id: string; categoryName: string }

interface BillFormModalProps {
  open: boolean
  onClose: () => void
  onSaved: (billId: string) => void
  defaultSupplierId?: string
}

// Same searchable-dropdown pattern as PurchaseOrderFormModal's ProductPicker.
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
        <Search size={12} className="absolute start-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          value={open ? query : (selected ? `${selected.productName}${selected.sku ? ` (${selected.sku})` : ''}` : '')}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true) }}
          onFocus={() => { setQuery(''); setOpen(true) }}
          placeholder="Search product…"
          className="w-full h-8 ps-6 pe-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand text-slate-700 dark:text-slate-300"
        />
      </div>
      {open && (
        <div className="absolute start-0 end-0 top-full mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-30 max-h-48 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-400">No products match.</p>
          ) : (
            results.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { onChange(p.id); setQuery(''); setOpen(false) }}
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

export function BillFormModal({ open, onClose, onSaved, defaultSupplierId }: BillFormModalProps) {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [supplierFormOpen, setSupplierFormOpen] = useState(false)
  // Phase 64 — landed cost (freight/duty/handling), entered inline at
  // creation only — a Bill posts everything (including its own
  // ProductCostHistory rows) in one atomic step, unlike a Purchase Order's
  // staged receive, so there's no "add it later" window the way a PO has
  // (see bill.validation.ts's own comment). Local state, not RHF-registered
  // — same "variable-length array doesn't fit the flat-field model"
  // reasoning this codebase already applies to rentalRates/payroll deductions.
  const [landedCostRows, setLandedCostRows] = useState<{ costType: string; amount: string; allocationMethod: 'BY_VALUE' | 'BY_QUANTITY' }[]>([])

  const emptyItem = { lineType: 'PRODUCT' as const, productId: '', serviceDescription: '', serviceCategoryId: '', quantity: 1, unitCost: 0, discountAmount: 0, taxRate: 0 }

  const { control, register, handleSubmit, watch, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { supplierId: defaultSupplierId ?? '', billDate: '', dueDate: '', notes: '', isReverseCharge: false, items: [emptyItem] }
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = watch('items')

  async function loadSuppliers() {
    const sRes = await window.api.suppliers.list({ limit: 200 })
    if (sRes.success) {
      const d = sRes.data as { suppliers: Supplier[] }
      setSuppliers(d.suppliers ?? [])
    } else {
      toastError(t('common.error'), sRes.error?.message ?? t('common.error'))
    }
  }

  useEffect(() => {
    if (!open) return
    reset({ supplierId: defaultSupplierId ?? '', billDate: '', dueDate: '', notes: '', isReverseCharge: false, items: [emptyItem] })
    setLandedCostRows([])
    async function loadOptions() {
      setLoadingData(true)
      try {
        const [, pRes, cRes] = await Promise.all([
          loadSuppliers(),
          window.api.products.list({ isActive: true, limit: 500 }),
          window.api.expenses.listCategories()
        ])
        if (pRes.success) {
          const d = pRes.data as { products: Product[] }
          setProducts((d.products ?? []).filter(p => p.productType === 'STANDARD'))
        }
        if (cRes.success) setCategories((cRes.data as ExpenseCategory[]) ?? [])
      } catch {
        toastError(t('common.error'), t('common.error'))
      } finally {
        setLoadingData(false)
      }
    }
    loadOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultSupplierId, reset])

  async function handleSupplierCreated(newSupplier?: { id: string; supplierName: string }) {
    setSupplierFormOpen(false)
    await loadSuppliers()
    if (newSupplier) setValue('supplierId', newSupplier.id)
  }

  function handleProductChange(index: number, productId: string, onChange: (v: string) => void) {
    const previousProductId = watchedItems[index]?.productId
    onChange(productId)
    const product = products.find(p => p.id === productId)
    if (product && productId !== previousProductId) {
      setValue(`items.${index}.unitCost`, product.costPrice ?? 0)
    }
  }

  function lineTotal(item: FormValues['items'][number]) {
    const base = (Number(item.quantity) || 0) * (Number(item.unitCost) || 0)
    const taxable = Math.max(0, base - (Number(item.discountAmount) || 0))
    return taxable + taxable * ((Number(item.taxRate) || 0) / 100)
  }

  const subtotal = watchedItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0)
  const totalAmount = watchedItems.reduce((sum, item) => sum + lineTotal(item), 0)

  function addLandedCostRow() {
    setLandedCostRows(prev => [...prev, { costType: 'FREIGHT', amount: '', allocationMethod: 'BY_VALUE' }])
  }
  function updateLandedCostRow(index: number, patch: Partial<{ costType: string; amount: string; allocationMethod: 'BY_VALUE' | 'BY_QUANTITY' }>) {
    setLandedCostRows(prev => prev.map((r, i) => i === index ? { ...r, ...patch } : r))
  }
  function removeLandedCostRow(index: number) {
    setLandedCostRows(prev => prev.filter((_, i) => i !== index))
  }

  async function onSubmit(values: FormValues) {
    try {
      const validLandedCosts = landedCostRows
        .filter(r => parseFloat(r.amount) > 0)
        .map(r => ({ costType: r.costType, amount: parseFloat(r.amount), allocationMethod: r.allocationMethod }))
      const payload = {
        supplierId: values.supplierId,
        billDate: values.billDate || undefined,
        dueDate: values.dueDate || undefined,
        notes: values.notes || undefined,
        isReverseCharge: values.isReverseCharge,
        items: values.items.map(item => ({
          productId: item.lineType === 'PRODUCT' ? item.productId : undefined,
          serviceDescription: item.lineType === 'SERVICE' ? item.serviceDescription : undefined,
          serviceCategoryId: item.lineType === 'SERVICE' ? (item.serviceCategoryId || undefined) : undefined,
          quantity: item.quantity,
          unitCost: item.unitCost,
          discountAmount: item.discountAmount ?? 0,
          taxRate: item.taxRate ?? 0
        })),
        landedCosts: validLandedCosts.length > 0 ? validLandedCosts : undefined
      }
      const res = await window.api.bills.create(payload)
      if (res.success) {
        const bill = res.data as { id: string; billNumber: string }
        toastSuccess(t('bills.recordBill'), bill.billNumber)
        onSaved(bill.id)
      } else {
        toastError(t('common.error'), res.error?.message ?? t('common.error'))
      }
    } catch {
      toastError(t('common.error'), t('common.error'))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('bills.recordBill')}
      size="xl"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>{t('common.cancel')}</Button>
          <Button size="sm" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>{t('bills.recordBill')}</Button>
        </>
      }
    >
      {loadingData ? (
        <div className="space-y-3 py-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 bg-slate-100 dark:bg-slate-800 rounded animate-pulse" />)}
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1">
              {(() => {
                const supplierField = register('supplierId')
                return (
                  <Select
                    label={t('purchaseOrders.supplier')} required error={errors.supplierId?.message}
                    {...supplierField}
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') { setSupplierFormOpen(true); return }
                      supplierField.onChange(e)
                    }}
                  >
                    <option value="">{t('bills.selectSupplier')}</option>
                    <option value="__NEW__">{t('bills.addNewSupplier')}</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplierName} ({s.supplierCode})</option>)}
                  </Select>
                )
              })()}
            </div>
            <Input label={t('bills.billDate')} type="date" {...register('billDate')} />
            <Input label={t('bills.dueDate')} type="date" {...register('dueDate')} />
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">{t('purchaseOrders.items')}</p>
              <button type="button" onClick={() => append(emptyItem)}
                className="flex items-center gap-1 text-xs font-medium text-brand hover:text-brand/80 transition-colors">
                <Plus size={12} /> {t('purchaseOrders.addItem')}
              </button>
            </div>

            <div className="space-y-2">
              {fields.map((field, index) => {
                const lineType = watchedItems[index]?.lineType ?? 'PRODUCT'
                return (
                  <div key={field.id} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 p-0.5">
                        {(['PRODUCT', 'SERVICE'] as const).map(lt => (
                          <label key={lt} className={cn('px-2 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors', lineType === lt ? 'bg-brand text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-900')}>
                            <input type="radio" value={lt} {...register(`items.${index}.lineType`)} className="sr-only" />
                            {lt === 'PRODUCT' ? t('bills.product') : t('bills.service')}
                          </label>
                        ))}
                      </div>
                      <span className="flex-1" />
                      <button type="button" onClick={() => { if (fields.length > 1) remove(index) }}
                        disabled={fields.length === 1}
                        className="p-1.5 rounded text-slate-400 hover:text-danger hover:bg-danger/10 disabled:opacity-30 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>

                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-2 items-start">
                      <div>
                        {lineType === 'PRODUCT' ? (
                          <Controller
                            control={control}
                            name={`items.${index}.productId`}
                            render={({ field: f }) => (
                              <ProductPicker
                                products={products}
                                value={f.value ?? ''}
                                onChange={(productId) => handleProductChange(index, productId, f.onChange)}
                              />
                            )}
                          />
                        ) : (
                          <div className="space-y-1">
                            <input placeholder={t('bills.serviceDescription')}
                              {...register(`items.${index}.serviceDescription`)}
                              className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand" />
                            <select {...register(`items.${index}.serviceCategoryId`)}
                              className="w-full h-7 px-2 rounded border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900 text-slate-500">
                              <option value="">{t('bills.categoryOptional')}</option>
                              {categories.map(c => <option key={c.id} value={c.id}>{c.categoryName}</option>)}
                            </select>
                          </div>
                        )}
                        {errors.items?.[index] && (
                          <p className="text-xs text-danger mt-0.5">{(errors.items[index] as { message?: string })?.message}</p>
                        )}
                      </div>
                      <input type="number" min="1" step="1" placeholder={t('bills.quantity')} {...register(`items.${index}.quantity`)}
                        className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand" />
                      <input type="number" min="0" step="0.01" placeholder={t('bills.unitCost')} {...register(`items.${index}.unitCost`)}
                        className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand" />
                      <input type="number" min="0" step="0.01" placeholder={t('bills.discount')} {...register(`items.${index}.discountAmount`)}
                        className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand" />
                      <input type="number" min="0" max="100" step="0.5" placeholder={t('bills.taxPercent')} {...register(`items.${index}.taxRate`)}
                        className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand" />
                    </div>
                  </div>
                )
              })}
              {errors.items?.root && <p className="text-xs text-danger">{errors.items.root.message}</p>}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" {...register('isReverseCharge')} className="w-4 h-4 rounded accent-brand" />
            <span className="text-sm font-medium text-dark dark:text-slate-100">{t('bills.reverseCharge')}</span>
          </label>
          {watch('isReverseCharge') && (
            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-3">{t('bills.reverseChargeNote')}</p>
          )}

          {/* Phase 64 — landed cost, entered inline (see the state comment
              above for why a Bill can't add this after the fact the way a
              PO can). Allocated proportionally across the product lines
              above into their real ProductCostHistory unit cost. */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">{t('bills.landedCost.title')}</label>
              <button type="button" onClick={addLandedCostRow} className="flex items-center gap-1 text-xs text-brand hover:underline">
                <Plus size={12} /> {t('bills.landedCost.add')}
              </button>
            </div>
            {landedCostRows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                <select value={row.costType} onChange={(e) => updateLandedCostRow(i, { costType: e.target.value })}
                  className="h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                  {['FREIGHT', 'DUTY', 'HANDLING', 'OTHER'].map(ct => <option key={ct} value={ct}>{t(`bills.landedCost.type.${ct}`)}</option>)}
                </select>
                <input type="number" min="0" step="0.01" placeholder={t('bills.landedCost.amount')} value={row.amount} onChange={(e) => updateLandedCostRow(i, { amount: e.target.value })}
                  className="h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand" />
                <select value={row.allocationMethod} onChange={(e) => updateLandedCostRow(i, { allocationMethod: e.target.value as 'BY_VALUE' | 'BY_QUANTITY' })}
                  className="h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                  <option value="BY_VALUE">{t('bills.landedCost.byValue')}</option>
                  <option value="BY_QUANTITY">{t('bills.landedCost.byQuantity')}</option>
                </select>
                <button type="button" onClick={() => removeLandedCostRow(i)} className="text-slate-300 hover:text-danger"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>{t('billing.subtotal')}</span>
              <span>{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-dark dark:text-slate-100 border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-1.5">
              <span>{t('common.total')}</span>
              <span>{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">{t('bills.notesOptional')}</label>
            <textarea {...register('notes')} rows={2} placeholder={t('bills.internalNotes')}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand resize-none text-slate-700 dark:text-slate-300 placeholder-slate-400" />
          </div>
        </form>
      )}

      <SupplierFormModal
        open={supplierFormOpen}
        onClose={() => setSupplierFormOpen(false)}
        onSaved={handleSupplierCreated}
      />
    </Modal>
  )
}
