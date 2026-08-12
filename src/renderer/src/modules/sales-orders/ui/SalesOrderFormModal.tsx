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
import { CustomerFormModal } from '@modules/customers/ui/CustomerFormModal'

// A line is either a real product (productId) or a free-text service
// (serviceDescription) — mirrors BillFormModal's own item shape, see
// sales-order.validation.ts's server-side twin.
const itemSchema = z.object({
  lineType: z.enum(['PRODUCT', 'SERVICE']),
  productId: z.string().optional(),
  serviceDescription: z.string().optional(),
  serviceCategoryId: z.string().optional(),
  quantity: z.coerce.number().positive('Must be > 0'),
  unitPrice: z.coerce.number().min(0, 'Cannot be negative'),
  taxRate: z.coerce.number().min(0).max(100).default(0)
}).refine(item => item.lineType === 'PRODUCT' ? !!item.productId : !!item.serviceDescription?.trim(), {
  message: 'Select a product or enter a service description'
})

const schema = z.object({
  customerId: z.string().min(1, 'Select a customer'),
  expectedDate: z.string().optional(),
  notes: z.string().max(500).optional(),
  items: z.array(itemSchema).min(1, 'Add at least one item')
})

type FormValues = z.infer<typeof schema>

interface Customer { id: string; customerName: string; customerCode: string }
interface Product { id: string; productName: string; sku?: string | null; unit: string; productType: string; sellingPrice: number }
interface ExpenseCategory { id: string; categoryName: string }

interface SalesOrderFormModalProps {
  open: boolean
  onClose: () => void
  onSaved: (soId: string) => void
  defaultCustomerId?: string
}

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

export function SalesOrderFormModal({ open, onClose, onSaved, defaultCustomerId }: SalesOrderFormModalProps) {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [customerFormOpen, setCustomerFormOpen] = useState(false)

  const emptyItem = { lineType: 'PRODUCT' as const, productId: '', serviceDescription: '', serviceCategoryId: '', quantity: 1, unitPrice: 0, taxRate: 0 }

  const { control, register, handleSubmit, watch, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { customerId: defaultCustomerId ?? '', expectedDate: '', notes: '', items: [emptyItem] }
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = watch('items')

  async function loadCustomers() {
    const cRes = await window.api.customers.list({ limit: 200 })
    if (cRes.success) {
      const d = cRes.data as { customers: Customer[] }
      setCustomers(d.customers ?? [])
    } else {
      toastError(t('common.error'), cRes.error?.message ?? t('common.error'))
    }
  }

  useEffect(() => {
    if (!open) return
    reset({ customerId: defaultCustomerId ?? '', expectedDate: '', notes: '', items: [emptyItem] })
    async function loadOptions() {
      setLoadingData(true)
      try {
        const [, pRes, cRes] = await Promise.all([
          loadCustomers(),
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
  }, [open, defaultCustomerId, reset])

  async function handleCustomerCreated(newCustomer?: { id: string; customerName: string }) {
    setCustomerFormOpen(false)
    await loadCustomers()
    if (newCustomer) setValue('customerId', newCustomer.id)
  }

  function handleProductChange(index: number, productId: string, onChange: (v: string) => void) {
    const previousProductId = watchedItems[index]?.productId
    onChange(productId)
    const product = products.find(p => p.id === productId)
    if (product && productId !== previousProductId) {
      setValue(`items.${index}.unitPrice`, product.sellingPrice ?? 0)
    }
  }

  function lineTotal(item: FormValues['items'][number]) {
    const base = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)
    return base + base * ((Number(item.taxRate) || 0) / 100)
  }

  const subtotal = watchedItems.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0)
  const totalAmount = watchedItems.reduce((sum, item) => sum + lineTotal(item), 0)

  async function onSubmit(values: FormValues) {
    try {
      const payload = {
        customerId: values.customerId,
        expectedDate: values.expectedDate || undefined,
        notes: values.notes || undefined,
        items: values.items.map(item => ({
          productId: item.lineType === 'PRODUCT' ? item.productId : undefined,
          serviceDescription: item.lineType === 'SERVICE' ? item.serviceDescription : undefined,
          serviceCategoryId: item.lineType === 'SERVICE' ? (item.serviceCategoryId || undefined) : undefined,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxRate: item.taxRate ?? 0
        }))
      }
      const res = await window.api.salesOrders.create(payload)
      if (res.success) {
        const so = res.data as { id: string; soNumber: string }
        toastSuccess(t('salesOrders.newOrder'), so.soNumber)
        onSaved(so.id)
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
      title={t('salesOrders.newOrder')}
      size="xl"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>{t('common.cancel')}</Button>
          <Button size="sm" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>{t('salesOrders.newOrder')}</Button>
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
                const customerField = register('customerId')
                return (
                  <Select
                    label={t('salesOrders.customer')} required error={errors.customerId?.message}
                    {...customerField}
                    onChange={(e) => {
                      if (e.target.value === '__NEW__') { setCustomerFormOpen(true); return }
                      customerField.onChange(e)
                    }}
                  >
                    <option value="">{t('salesOrders.selectCustomer')}</option>
                    <option value="__NEW__">{t('salesOrders.addNewCustomer')}</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.customerName} ({c.customerCode})</option>)}
                  </Select>
                )
              })()}
            </div>
            <Input label={t('salesOrders.expectedDate')} type="date" {...register('expectedDate')} />
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

                    <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 items-start">
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
                      <input type="number" min="0" step="0.01" placeholder={t('salesOrders.unitPrice')} {...register(`items.${index}.unitPrice`)}
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

      <CustomerFormModal
        open={customerFormOpen}
        onClose={() => setCustomerFormOpen(false)}
        onSaved={handleCustomerCreated}
      />
    </Modal>
  )
}
