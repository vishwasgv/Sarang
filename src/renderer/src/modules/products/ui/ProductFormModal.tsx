import React, { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ImagePlus, X, Barcode as BarcodeIcon } from 'lucide-react'
import { Modal } from '@shared/ui/molecules/Modal'
import { Button } from '@shared/ui/atoms/Button'
import { Input } from '@shared/ui/atoms/Input'
import { Select } from '@shared/ui/atoms/Select'
import { useNotificationStore } from '@app/store/notification.store'
import { useIndustryStore } from '@app/store/industry.store'

const schema = z.object({
  productName: z.string().min(1, 'Product name is required').max(200),
  categoryId: z.string().optional(),
  sku: z.string().max(50).optional(),
  barcode: z.string().max(50).optional(),
  hsnCode: z.string().max(20).optional(),
  description: z.string().max(500).optional(),
  productType: z.enum(['STANDARD', 'SERVICE']),
  unit: z.string().min(1, 'Unit is required').max(20),
  costPrice: z.coerce.number().min(0),
  sellingPrice: z.coerce.number().min(0),
  mrp: z.coerce.number().min(0).optional(),
  taxRate: z.coerce.number().min(0).max(100),
  reorderLevel: z.coerce.number().min(0).optional(),
  reorderQuantity: z.coerce.number().min(0).optional(),
  // Phase 58 §2 — generic reorder automation: which supplier to draft a PO
  // against when this product runs low. Not Pharmacy-specific, but shown
  // near Reorder Level/Quantity since that's what it acts on.
  defaultSupplierId: z.string().optional(),
  openingQuantity: z.coerce.number().min(0).optional(),
  imagePath: z.string().optional(),
  // Phase 58 §2 — Pharmacy Schedule H/H1 prescription-only medicine flag.
  isPrescriptionRequired: z.boolean().default(false),
  // Phase 58 §2 — category-specific expiry alert lead time (e.g. Agri Inputs
  // seed/fertilizer needing a much longer heads-up than a pharmacy's 30-day
  // medicine cutoff). Empty means "use the generic 30-day default."
  expiryAlertLeadDays: z.coerce.number().int().min(1).max(1000).optional(),
  // Phase 38: loose/weight-based billing — a product is sold loose OR in fixed
  // packs, never both, in this version (see PHASE_38_TECHNICAL_SPEC.md §1.1).
  sellByWeight: z.boolean().default(false),
  weightUnit: z.enum(['kg', 'g', 'L', 'mL']).optional(),
  pricePerWeightUnit: z.coerce.number().min(0).optional(),
  // Phase 58 §2 — carton/box-to-loose-piece unit conversion.
  sellByPack: z.boolean().default(false),
  packUnit: z.string().max(20).optional(),
  unitsPerPack: z.coerce.number().positive().optional(),
  // Phase 48: apparel gender, surfaced only when variant_tracking is on.
  gender: z.enum(['MENS', 'WOMENS', 'UNISEX']).optional(),
  // Phase 54G: rental. rentalRates (an array of {basis, amount} pairs) is
  // deliberately NOT part of this schema — it's managed as separate local
  // state (like PayrollScreen's deduction lines) since a variable-length rate
  // table doesn't fit react-hook-form's flat field model, and is JSON-
  // stringified into the submit payload alongside these values.
  isRentable: z.boolean().default(false),
  rentalTrackingType: z.enum(['UNIT', 'BULK']).optional(),
  rentalSecurityDeposit: z.coerce.number().min(0).optional(),
  // Fresh-audit build (2026-07-12) — Jewellery vertical. metalType left unset
  // means "not a jewellery item" (opt-in per product, same as sellByWeight/
  // isRentable), even on a JEWELLERY business — a jewellery shop can still
  // sell a plain fixed-price item (a gift box, a cleaning kit) normally.
  metalType: z.enum(['GOLD', 'SILVER', 'PLATINUM']).optional(),
  purity: z.string().max(20).optional(),
  hallmarkNumber: z.string().max(50).optional(),
  grossWeight: z.coerce.number().min(0).optional(),
  stoneWeight: z.coerce.number().min(0).optional(),
  makingChargeType: z.enum(['FIXED', 'PER_GRAM', 'PERCENTAGE']).optional(),
  makingChargeValue: z.coerce.number().min(0).optional(),
}).superRefine((data, ctx) => {
  if (data.sellByWeight) {
    if (!data.weightUnit) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['weightUnit'], message: 'Select a unit for loose/weight-based selling.' })
    if (data.pricePerWeightUnit === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pricePerWeightUnit'], message: 'Set a price per unit.' })
  }
  if (data.sellByPack) {
    if (!data.packUnit?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['packUnit'], message: 'Name the pack unit (e.g. BOX, CARTON).' })
    if (data.unitsPerPack === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['unitsPerPack'], message: 'Set how many base units are in 1 pack.' })
  }
  if (data.isRentable && !data.rentalTrackingType) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['rentalTrackingType'], message: 'Select how this item is tracked (individual units, or bulk quantity).' })
  }
  if (data.metalType) {
    if (!data.purity?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['purity'], message: 'Purity is required for a metal item.' })
    if (data.grossWeight === undefined || data.grossWeight <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['grossWeight'], message: 'Gross weight must be greater than zero.' })
    if (data.stoneWeight !== undefined && data.grossWeight !== undefined && data.stoneWeight >= data.grossWeight) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['stoneWeight'], message: 'Stone weight must be less than gross weight.' })
    }
  }
})

type FormValues = z.infer<typeof schema>

interface Category { id: string; name: string }
interface Product {
  id: string; productName: string; categoryId?: string | null; sku?: string | null; barcode?: string | null; hsnCode?: string | null; description?: string | null; productType: 'STANDARD' | 'SERVICE'; unit: string; costPrice: number; sellingPrice: number; mrp?: number | null; taxRate: number; imagePath?: string | null; inventory?: { reorderLevel: number; reorderQuantity: number } | null
  sellByWeight?: boolean; weightUnit?: string | null; pricePerWeightUnit?: number | null
  sellByPack?: boolean; packUnit?: string | null; unitsPerPack?: number | null
  gender?: string | null
  isPrescriptionRequired?: boolean; defaultSupplierId?: string | null
  expiryAlertLeadDays?: number | null
  isRentable?: boolean; rentalTrackingType?: 'UNIT' | 'BULK' | null; rentalRates?: { basis: string; amount: number }[]; rentalSecurityDeposit?: number | null
  metalType?: string | null; purity?: string | null; hallmarkNumber?: string | null
  grossWeight?: number | null; stoneWeight?: number | null; netWeight?: number | null
  makingChargeType?: string | null; makingChargeValue?: number | null
}

const RATE_BASIS_OPTIONS = ['HOUR', 'DAY', 'WEEK', 'MONTH', 'YEAR'] as const

interface ProductFormModalProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
  product?: Product | null
  categories: Category[]
}

// SQFT/SQM added for the Hardware/Glass/Plywood template's area-pricing
// feature (spec §9.4 "Custom measurement units") — without a proper area
// unit, a glass/plywood product had to be mislabeled as "M" or "PCS" on
// every invoice even though it's priced by L×W area.
const UNITS = ['PCS', 'KG', 'G', 'L', 'ML', 'M', 'CM', 'SQFT', 'SQM', 'BOX', 'DOZEN', 'PACKET', 'PAIR', 'SET', 'BOTTLE', 'BAG', 'ROLL', 'HOUR', 'SERVICE']

export function ProductFormModal({ open, onClose, onSaved, product, categories }: ProductFormModalProps) {
  const { success: toastSuccess, error: toastError } = useNotificationStore()
  const { isModuleEnabled } = useIndustryStore()
  // Phase 38: opt-in, off by default for every business type — see
  // TEMPLATE_DEFAULTS in industry-template.service.ts.
  const looseBillingEnabled = isModuleEnabled('loose_billing')
  const packBillingEnabled = isModuleEnabled('pack_billing')
  const barcodeGenerationEnabled = isModuleEnabled('barcode_generation')
  // Phase 48 — same flag CLOTHING/FOOTWEAR already default to, no new flag needed.
  const variantTrackingEnabled = isModuleEnabled('variant_tracking')
  // Phase 54G — Rental business type only.
  const rentalEnabled = isModuleEnabled('rental_bookings')
  // Fresh-audit build (2026-07-12) — Jewellery business type only.
  const jewelleryEnabled = isModuleEnabled('jewellery_pricing')
  const expiryTrackingEnabled = isModuleEnabled('expiry_tracking')
  const isEdit = !!product
  const [imagePickerLoading, setImagePickerLoading] = useState(false)
  const [generatingBarcode, setGeneratingBarcode] = useState(false)
  // Rate table managed as separate local state, not RHF-registered — same
  // reasoning PayrollScreen's deduction lines already established (a
  // variable-length array doesn't fit the flat-field model cleanly).
  const [rateLines, setRateLines] = useState<{ basis: string; amount: number }[]>([])
  // Fresh-audit fix (2026-07-12): Tax Rate was a raw free-typed number,
  // completely disconnected from Settings → Tax Configuration — if a
  // configured rate changes (VAT rates change yearly, per the founder's own
  // standing requirement), every product using it had to be found and
  // retyped by hand, one at a time. This doesn't replace the free-typed
  // field (a product may genuinely need a one-off rate not in the list) —
  // it adds a one-click way to apply any currently configured rate.
  const [taxConfigs, setTaxConfigs] = useState<{ id: string; taxName: string; rate: number; isDefault: boolean }[]>([])

  const { control, register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { productType: 'STANDARD', unit: 'PCS', costPrice: 0, sellingPrice: 0, taxRate: 0, reorderLevel: 5, reorderQuantity: 10, openingQuantity: 0, sellByWeight: false, sellByPack: false, isPrescriptionRequired: false }
  })
  const { businessType } = useIndustryStore()
  const isPharmacy = businessType === 'PHARMACY'
  const [suppliers, setSuppliers] = useState<{ id: string; supplierName: string }[]>([])
  useEffect(() => {
    if (open) {
      window.api.suppliers.list({ limit: 200 }).then((res) => {
        if (res.success && res.data) setSuppliers(((res.data as { suppliers?: unknown[] }).suppliers ?? res.data) as { id: string; supplierName: string }[])
      }).catch(() => {})
    }
  }, [open])

  const productType = watch('productType')
  const imagePath = watch('imagePath')
  const sellByWeight = watch('sellByWeight')
  const sellByPack = watch('sellByPack')
  const currentBarcode = watch('barcode')
  const isRentable = watch('isRentable')
  const rentalTrackingType = watch('rentalTrackingType')
  const metalType = watch('metalType')
  const grossWeight = watch('grossWeight')
  const stoneWeight = watch('stoneWeight')
  const makingChargeType = watch('makingChargeType')

  function addRateLine() {
    const unused = RATE_BASIS_OPTIONS.find((b) => !rateLines.some((r) => r.basis === b))
    if (unused) setRateLines((prev) => [...prev, { basis: unused, amount: 0 }])
  }
  function updateRateLine(index: number, amount: number) {
    setRateLines((prev) => prev.map((r, i) => i === index ? { ...r, amount } : r))
  }
  function removeRateLine(index: number) {
    setRateLines((prev) => prev.filter((_, i) => i !== index))
  }

  useEffect(() => {
    if (open) {
      window.api.tax.list().then((res) => {
        if (res.success && res.data) setTaxConfigs(res.data as typeof taxConfigs)
      }).catch(() => {})
    }
  }, [open])

  useEffect(() => {
    if (open) {
      if (product) {
        reset({
          productName: product.productName,
          categoryId: product.categoryId ?? undefined,
          sku: product.sku ?? undefined,
          barcode: product.barcode ?? undefined,
          hsnCode: product.hsnCode ?? undefined,
          description: product.description ?? undefined,
          productType: product.productType,
          unit: product.unit,
          costPrice: product.costPrice,
          sellingPrice: product.sellingPrice,
          mrp: product.mrp ?? undefined,
          taxRate: product.taxRate,
          imagePath: product.imagePath ?? undefined,
          reorderLevel: product.inventory?.reorderLevel ?? 5,
          reorderQuantity: product.inventory?.reorderQuantity ?? 10,
          defaultSupplierId: product.defaultSupplierId ?? undefined,
          isPrescriptionRequired: product.isPrescriptionRequired ?? false,
          expiryAlertLeadDays: product.expiryAlertLeadDays ?? undefined,
          sellByWeight: product.sellByWeight ?? false,
          weightUnit: (product.weightUnit as FormValues['weightUnit']) ?? undefined,
          pricePerWeightUnit: product.pricePerWeightUnit ?? undefined,
          sellByPack: product.sellByPack ?? false,
          packUnit: product.packUnit ?? undefined,
          unitsPerPack: product.unitsPerPack ?? undefined,
          gender: (product.gender as FormValues['gender']) ?? undefined,
          isRentable: product.isRentable ?? false,
          rentalTrackingType: (product.rentalTrackingType as FormValues['rentalTrackingType']) ?? undefined,
          rentalSecurityDeposit: product.rentalSecurityDeposit ?? undefined,
          metalType: (product.metalType as FormValues['metalType']) ?? undefined,
          purity: product.purity ?? undefined,
          hallmarkNumber: product.hallmarkNumber ?? undefined,
          grossWeight: product.grossWeight ?? undefined,
          stoneWeight: product.stoneWeight ?? undefined,
          makingChargeType: (product.makingChargeType as FormValues['makingChargeType']) ?? undefined,
          makingChargeValue: product.makingChargeValue ?? undefined,
        })
        setRateLines(product.rentalRates ?? [])
      } else {
        reset({ productType: 'STANDARD', unit: 'PCS', costPrice: 0, sellingPrice: 0, taxRate: 0, reorderLevel: 5, reorderQuantity: 10, openingQuantity: 0, sellByWeight: false, sellByPack: false, isRentable: false, isPrescriptionRequired: false })
        setRateLines([])
      }
    }
  }, [open, product, reset])

  async function generateBarcodeNow() {
    if (!product) return
    setGeneratingBarcode(true)
    try {
      const res = await window.api.products.generateBarcode({ productId: product.id })
      if (res.success) {
        setValue('barcode', (res.data as { barcode: string }).barcode)
        toastSuccess('Barcode Generated', 'A new barcode has been assigned to this product.')
      } else {
        toastError('Error', res.error?.message ?? 'Could not generate a barcode.')
      }
    } finally {
      setGeneratingBarcode(false)
    }
  }

  async function pickImage() {
    setImagePickerLoading(true)
    try {
      const res = await window.api.dialog.openFile({ title: 'Select Product Image', accept: ['.jpg', '.jpeg', '.png', '.webp'] })
      if (res.success && res.data) {
        setValue('imagePath', res.data as string)
      } else if (!res.success) {
        toastError('Error', res.error?.message ?? 'Could not open file picker.')
      }
    } catch {
      toastError('Error', 'Could not open file picker.')
    } finally {
      setImagePickerLoading(false)
    }
  }

  async function onSubmit(values: FormValues) {
    try {
      const payload = { ...values, rentalRates: values.isRentable ? rateLines : [] }
      const response = isEdit
        ? await window.api.products.update({ id: product!.id, ...payload })
        : await window.api.products.create(payload)

      if (!response.success) {
        toastError('Error', response.error?.message ?? 'Failed to save product.')
        return
      }
      // Phase 38: if barcode_generation is on and the owner didn't type one,
      // product.service.ts auto-generates one server-side after creation — but
      // this form closes immediately on success, so without surfacing it here
      // the owner would have no idea a barcode exists until they reopen the
      // product to edit it.
      const savedProduct = response.data as { barcode?: string | null } | null
      const autoGenerated = !isEdit && !values.barcode && savedProduct?.barcode
      toastSuccess(
        isEdit ? 'Product Updated' : 'Product Created',
        autoGenerated
          ? `${values.productName} has been saved. Barcode auto-generated: ${savedProduct!.barcode}`
          : `${values.productName} has been saved.`
      )
      onSaved()
      onClose()
    } catch {
      toastError('Error', 'Something went wrong. Please try again.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Product' : 'Add Product'}
      size="xl"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            {isEdit ? 'Save Changes' : 'Add Product'}
          </Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Input label="Product Name *" placeholder="e.g. Masala Chai Powder" {...register('productName')} error={errors.productName?.message} />
          </div>
          <div>
            <Select label="Category" {...register('categoryId')}>
              <option value="">No Category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Type *</label>
            <Controller name="productType" control={control} render={({ field }) => (
              <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                {(['STANDARD', 'SERVICE'] as const).map(t => (
                  <button type="button" key={t} onClick={() => field.onChange(t)}
                    className={`flex-1 py-2 text-xs font-medium transition-colors ${field.value === t ? 'bg-brand text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                  >
                    {t === 'STANDARD' ? 'Physical' : 'Service'}
                  </button>
                ))}
              </div>
            )} />
          </div>
        </div>

        {/* Identifiers */}
        <div className="grid grid-cols-3 gap-4">
          <Input label="SKU" placeholder="e.g. MCP-001" {...register('sku')} error={errors.sku?.message} />
          <div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input label="Barcode" placeholder="Scan or enter" {...register('barcode')} error={errors.barcode?.message} />
              </div>
              {barcodeGenerationEnabled && isEdit && !currentBarcode && (
                <Button type="button" variant="secondary" size="sm" onClick={generateBarcodeNow} loading={generatingBarcode} className="mb-0.5" title="Generate a barcode for this product">
                  <BarcodeIcon size={14} />
                </Button>
              )}
            </div>
          </div>
          <div>
            <Select label="Unit" required {...register('unit')}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </Select>
          </div>
          <Input label="HSN/SAC Code" placeholder="e.g. 8471" {...register('hsnCode')} error={errors.hsnCode?.message} />
          {variantTrackingEnabled && (
            <div>
              <Select label="Gender" {...register('gender')}>
                <option value="">Not specified</option>
                <option value="MENS">Men's</option>
                <option value="WOMENS">Women's</option>
                <option value="UNISEX">Unisex</option>
              </Select>
            </div>
          )}
        </div>

        {/* Pricing */}
        <div className="grid grid-cols-4 gap-4">
          <Input label="Cost Price *" type="number" step="0.01" min="0" {...register('costPrice')} error={errors.costPrice?.message} />
          <Input label="Selling Price *" type="number" step="0.01" min="0" {...register('sellingPrice')} error={errors.sellingPrice?.message} />
          <Input label="MRP (optional)" type="number" step="0.01" min="0" {...register('mrp')} error={errors.mrp?.message} />
          <div>
            <Input label="Tax Rate %" type="number" step="0.5" min="0" max="100" {...register('taxRate')} error={errors.taxRate?.message} />
            {taxConfigs.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {taxConfigs.map((tc) => (
                  <button
                    key={tc.id}
                    type="button"
                    onClick={() => setValue('taxRate', tc.rate, { shouldValidate: true })}
                    className="text-xs px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-brand hover:text-brand transition-colors"
                    title={`Apply ${tc.taxName} (${tc.rate}%)`}
                  >
                    {tc.taxName} {tc.rate}%{tc.isDefault ? ' •' : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Phase 38: Loose / weight-based billing — opt-in, hidden entirely unless
            the owner has turned the loose_billing module on in Settings. A product
            is sold loose OR in fixed packs, never both, in this version. */}
        {looseBillingEnabled && productType === 'STANDARD' && (
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('sellByWeight')} className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Sell this product loose / by weight</span>
            </label>
            <p className="text-xs text-slate-400 mt-1 ml-6">e.g. rice sold per kg instead of by the packet. Stock for this product is tracked directly in the unit below.</p>
            {sellByWeight && (
              <div className="grid grid-cols-2 gap-4 mt-3 ml-6">
                <div>
                  <Select label="Unit *" {...register('weightUnit')} error={errors.weightUnit?.message}>
                    <option value="">Select…</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="L">L</option>
                    <option value="mL">mL</option>
                  </Select>
                </div>
                <Input label="Price per Unit *" type="number" step="0.01" min="0" placeholder="e.g. 80 for ₹80/kg" {...register('pricePerWeightUnit')} error={errors.pricePerWeightUnit?.message} />
              </div>
            )}
          </div>
        )}

        {/* Phase 58 §2 — carton/box-to-loose-piece unit conversion. Stock
            and sale are always in the base unit above; this only records
            how many base units a purchased pack contains, as a Stock
            Adjustment convenience when receiving a shipment. */}
        {packBillingEnabled && productType === 'STANDARD' && (
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('sellByPack')} className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Received in cartons/boxes, sold as individual pieces</span>
            </label>
            <p className="text-xs text-slate-400 mt-1 ml-6">e.g. a box of 50 screws — stock stays tracked in the unit above, this just converts pack quantity to pieces when receiving stock.</p>
            {sellByPack && (
              <div className="grid grid-cols-2 gap-4 mt-3 ml-6">
                <Input label="Pack Unit *" placeholder="e.g. BOX, CARTON" {...register('packUnit')} error={errors.packUnit?.message} />
                <Input label="Units per Pack *" type="number" step="1" min="1" placeholder="e.g. 50" {...register('unitsPerPack')} error={errors.unitsPerPack?.message} />
              </div>
            )}
          </div>
        )}

        {/* Phase 54G: Rental — opt-in, hidden entirely unless the Rental
            business type's rental_bookings module is on. */}
        {rentalEnabled && productType === 'STANDARD' && (
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" {...register('isRentable')} className="w-4 h-4 rounded border-slate-300 text-brand focus:ring-brand" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">This item can be rented out</span>
            </label>
            {isRentable && (
              <div className="mt-3 ml-6 space-y-3">
                <Select label="Tracking Type *" {...register('rentalTrackingType')} error={errors.rentalTrackingType?.message}>
                  <option value="">Select…</option>
                  <option value="UNIT">Individual units (e.g. a specific car, bike, or villa)</option>
                  <option value="BULK">Bulk quantity (e.g. 50 chairs, 20 tents)</option>
                </Select>
                {rentalTrackingType === 'UNIT' && (
                  <p className="text-xs text-slate-400">Add the individual units for this item from the Rental Units screen after saving.</p>
                )}

                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">Rental Rates</p>
                  {rateLines.length === 0 && <p className="text-xs text-slate-400 mb-2">No rates added yet.</p>}
                  {rateLines.map((r, i) => (
                    <div key={r.basis} className="flex items-center gap-2 mb-2">
                      <span className="w-20 text-xs text-slate-500">{r.basis}</span>
                      <input type="number" min="0" step="0.01" value={r.amount} onChange={(e) => updateRateLine(i, Number(e.target.value))}
                        className="flex-1 h-9 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 dark:text-slate-100" />
                      <button type="button" onClick={() => removeRateLine(i)} className="text-slate-300 hover:text-danger"><X size={16} /></button>
                    </div>
                  ))}
                  {rateLines.length < RATE_BASIS_OPTIONS.length && (
                    <Button type="button" variant="secondary" size="sm" onClick={addRateLine}>+ Add Rate</Button>
                  )}
                </div>

                <Input label="Security Deposit" type="number" step="0.01" min="0" {...register('rentalSecurityDeposit')} error={errors.rentalSecurityDeposit?.message} />
              </div>
            )}
          </div>
        )}

        {/* Fresh-audit build (2026-07-12): Jewellery — opt-in per product,
            hidden entirely unless the Jewellery business type's
            jewellery_pricing module is on. A jewellery shop can still sell a
            plain fixed-price item (a gift box) normally — metalType left
            unset means "not a metal item," Selling Price above is used as-is. */}
        {jewelleryEnabled && productType === 'STANDARD' && (
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-3">
            <Select label="Metal Type" {...register('metalType')}>
              <option value="">Not a metal item — use Selling Price above</option>
              <option value="GOLD">Gold</option>
              <option value="SILVER">Silver</option>
              <option value="PLATINUM">Platinum</option>
            </Select>
            {metalType && (
              <>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  The real sale price is computed at billing time from today's metal rate — Selling Price above is ignored for this item. Set today's rates in Jewellery → Metal Rates.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Purity *" placeholder='e.g. "22K", "18K", "999"' {...register('purity')} error={errors.purity?.message} />
                  <Input label="Hallmark / HUID Number" placeholder="BIS hallmark number" {...register('hallmarkNumber')} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Input label="Gross Weight (g) *" type="number" step="0.001" min="0" {...register('grossWeight')} error={errors.grossWeight?.message} />
                  <Input label="Stone Weight (g)" type="number" step="0.001" min="0" {...register('stoneWeight')} error={errors.stoneWeight?.message} />
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Net Weight (g)</label>
                    <div className="h-11 px-3 flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm text-slate-500 dark:text-slate-400">
                      {Math.max(0, (grossWeight ?? 0) - (stoneWeight ?? 0)).toFixed(3)}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Select label="Making Charge Type" {...register('makingChargeType')}>
                    <option value="">No making charge</option>
                    <option value="FIXED">Fixed amount</option>
                    <option value="PER_GRAM">Per gram (of net weight)</option>
                    <option value="PERCENTAGE">Percentage of metal value</option>
                  </Select>
                  {makingChargeType && (
                    <Input
                      label={makingChargeType === 'PERCENTAGE' ? 'Making Charge (%)' : makingChargeType === 'PER_GRAM' ? 'Making Charge (per gram)' : 'Making Charge (fixed)'}
                      type="number" step="0.01" min="0" {...register('makingChargeValue')} error={errors.makingChargeValue?.message}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Reorder (physical only) */}
        {productType === 'STANDARD' && (
          <div className="grid grid-cols-3 gap-4">
            <Input label="Reorder Level" type="number" min="0" {...register('reorderLevel')} error={errors.reorderLevel?.message} />
            <Input label="Reorder Quantity" type="number" min="0" {...register('reorderQuantity')} error={errors.reorderQuantity?.message} />
            <div>
              <Select label="Default Supplier" {...register('defaultSupplierId')}>
                <option value="">Not set</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplierName}</option>)}
              </Select>
              <p className="text-xs text-slate-400 mt-1">Used to auto-draft a reorder PO when stock runs low.</p>
            </div>
          </div>
        )}

        {/* Phase 58 §2 — category-specific expiry alert lead time. Generic,
            gated on expiry_tracking (not agri-specific — motivated by Agri
            Inputs' seed/fertilizer needing a much longer heads-up window
            than the pharmacy-shaped 30-day default). */}
        {expiryTrackingEnabled && productType === 'STANDARD' && (
          <div>
            <Input label="Expiry Alert Lead Time (days)" type="number" min="1" placeholder="30 (default)" {...register('expiryAlertLeadDays')} error={errors.expiryAlertLeadDays?.message} />
            <p className="text-xs text-slate-400 mt-1">How many days before the expiry date to start flagging this item. Leave blank to use the default (30 days) — set higher for items like seeds/fertilizer whose quality can decline well before the hard expiry date.</p>
          </div>
        )}

        {/* Phase 58 §2 — Pharmacy Schedule H/H1. Not gated by a module flag —
            checked directly against businessType, same as isRestaurant/
            isDistributor elsewhere, since this is a regulatory classification
            specific to one vertical, not a cross-cutting feature toggle. */}
        {isPharmacy && productType === 'STANDARD' && (
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
            <input type="checkbox" {...register('isPrescriptionRequired')} className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand" />
            Prescription Required (Schedule H / H1)
          </label>
        )}

        {/* Opening stock — first-time-only; later changes go through Adjust Stock */}
        {productType === 'STANDARD' && !isEdit && (
          <div>
            <Input
              label="Opening Stock Quantity"
              type="number" min="0" step="1"
              placeholder="How many do you already have on hand?"
              {...register('openingQuantity')}
              error={errors.openingQuantity?.message}
            />
            <p className="text-xs text-slate-400 mt-1">
              Valued at the Cost Price above. Leave at 0 if you have none yet — you can add stock later via Adjust Stock or a Purchase Order.
            </p>
          </div>
        )}

        {/* Image */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Product Image</label>
          {imagePath ? (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              <img src={`file://${imagePath}`} alt="Product" className="w-12 h-12 object-cover rounded-md border border-slate-200 dark:border-slate-700 shrink-0" />
              <p className="text-xs text-slate-500 dark:text-slate-400 flex-1 truncate">{imagePath.split(/[\\/]/).pop()}</p>
              <button type="button" onClick={() => setValue('imagePath', undefined)} className="p-1 text-slate-400 hover:text-danger transition-colors" title="Remove image">
                <X size={14} />
              </button>
            </div>
          ) : (
            <button type="button" onClick={pickImage} disabled={imagePickerLoading}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-dashed border-slate-300 text-sm text-slate-500 hover:border-brand hover:text-brand transition-colors w-full justify-center disabled:opacity-50">
              <ImagePlus size={16} />
              {imagePickerLoading ? 'Opening…' : 'Choose Image'}
            </button>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">Description</label>
          <textarea {...register('description')} rows={2} placeholder="Optional product description…"
            className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-brand resize-none text-slate-700 dark:text-slate-200 placeholder-slate-400" />
        </div>
      </form>
    </Modal>
  )
}
