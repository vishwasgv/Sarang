import * as productService from '../../services/product.service'
import * as categoryService from '../../services/category.service'
import * as barcodeService from '../../services/barcode.service'
import { requirePermission } from '../permission-guard'
import {
  CreateProductSchema,
  UpdateProductSchema,
  GenerateBarcodeSchema,
  GetByScannedBarcodeSchema,
  GenerateWeightLabelSchema
} from '../../validation/product.validation'
import { CreateCategorySchema, UpdateCategorySchema } from '../../validation/category.validation'

type HandleFn = (channel: string, handler: (payload: unknown) => Promise<unknown>) => void

function validateId(id: unknown, label = 'ID'): { success: false; error: { code: string; message: string } } | null {
  if (typeof id !== 'string' || !id.trim()) {
    return { success: false, error: { code: 'VAL-001', message: `Invalid ${label}: must be a non-empty string.` } }
  }
  return null
}

export function register(handle: HandleFn): void {
  handle('products:list', async (payload) => {
    const deny = await requirePermission('products.view'); if (deny) return deny
    const f = (payload ?? {}) as { page?: number; limit?: number; categoryId?: string; isActive?: boolean }
    return productService.listProducts(f)
  })

  handle('products:get', async (id) => {
    const deny = await requirePermission('products.view'); if (deny) return deny
    const bad = validateId(id, 'product ID'); if (bad) return bad
    return productService.getProduct(id as string)
  })

  handle('products:create', async (payload) => {
    const deny = await requirePermission('products.create'); if (deny) return deny
    const parsed = CreateProductSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid data.' } }
    return productService.createProduct(parsed.data)
  })

  handle('products:update', async (payload) => {
    const deny = await requirePermission('products.update'); if (deny) return deny
    const parsed = UpdateProductSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid data.' } }
    return productService.updateProduct(parsed.data)
  })

  handle('products:archive', async (id) => {
    const deny = await requirePermission('products.archive'); if (deny) return deny
    const bad = validateId(id, 'product ID'); if (bad) return bad
    return productService.archiveProduct(id as string)
  })

  handle('products:setAvailability', async (payload) => {
    const deny = await requirePermission('products.update'); if (deny) return deny
    const p = payload as { id?: string; unavailableUntil?: string | null }
    const bad = validateId(p?.id, 'product ID'); if (bad) return bad
    return productService.setProductAvailability(p.id as string, p.unavailableUntil ?? null)
  })

  handle('products:search', async (query) => {
    const deny = await requirePermission('products.view'); if (deny) return deny
    return productService.searchProducts((query as string) ?? '')
  })

  handle('products:getByBarcode', async (barcode) => {
    const deny = await requirePermission('products.view'); if (deny) return deny
    if (typeof barcode !== 'string' || !barcode.trim()) {
      return { success: false, error: { code: 'VAL-001', message: 'Barcode is required.' } }
    }
    return productService.getProductByBarcode(barcode.trim())
  })

  // Phase 38: barcode generation + loose/weight billing — opt-in, gated by the
  // barcode_generation/barcode_printing/loose_billing TemplateModule flags at the
  // service/UI layer (not here — permission gating and feature-flag gating are
  // separate concerns; a disabled module simply isn't surfaced in the UI).
  handle('products:generateBarcode', async (payload) => {
    const deny = await requirePermission('products.update'); if (deny) return deny
    const parsed = GenerateBarcodeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid data.' } }
    return barcodeService.generateBarcode(parsed.data.productId)
  })

  handle('products:bulkGenerateMissingBarcodes', async () => {
    const deny = await requirePermission('products.update'); if (deny) return deny
    return barcodeService.bulkGenerateMissingBarcodes()
  })

  handle('products:getByScannedBarcode', async (payload) => {
    const deny = await requirePermission('products.view'); if (deny) return deny
    const parsed = GetByScannedBarcodeSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid data.' } }
    return barcodeService.getProductByScannedBarcode(parsed.data.code)
  })

  handle('products:generateWeightLabel', async (payload) => {
    // products.printLabels, not products.update — weighing and printing a loose
    // item is a checkout-counter action (Cashier-level), not catalog editing.
    const deny = await requirePermission('products.printLabels'); if (deny) return deny
    const parsed = GenerateWeightLabelSchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid data.' } }
    return barcodeService.generateWeightEmbeddedLabel(parsed.data.productId, parsed.data.weightGrams)
  })

  handle('categories:list', async () => {
    const deny = await requirePermission('products.view'); if (deny) return deny
    return categoryService.listCategories()
  })

  handle('categories:create', async (payload) => {
    const deny = await requirePermission('products.create'); if (deny) return deny
    const parsed = CreateCategorySchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid data.' } }
    return categoryService.createCategory(parsed.data)
  })

  handle('categories:update', async (payload) => {
    const deny = await requirePermission('products.update'); if (deny) return deny
    const parsed = UpdateCategorySchema.safeParse(payload)
    if (!parsed.success) return { success: false, error: { code: 'VAL-001', message: parsed.error.errors[0]?.message ?? 'Invalid data.' } }
    return categoryService.updateCategory(parsed.data)
  })

  handle('categories:archive', async (id) => {
    const deny = await requirePermission('products.archive'); if (deny) return deny
    const bad = validateId(id, 'category ID'); if (bad) return bad
    return categoryService.archiveCategory(id as string)
  })

  // Phase 58 §2 — Distributor customer-class/negotiated pricing. Same trust
  // level as any other price-setting action (products.modifyPricing) — it
  // changes what a whole class of customers pays, shop-wide.
  handle('products:resolveCustomerPrice', async (payload) => {
    const deny = await requirePermission('products.view'); if (deny) return deny
    const p = payload as { productId?: string; customerId?: string | null }
    const bad = validateId(p?.productId, 'product ID'); if (bad) return bad
    return productService.resolveCustomerPriceForUi(p.productId as string, p.customerId ?? null)
  })

  handle('products:listCustomerClassPrices', async (payload) => {
    const deny = await requirePermission('products.modifyPricing'); if (deny) return deny
    const { productId } = (payload ?? {}) as { productId?: string }
    return productService.listCustomerClassPrices(productId)
  })

  handle('products:upsertCustomerClassPrice', async (payload) => {
    const deny = await requirePermission('products.modifyPricing'); if (deny) return deny
    const p = payload as { productId?: string; customerClass?: string; price?: number }
    if (!p?.productId || !p?.customerClass?.trim() || typeof p.price !== 'number') {
      return { success: false, error: { code: 'VAL-001', message: 'productId, customerClass, and price are required.' } }
    }
    return productService.upsertCustomerClassPrice({ productId: p.productId, customerClass: p.customerClass.trim(), price: p.price })
  })

  handle('products:deleteCustomerClassPrice', async (id) => {
    const deny = await requirePermission('products.modifyPricing'); if (deny) return deny
    const bad = validateId(id, 'price ID'); if (bad) return bad
    return productService.deleteCustomerClassPrice(id as string)
  })
}
