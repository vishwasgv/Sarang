import { z } from 'zod'
import { validateEAN13 } from '../services/barcode.service'

const PRODUCT_TYPE = z.enum(['STANDARD', 'SERVICE', 'AREA_BASED']).default('STANDARD')
const WEIGHT_UNIT = z.enum(['kg', 'g', 'L', 'mL'])
// Phase 48: apparel gender — nullable/optional, only meaningful for CLOTHING/
// FOOTWEAR-style businesses (surfaced in the UI when variant_tracking is on).
const GENDER = z.enum(['MENS', 'WOMENS', 'UNISEX']).optional().nullable()

// Phase 38: a 13-digit barcode is validated as EAN-13 (catches fat-finger typos and
// bad scans); anything else (UPC-A, Code39, etc.) passes through unchecked since we
// can't validate a symbology we didn't generate.
const barcodeField = z
  .string()
  .max(50)
  .optional()
  .refine((val) => !val || val.length !== 13 || validateEAN13(val), {
    message: 'This does not look like a valid barcode (check-digit mismatch). Re-scan or re-enter it.'
  })

// Phase 38: loose/weight-based billing config, shared by create + update. A product is
// either sold by fixed pack (sellByWeight = false, default, existing behavior unchanged)
// or by weight (sellByWeight = true) — never both from one product in this version.
const looseBillingFields = {
  sellByWeight: z.boolean().default(false),
  weightUnit: WEIGHT_UNIT.optional().nullable(),
  pricePerWeightUnit: z.number().min(0, 'Price per unit cannot be negative').optional().nullable()
}

function refineLooseBilling<T extends { sellByWeight?: boolean; weightUnit?: string | null; pricePerWeightUnit?: number | null }>(
  data: T,
  ctx: z.RefinementCtx
): void {
  if (data.sellByWeight) {
    if (!data.weightUnit) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['weightUnit'], message: 'Select a unit (kg, g, L, mL) for loose/weight-based selling.' })
    }
    if (data.pricePerWeightUnit === null || data.pricePerWeightUnit === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pricePerWeightUnit'], message: 'Set a price per unit for loose/weight-based selling.' })
    }
  }
}

// Phase 58 §2 — Hardware's carton/box-to-loose-piece conversion. This is
// purely a STOCK RECEIVING convenience (how many base `unit`s a purchased
// pack contains) — the product is still stocked and sold in `unit` at all
// times, so no product-type or inventory-quantity meaning changes.
const packBillingFields = {
  sellByPack: z.boolean().default(false),
  packUnit: z.string().max(20).optional().nullable(),
  unitsPerPack: z.number().positive('Units per pack must be greater than zero').optional().nullable()
}

function refinePackBilling<T extends { sellByPack?: boolean; packUnit?: string | null; unitsPerPack?: number | null }>(
  data: T,
  ctx: z.RefinementCtx
): void {
  if (data.sellByPack) {
    if (!data.packUnit?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['packUnit'], message: 'Name the pack unit (e.g. BOX, CARTON) for pack-based receiving.' })
    }
    if (data.unitsPerPack === null || data.unitsPerPack === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['unitsPerPack'], message: `Set how many ${data.packUnit || 'pack'} units convert to 1 base unit.` })
    }
  }
}

// Phase 54G — rental. Sent as a structured array over IPC (not pre-
// stringified by the renderer) — product.service.ts JSON.stringifies it at
// the DB-write boundary, same "structured over IPC, stringify at the
// service layer" convention F.16's payroll deductions already established.
const rentalFields = {
  // Deliberately .optional() not .default(false) — z.infer (the output type
  // this schema's Payload type uses) makes a .default() field non-optional,
  // which would force every existing test/call site across the codebase to
  // start passing isRentable explicitly. product.service.ts already falls
  // back to `payload.isRentable ?? false` wherever this is read.
  isRentable: z.boolean().optional(),
  rentalTrackingType: z.enum(['UNIT', 'BULK']).optional().nullable(),
  rentalRates: z.array(z.object({
    basis: z.enum(['HOUR', 'DAY', 'WEEK', 'MONTH', 'YEAR']),
    amount: z.number().min(0, 'Rate cannot be negative'),
  })).optional(),
  rentalSecurityDeposit: z.number().min(0, 'Security deposit cannot be negative').optional().nullable(),
}

// Fresh-audit build (2026-07-12) — Jewellery vertical. netWeight is
// deliberately NOT accepted from the client — always derived server-side in
// product.service.ts as grossWeight - stoneWeight, the same "never trust a
// client-computed derived value for something billing will price off of"
// reasoning the weight-embedded-barcode price-computation already
// established (see barcode.service.ts's generateWeightEmbeddedLabel).
const jewelleryFields = {
  metalType: z.enum(['GOLD', 'SILVER', 'PLATINUM']).optional().nullable(),
  purity: z.string().max(20).optional().nullable(),
  hallmarkNumber: z.string().max(50).optional().nullable(),
  grossWeight: z.number().min(0, 'Gross weight cannot be negative').optional().nullable(),
  stoneWeight: z.number().min(0, 'Stone weight cannot be negative').optional().nullable(),
  makingChargeType: z.enum(['FIXED', 'PER_GRAM', 'PERCENTAGE']).optional().nullable(),
  makingChargeValue: z.number().min(0, 'Making charge cannot be negative').optional().nullable(),
}

function refineJewellery<T extends { metalType?: string | null; purity?: string | null; grossWeight?: number | null; stoneWeight?: number | null }>(
  data: T,
  ctx: z.RefinementCtx
): void {
  if (data.metalType) {
    if (!data.purity?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['purity'], message: 'Purity is required for a metal item.' })
    if (data.grossWeight === null || data.grossWeight === undefined || data.grossWeight <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['grossWeight'], message: 'Gross weight must be greater than zero for a metal item.' })
    }
    if (data.stoneWeight != null && data.grossWeight != null && data.stoneWeight >= data.grossWeight) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['stoneWeight'], message: 'Stone weight must be less than gross weight.' })
    }
  }
}

export const CreateProductSchema = z
  .object({
    productName: z.string().min(1, 'Product name is required').max(200),
    categoryId: z.string().optional().nullable(),
    sku: z.string().max(50).optional(),
    barcode: barcodeField,
    // Phase 54F.17 — was captured nowhere at all despite Product.hsnCode
    // existing in the schema and being read by GSTR-1/HSN Summary reports;
    // every product's HSN code was silently un-settable. Not GST-specific in
    // the schema itself (SAC codes for services use the same free-text field
    // elsewhere in this app), so no taxModel gate here — just an optional field.
    hsnCode: z.string().max(20).optional(),
    description: z.string().max(1000).optional(),
    productType: PRODUCT_TYPE,
    unit: z.string().min(1).max(20).default('PCS'),
    costPrice: z.number().min(0, 'Cost price cannot be negative').default(0),
    sellingPrice: z.number().min(0, 'Selling price cannot be negative'),
    mrp: z.number().min(0, 'MRP cannot be negative').optional().nullable(),
    taxRate: z.number().min(0, 'Tax rate cannot be negative').max(100).default(0),
    imagePath: z.string().optional(),
    reorderLevel: z.number().min(0).default(0),
    reorderQuantity: z.number().min(0).default(0),
    // Phase 58 §2 — generic reorder-automation supplier link
    defaultSupplierId: z.string().optional().nullable(),
    openingQuantity: z.number().min(0).default(0),
    gender: GENDER,
    // Phase 58 §2 — Pharmacy Schedule H/H1 prescription-only medicine flag
    isPrescriptionRequired: z.boolean().optional(),
    // Phase 58 §2 — Agri Inputs category-specific expiry alert lead time.
    // Null means "use the generic default (30 days)" — a seed/fertilizer
    // shop needs a much longer heads-up window than a pharmacy's 30-day
    // medicine cutoff (germination/potency starts degrading well before a
    // hard expiry date), while a pesticide might want the pharmacy default.
    // Not Agri-specific in the schema — any expiry_tracking business can set
    // it, same "generic field, motivated by one vertical" precedent as
    // defaultSupplierId.
    expiryAlertLeadDays: z.number().int().min(1).max(1000).optional().nullable(),
    ...rentalFields,
    ...looseBillingFields,
    ...packBillingFields,
    ...jewelleryFields
  })
  .superRefine(refineLooseBilling)
  .superRefine(refinePackBilling)
  .superRefine(refineJewellery)

export const UpdateProductSchema = z
  .object({
    id: z.string().min(1),
    productName: z.string().min(1, 'Product name is required').max(200),
    categoryId: z.string().optional().nullable(),
    sku: z.string().max(50).optional(),
    barcode: barcodeField,
    hsnCode: z.string().max(20).optional(),
    description: z.string().max(1000).optional(),
    productType: PRODUCT_TYPE,
    unit: z.string().min(1).max(20).default('PCS'),
    costPrice: z.number().min(0, 'Cost price cannot be negative').default(0),
    sellingPrice: z.number().min(0, 'Selling price cannot be negative'),
    mrp: z.number().min(0, 'MRP cannot be negative').optional().nullable(),
    taxRate: z.number().min(0, 'Tax rate cannot be negative').max(100).default(0),
    imagePath: z.string().optional().nullable(),
    reorderLevel: z.number().min(0).default(0),
    reorderQuantity: z.number().min(0).default(0),
    defaultSupplierId: z.string().optional().nullable(),
    gender: GENDER,
    isPrescriptionRequired: z.boolean().optional(),
    expiryAlertLeadDays: z.number().int().min(1).max(1000).optional().nullable(),
    ...rentalFields,
    ...looseBillingFields,
    ...packBillingFields,
    ...jewelleryFields
  })
  .superRefine(refineLooseBilling)
  .superRefine(refinePackBilling)
  .superRefine(refineJewellery)

// Phase 38: barcode/label-printing action payloads
export const GenerateBarcodeSchema = z.object({ productId: z.string().min(1) })
export const BulkGenerateMissingBarcodesSchema = z.object({})
export const GetByScannedBarcodeSchema = z.object({ code: z.string().min(1).max(50) })
// Phase 58 §2 — Clothing/Footwear variant barcode generation
export const GenerateVariantBarcodeSchema = z.object({ variantId: z.string().min(1) })
export const BulkGenerateMissingVariantBarcodesSchema = z.object({ productId: z.string().min(1) })
export const GenerateWeightLabelSchema = z.object({
  productId: z.string().min(1),
  // Whole grams only, minimum 1 — the barcode's weight field is a 5-digit
  // integer; anything under 0.5g would round away to "00000" at encode time.
  weightGrams: z.number().min(1, 'Weight must be at least 1 gram').max(99_999, 'Weight cannot exceed 99.999 kg per label')
})
export const PrintLabelsSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1),
    // Phase 58 §2 — when set, prints THIS specific variant's own barcode/price
    // (size/colour combination), not the parent product's generic barcode —
    // see billing.handler.ts's buildLabelHtml.
    variantId: z.string().min(1).optional(),
    copies: z.number().int().positive().max(500),
    // Phase 38: a weight-embedded label carries a fresh ad-hoc barcode (weight
    // baked in) that is NOT the product's own Product.barcode — when set, this
    // overrides the DB-looked-up barcode/price for this one line instead of
    // printing the product's regular barcode. Used only by the weigh-and-print
    // flow (products:generateWeightLabel), never by the plain batch-print flow.
    barcodeOverride: z.string().length(13).optional(),
    priceTextOverride: z.string().max(50).optional()
  })).min(1).max(200, 'Too many products in one print run — split into smaller batches.'),
  outputMode: z.enum(['THERMAL_LABEL', 'A4_SHEET']),
  fields: z.object({ showPrice: z.boolean().default(true), showBarcode: z.boolean().default(true), showName: z.boolean().default(true) }).default({})
})

export type CreateProductPayload = z.infer<typeof CreateProductSchema>
export type UpdateProductPayload = z.infer<typeof UpdateProductSchema>
export type GenerateBarcodePayload = z.infer<typeof GenerateBarcodeSchema>
export type GetByScannedBarcodePayload = z.infer<typeof GetByScannedBarcodeSchema>
export type GenerateWeightLabelPayload = z.infer<typeof GenerateWeightLabelSchema>
export type PrintLabelsPayload = z.infer<typeof PrintLabelsSchema>
