import React, { useEffect, useState } from 'react'
import { useMoneyContext } from '@shared/utils/money-context'
import { computeDocumentTotals, convertPriceMode } from '@money'
import { PricesIncludeTaxToggle } from '@shared/ui/molecules/PricesIncludeTaxToggle'
import { GstTypeSelector } from '@shared/ui/molecules/GstTypeSelector'
import { OffSlabRateWarning } from '@shared/ui/molecules/OffSlabRateWarning'
import { useGstTypeChoice } from '@shared/utils/gst-type-choice'
import { resolvePartyState } from '../../../../../shared/utils/gst-presentation'
import { splitTaxLines } from '@shared/utils/tax.util'
import { useBusinessStore } from '@app/store/business.store'
import { isGstType } from '@gst'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import { Modal } from '@shared/ui/molecules/Modal'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'
import { cn } from '@shared/utils/cn'
import { SupplierFormModal } from './SupplierFormModal'
import { ProductAutocomplete, type ProductOption } from '@shared/ui/organisms/ProductAutocomplete'

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
  supplierInvoiceNumber: z.string().max(60).optional(),
  supplierInvoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().max(500).optional(),
  isReverseCharge: z.boolean().default(false),
  pricesIncludeTax: z.boolean(),
  costCentreId: z.string().optional(),
  items: z.array(itemSchema).min(1, 'Add at least one item')
})

type FormValues = z.infer<typeof schema>

interface Supplier { id: string; supplierName: string; supplierCode: string; state?: string | null; taxNumber?: string | null }
interface ExpenseCategory { id: string; categoryName: string }
interface CostCentre { id: string; name: string }

// The shape of an existing bill as returned by bills:get, used to pre-fill the
// form when an OPEN, unpaid bill is being edited.
export interface EditableBill {
  id: string; billNumber: string; purchaseOrderId?: string | null
  supplier: { id: string }
  billDate: string; dueDate?: string | null; notes?: string | null
  supplierInvoiceNumber?: string | null; supplierInvoiceDate?: string | null
  isReverseCharge?: boolean; pricesIncludeTax?: boolean; gstType?: string | null; costCentreId?: string | null
  foreignCurrencyCode?: string | null; foreignExchangeRate?: number | null
  landedCosts?: { costType: string; amount: number; allocationMethod: string }[]
  items: {
    product: { id: string } | null; serviceDescription: string | null; serviceCategory: { id: string } | null
    quantity: number; unitCost: number; discountAmount: number; taxRate: number
  }[]
}

// Local calendar date (YYYY-MM-DD) from a stored timestamp, avoiding the
// off-by-one that toISOString() causes in timezones ahead of UTC.
function toLocalDateInput(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface BillFormModalProps {
  open: boolean
  onClose: () => void
  onSaved: (billId: string) => void
  defaultSupplierId?: string
  editBill?: EditableBill | null
}

export function BillFormModal({ open, onClose, onSaved, defaultSupplierId, editBill }: BillFormModalProps) {
  const { t } = useTranslation()
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [newCategoryFor, setNewCategoryFor] = useState<number | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)
  const [costCentres, setCostCentres] = useState<CostCentre[]>([])
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
  // 2026-09 — foreign-currency overlay, same local-state (not RHF-registered)
  // pattern as landedCostRows above and BillingScreen's own equivalent block.
  const [foreignCurrencyEnabled, setForeignCurrencyEnabled] = useState(false)
  const [foreignCurrencyCode, setForeignCurrencyCode] = useState('')
  const [foreignExchangeRate, setForeignExchangeRate] = useState('')

  const emptyItem = { lineType: 'PRODUCT' as const, productId: '', serviceDescription: '', serviceCategoryId: '', quantity: 1, unitCost: 0, discountAmount: 0, taxRate: 0 }

  const moneyCtx = useMoneyContext()
  const { control, register, handleSubmit, watch, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { supplierId: defaultSupplierId ?? '', billDate: '', supplierInvoiceNumber: '', supplierInvoiceDate: '', dueDate: '', notes: '', isReverseCharge: false, pricesIncludeTax: moneyCtx.pricesIncludeTaxDefault, costCentreId: '', items: [emptyItem] }
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'items' })
  const watchedItems = watch('items')
  const pricesIncludeTax = watch('pricesIncludeTax')
  const watchedSupplierId = watch('supplierId')
  const taxModel = useBusinessStore(s => s.profile?.taxModel ?? 'NONE')
  // A bill is presented by the supplier's state against the business state; an edited bill keeps its stored choice.
  const gstChoice = useGstTypeChoice(resolvePartyState(suppliers.find(s => s.id === watchedSupplierId)?.state, suppliers.find(s => s.id === watchedSupplierId)?.taxNumber))

  async function loadSuppliers() {
    const sRes = await window.api.suppliers.list({ limit: 200 })
    if (sRes.success) {
      const d = sRes.data as { suppliers: Supplier[] }
      setSuppliers(d.suppliers ?? [])
    } else {
      toastError(t('common.error'), t('bills.toasts.loadSuppliersFailed'))
    }
  }

  useEffect(() => {
    if (!open) return
    if (editBill && isGstType(editBill.gstType)) gstChoice.setGstType(editBill.gstType)
    else gstChoice.reset()
    if (editBill) {
      reset({
        supplierId: editBill.supplier.id,
        billDate: toLocalDateInput(editBill.billDate),
        supplierInvoiceNumber: editBill.supplierInvoiceNumber ?? '',
        supplierInvoiceDate: toLocalDateInput(editBill.supplierInvoiceDate),
        dueDate: toLocalDateInput(editBill.dueDate),
        notes: editBill.notes ?? '',
        isReverseCharge: !!editBill.isReverseCharge,
        pricesIncludeTax: !!editBill.pricesIncludeTax,
        costCentreId: editBill.costCentreId ?? '',
        items: editBill.items.map(i => ({
          lineType: i.product ? 'PRODUCT' as const : 'SERVICE' as const,
          productId: i.product?.id ?? '',
          serviceDescription: i.serviceDescription ?? '',
          serviceCategoryId: i.serviceCategory?.id ?? '',
          quantity: i.quantity, unitCost: i.unitCost, discountAmount: i.discountAmount, taxRate: i.taxRate
        }))
      })
      setLandedCostRows((editBill.landedCosts ?? []).map(l => ({ costType: l.costType, amount: String(l.amount), allocationMethod: l.allocationMethod === 'BY_QUANTITY' ? 'BY_QUANTITY' as const : 'BY_VALUE' as const })))
      const hasForeign = !!(editBill.foreignCurrencyCode && editBill.foreignExchangeRate)
      setForeignCurrencyEnabled(hasForeign)
      setForeignCurrencyCode(hasForeign ? editBill.foreignCurrencyCode ?? '' : '')
      setForeignExchangeRate(hasForeign ? String(editBill.foreignExchangeRate) : '')
    } else {
      reset({ supplierId: defaultSupplierId ?? '', billDate: '', supplierInvoiceNumber: '', supplierInvoiceDate: '', dueDate: '', notes: '', isReverseCharge: false, pricesIncludeTax: moneyCtx.pricesIncludeTaxDefault, costCentreId: '', items: [emptyItem] })
      setLandedCostRows([])
      setForeignCurrencyEnabled(false); setForeignCurrencyCode(''); setForeignExchangeRate('')
    }
    async function loadOptions() {
      setLoadingData(true)
      try {
        const [, cRes, ccRes] = await Promise.all([
          loadSuppliers(),
          window.api.expenses.listCategories(),
          window.api.costCentres.list()
        ])
        if (cRes.success) setCategories((cRes.data as ExpenseCategory[]) ?? [])
        if (ccRes.success) setCostCentres((ccRes.data as CostCentre[]) ?? [])
      } catch {
        toastError(t('common.error'), t('bills.toasts.loadOptionsFailed'))
      } finally {
        setLoadingData(false)
      }
    }
    loadOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultSupplierId, reset, editBill])

  async function handleSupplierCreated(newSupplier?: { id: string; supplierName: string }) {
    setSupplierFormOpen(false)
    await loadSuppliers()
    if (newSupplier) setValue('supplierId', newSupplier.id)
  }

  function handleProductChange(index: number, product: ProductOption, onChange: (v: string) => void) {
    const previousProductId = watchedItems[index]?.productId
    onChange(product.id)
    if (product.id !== previousProductId) {
      // Product cost price is kept tax-exclusive; express it in this bill's mode.
      setValue(`items.${index}.unitCost`, pricesIncludeTax ? convertPriceMode(product.costPrice ?? 0, product.taxRate ?? 0, true, moneyCtx.decimals) : (product.costPrice ?? 0))
      setValue(`items.${index}.taxRate`, product.taxRate ?? 0)
    }
  }

  // Same shared module bill.service.ts runs on save (src/shared/utils/money.ts), including the
  // reverse-charge rule: under RCM the tax is self-assessed and NOT part of the amount payable.
  // Flipping the switch re-expresses every entered cost and discount in the other mode, so the price agreed does not change.
  function changePriceMode(next: boolean) {
    watchedItems.forEach((it, idx) => {
      const rate = Number(it.taxRate) || 0
      setValue(`items.${idx}.unitCost`, convertPriceMode(Number(it.unitCost) || 0, rate, next, moneyCtx.decimals))
      setValue(`items.${idx}.discountAmount`, convertPriceMode(Number(it.discountAmount) || 0, rate, next, moneyCtx.decimals))
    })
    setValue('pricesIncludeTax', next)
  }
  const billTotals = computeDocumentTotals(
    watchedItems.map(i => ({ quantity: Number(i.quantity) || 0, unitPrice: Number(i.unitCost) || 0, discountAmount: Number(i.discountAmount) || 0, taxRate: Number(i.taxRate) || 0 })),
    { decimals: moneyCtx.decimals, excludeTaxFromTotal: watch('isReverseCharge') === true, pricesIncludeTax }
  )
  const subtotal = billTotals.subtotal
  const totalAmount = billTotals.totalAmount
  const billDiscount = billTotals.discountAmount
  const billTax = billTotals.taxAmount

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
        ...(editBill?.purchaseOrderId ? { purchaseOrderId: editBill.purchaseOrderId } : {}),
        supplierId: values.supplierId,
        billDate: values.billDate || undefined,
        supplierInvoiceNumber: values.supplierInvoiceNumber?.trim() || undefined,
        supplierInvoiceDate: values.supplierInvoiceDate || undefined,
        dueDate: values.dueDate || undefined,
        notes: values.notes || undefined,
        isReverseCharge: values.isReverseCharge,
        pricesIncludeTax: values.pricesIncludeTax,
        gstType: gstChoice.isGst ? gstChoice.gstType : undefined,
        costCentreId: values.costCentreId || undefined,
        items: values.items.map(item => ({
          productId: item.lineType === 'PRODUCT' ? item.productId : undefined,
          serviceDescription: item.lineType === 'SERVICE' ? item.serviceDescription : undefined,
          serviceCategoryId: item.lineType === 'SERVICE' ? (item.serviceCategoryId || undefined) : undefined,
          quantity: item.quantity,
          unitCost: item.unitCost,
          discountAmount: item.discountAmount ?? 0,
          taxRate: item.taxRate ?? 0
        })),
        landedCosts: validLandedCosts.length > 0 ? validLandedCosts : undefined,
        foreignCurrencyCode: foreignCurrencyEnabled && foreignCurrencyCode.trim() && Number(foreignExchangeRate) > 0 ? foreignCurrencyCode.trim() : undefined,
        foreignExchangeRate: foreignCurrencyEnabled && foreignCurrencyCode.trim() && Number(foreignExchangeRate) > 0 ? Number(foreignExchangeRate) : undefined
      }
      const res = editBill
        ? await window.api.bills.update({ id: editBill.id, ...payload })
        : await window.api.bills.create(payload)
      if (res.success) {
        const bill = res.data as { id: string; billNumber: string }
        toastSuccess(editBill ? t('bills.editBill') : t('bills.recordBill'), bill.billNumber)
        onSaved(bill.id)
      } else {
        toastError(t('common.error'), res.error?.message ?? t('bills.toasts.createFailed'))
      }
    } catch {
      toastError(t('common.error'), t('bills.toasts.createFailed'))
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editBill ? `${t('bills.editBill')} ${editBill.billNumber}` : t('bills.recordBill')}
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
            <Input label={t('bills.supplierInvoiceNumber')} {...register('supplierInvoiceNumber')} />
            <Input label={t('bills.supplierInvoiceDate')} type="date" {...register('supplierInvoiceDate')} />
            <Input label={t('bills.billDate')} type="date" {...register('billDate')} />
            <Input label={t('bills.dueDate')} type="date" {...register('dueDate')} />
          </div>

          <PricesIncludeTaxToggle checked={pricesIncludeTax} onChange={changePriceMode} />
          {gstChoice.isGst && <GstTypeSelector value={gstChoice.gstType} onChange={gstChoice.setGstType} isAuto={gstChoice.isAuto} />}

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
                              <ProductAutocomplete
                                value={f.value ?? ''}
                                onChange={(p) => handleProductChange(index, p, f.onChange)}
                                onlyProductType="STANDARD"
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
                            {newCategoryFor === index ? (
                              <div className="flex gap-1">
                                <input autoFocus value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder={t('bills.newCategoryName')}
                                  className="flex-1 h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-xs bg-white dark:bg-slate-900" />
                                <Button size="sm" loading={savingCategory} disabled={!newCategoryName.trim()} onClick={async () => {
                                  setSavingCategory(true)
                                  try {
                                    const res = await window.api.expenses.createCategory({ categoryName: newCategoryName.trim() })
                                    if (res.success && res.data) {
                                      const created = res.data as ExpenseCategory
                                      setCategories(prev => [...prev, created].sort((a, b) => a.categoryName.localeCompare(b.categoryName)))
                                      setValue(`items.${index}.serviceCategoryId`, created.id)
                                      setNewCategoryFor(null); setNewCategoryName('')
                                    } else toastError(t('common.error'), res.error?.message ?? t('bills.couldNotAddCategory'))
                                  } finally { setSavingCategory(false) }
                                }}>{t('common.add')}</Button>
                                <Button size="sm" variant="ghost" onClick={() => { setNewCategoryFor(null); setNewCategoryName('') }}>{t('common.cancel')}</Button>
                              </div>
                            ) : (
                              <button type="button" onClick={() => setNewCategoryFor(index)} className="text-xs text-brand hover:underline">{t('bills.addCategory')}</button>
                            )}
                          </div>
                        )}
                        {errors.items?.[index] && (
                          <p className="text-xs text-danger mt-0.5">{(errors.items[index] as { message?: string })?.message}</p>
                        )}
                      </div>
                      <input type="number" min="1" step="1" placeholder={t('bills.quantity')} {...register(`items.${index}.quantity`)}
                        className="w-full h-8 px-2 rounded border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-brand" />
                      <input type="number" min="0" step="0.01" placeholder={`${t('bills.unitCost')} ${pricesIncludeTax ? t('billing.priceInclTax') : t('billing.priceExclTax')}`} {...register(`items.${index}.unitCost`)}
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

          {costCentres.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t('costCentres.title')}</label>
              <select {...register('costCentreId')} className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300">
                <option value="">{t('costCentres.none')}</option>
                {costCentres.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
              </select>
            </div>
          )}

          {/* 2026-09 — foreign-currency overlay: the vendor's own bill shown/
              printed in their currency while totalAmount/AP/GL stay entirely
              in the business's base currency. */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer mb-1.5">
              <input
                type="checkbox"
                checked={foreignCurrencyEnabled}
                onChange={e => { setForeignCurrencyEnabled(e.target.checked); if (!e.target.checked) { setForeignCurrencyCode(''); setForeignExchangeRate('') } }}
                className="w-4 h-4 rounded accent-brand"
              />
              <span className="text-sm font-medium text-dark dark:text-slate-100">{t('bills.foreignCurrency.toggle')}</span>
            </label>
            {foreignCurrencyEnabled && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={foreignCurrencyCode}
                  onChange={e => setForeignCurrencyCode(e.target.value.toUpperCase())}
                  placeholder={t('bills.foreignCurrency.codePlaceholder')}
                  maxLength={10}
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                />
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={foreignExchangeRate}
                  onChange={e => setForeignExchangeRate(e.target.value)}
                  placeholder={t('bills.foreignCurrency.ratePlaceholder')}
                  className="w-full h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                />
              </div>
            )}
          </div>

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

          <OffSlabRateWarning rates={watchedItems.map(i => Number(i.taxRate) || 0)} />
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>{t('billing.subtotal')}</span>
              <span>{subtotal.toFixed(moneyCtx.decimals)}</span>
            </div>
            {billDiscount > 0 && (
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>{t('billing.discount')}</span>
                <span>- {billDiscount.toFixed(moneyCtx.decimals)}</span>
              </div>
            )}
            {splitTaxLines(taxModel, billTax, gstChoice.gstType, moneyCtx.decimals, billTotals.lines.map(l => ({ taxRate: l.taxRate, taxAmount: l.tax }))).map(line => (
              <div key={line.label} className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>{line.label}</span>
                <span>{line.amount.toFixed(moneyCtx.decimals)}</span>
              </div>
            ))}
            <div className="flex justify-between font-semibold text-dark dark:text-slate-100 border-t border-slate-200 dark:border-slate-700 pt-1.5 mt-1.5">
              <span>{t('common.total')}</span>
              <span>{totalAmount.toFixed(moneyCtx.decimals)}</span>
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
