import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { getCurrentSession } from './auth.service'
import { ServiceError } from '../errors/service-error'
import type { ApiResponse } from '../ipc/channels'
import type { CreateProductPayload, UpdateProductPayload } from '../validation/product.validation'

// Fresh-audit build (2026-07-12) — Jewellery vertical. netWeight is always
// derived server-side, never trusted from the client — see the validation
// schema's own comment for why (the weight-embedded-barcode label pricing
// bug class this mirrors).
function jewelleryFieldsFor(payload: { metalType?: string | null; purity?: string | null; hallmarkNumber?: string | null; grossWeight?: number | null; stoneWeight?: number | null; makingChargeType?: string | null; makingChargeValue?: number | null }) {
  if (!payload.metalType) {
    return { metalType: null, purity: null, hallmarkNumber: null, grossWeight: null, stoneWeight: null, netWeight: null, makingChargeType: null, makingChargeValue: null }
  }
  const grossWeight = payload.grossWeight ?? 0
  const stoneWeight = payload.stoneWeight ?? 0
  return {
    metalType: payload.metalType,
    purity: payload.purity ?? null,
    hallmarkNumber: payload.hallmarkNumber ?? null,
    grossWeight,
    stoneWeight,
    netWeight: grossWeight - stoneWeight,
    makingChargeType: payload.makingChargeType ?? null,
    makingChargeValue: payload.makingChargeValue ?? null,
  }
}

export async function listProducts(filters?: { categoryId?: string; isActive?: boolean; page?: number; limit?: number }): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const page = filters?.page ?? 1
    const limit = filters?.limit ?? 50
    const skip = (page - 1) * limit

    const where = {
      ...(filters?.categoryId ? { categoryId: filters.categoryId } : {}),
      isActive: filters?.isActive !== undefined ? filters.isActive : true
    }

    const [products, total] = await Promise.all([
      db.product.findMany({
        where,
        include: { category: { select: { id: true, name: true } }, inventory: { select: { quantity: true, reorderLevel: true, reorderQuantity: true } } },
        orderBy: { productName: 'asc' },
        skip,
        take: limit
      }),
      db.product.count({ where })
    ])

    return { success: true, data: { products: products.map(parseRentalRates), total, page, limit, pages: Math.ceil(total / limit) } }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

// Phase 54G — Product.rentalRates is stored as a JSON string (like
// Employee.allowances/SalaryPayment.deductions elsewhere in this codebase) —
// parsed here before crossing IPC so the renderer never has to JSON.parse a
// raw DB field itself, same convention hr.service.ts's parseAllowances
// already established.
function parseRentalRates<T extends { rentalRates?: string }>(product: T): T & { rentalRates: { basis: string; amount: number }[] } {
  let parsed: { basis: string; amount: number }[] = []
  try {
    const raw = product.rentalRates ? JSON.parse(product.rentalRates) : []
    if (Array.isArray(raw)) parsed = raw
  } catch { /* malformed JSON falls back to empty */ }
  return { ...product, rentalRates: parsed }
}

export async function getProduct(id: string): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const product = await db.product.findUnique({
      where: { id },
      include: { category: true, inventory: true }
    })
    if (!product) return { success: false, error: { code: 'PRD-001', message: 'Product not found.' } }
    return { success: true, data: parseRentalRates(product) }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function getProductByBarcode(barcode: string): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const product = await db.product.findFirst({
      where: { barcode, isActive: true },
      include: { category: { select: { id: true, name: true } }, inventory: { select: { quantity: true } } }
    })
    return { success: true, data: product ?? null }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function searchProducts(query: string): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const products = await db.product.findMany({
      where: {
        isActive: true,
        OR: [
          { productName: { contains: query } },
          { sku: { contains: query } },
          { barcode: { contains: query } }
        ]
      },
      include: { category: { select: { id: true, name: true } }, inventory: { select: { quantity: true } } },
      take: 20,
      orderBy: { productName: 'asc' }
    })
    return { success: true, data: products }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function createProduct(payload: CreateProductPayload): Promise<ApiResponse> {
  try {
    const db = getPrisma()

    // P003: Selling price ≥ 0 (enforced by Zod schema)
    // P004: Cost price ≥ 0 (enforced by Zod schema)

    const product = await db.$transaction(async (tx) => {
      // SKU/barcode uniqueness must be checked inside the same transaction as the
      // insert — checking beforehand left a window where two concurrent creates
      // with the same SKU could both pass the check and the second would fail on
      // the raw DB unique constraint instead of returning a friendly PRD-002/003.
      if (payload.sku) {
        const skuExists = await tx.product.findUnique({ where: { sku: payload.sku } })
        if (skuExists) throw new ServiceError('PRD-002', 'This SKU is already in use. Choose a different SKU.')
      }
      if (payload.barcode) {
        const bcExists = await tx.product.findUnique({ where: { barcode: payload.barcode } })
        if (bcExists) throw new ServiceError('PRD-003', 'This barcode is already in use.')
      }

      const p = await tx.product.create({
        data: {
          productName: payload.productName,
          categoryId: payload.categoryId || null,
          sku: payload.sku || null,
          barcode: payload.barcode || null,
          hsnCode: payload.hsnCode?.trim() || null,
          description: payload.description,
          productType: payload.productType,
          unit: payload.unit,
          costPrice: payload.costPrice,
          sellingPrice: payload.sellingPrice,
          mrp: payload.mrp ?? null,
          taxRate: payload.taxRate,
          imagePath: payload.imagePath || null,
          gender: payload.gender ?? null,
          isPrescriptionRequired: payload.isPrescriptionRequired ?? false,
          defaultSupplierId: payload.defaultSupplierId || null,
          expiryAlertLeadDays: payload.expiryAlertLeadDays || null,
          sellByWeight: payload.sellByWeight,
          weightUnit: payload.sellByWeight ? payload.weightUnit : null,
          pricePerWeightUnit: payload.sellByWeight ? payload.pricePerWeightUnit : null,
          sellByPack: payload.sellByPack ?? false,
          packUnit: payload.sellByPack ? payload.packUnit : null,
          unitsPerPack: payload.sellByPack ? payload.unitsPerPack : null,
          barcodeSource: payload.barcode ? 'MANUAL' : null,
          isRentable: payload.isRentable ?? false,
          rentalTrackingType: payload.isRentable ? payload.rentalTrackingType ?? null : null,
          rentalRates: JSON.stringify(payload.isRentable ? payload.rentalRates ?? [] : []),
          rentalSecurityDeposit: payload.isRentable ? payload.rentalSecurityDeposit ?? null : null,
          ...jewelleryFieldsFor(payload),
        }
      })

      if (payload.productType === 'STANDARD') {
        const openingQuantity = payload.openingQuantity ?? 0
        await tx.inventory.create({
          data: {
            productId: p.id,
            quantity: openingQuantity,
            reservedQuantity: 0,
            reorderLevel: payload.reorderLevel ?? 0,
            reorderQuantity: payload.reorderQuantity ?? 0,
            // RULE I007 — give opening stock a real cost basis (the product's cost
            // price) instead of leaving averageCost at 0, which would permanently
            // understate inventory valuation the first time more stock is received.
            averageCost: openingQuantity > 0 ? payload.costPrice : 0
          }
        })

        if (openingQuantity > 0) {
          await tx.inventoryMovement.create({
            data: {
              productId: p.id,
              movementType: 'ADDITION',
              quantity: openingQuantity,
              referenceType: 'OPENING_STOCK',
              remarks: 'Opening stock entered at product creation',
              createdById: getCurrentSession()?.userId ?? null
            }
          })
        }
      }

      return p
    })

    // Phase 38: if the owner has opted into barcode_generation and didn't supply
    // a barcode themselves, generate one automatically — this is the entire point
    // of turning the module on, not a surprise once they've explicitly opted in.
    // Best-effort: a failure here must not fail product creation itself.
    if (!payload.barcode) {
      try {
        const { isModuleEnabled } = await import('./industry-template.service')
        if (await isModuleEnabled('barcode_generation')) {
          const barcodeService = await import('./barcode.service')
          await barcodeService.generateBarcode(product.id)
        }
      } catch { /* best-effort — product creation already succeeded */ }
    }

    // Fetch with inventory included so callers get a complete record
    const full = await db.product.findUnique({ where: { id: product.id }, include: { category: { select: { id: true, name: true } }, inventory: true } })
    await logAction({ userId: getCurrentSession()?.userId, action: 'PRODUCT_CREATED', entityType: 'Product', entityId: product.id, newValue: { productName: payload.productName, sku: payload.sku } })
    return { success: true, data: full }
  } catch (err) {
    if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function updateProduct(payload: UpdateProductPayload): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const existing = await db.product.findUnique({ where: { id: payload.id } })
    if (!existing) return { success: false, error: { code: 'PRD-001', message: 'Product not found.' } }

    // P001: Unique SKU (exclude self)
    if (payload.sku && payload.sku !== existing.sku) {
      const skuExists = await db.product.findFirst({ where: { sku: payload.sku, id: { not: payload.id } } })
      if (skuExists) return { success: false, error: { code: 'PRD-002', message: 'This SKU is already in use.' } }
    }

    // P002: Unique Barcode (exclude self)
    if (payload.barcode && payload.barcode !== existing.barcode) {
      const bcExists = await db.product.findFirst({ where: { barcode: payload.barcode, id: { not: payload.id } } })
      if (bcExists) return { success: false, error: { code: 'PRD-003', message: 'This barcode is already in use.' } }
    }

    // Phase 54G — changing tracking type away from UNIT after real
    // RentalUnit rows already exist would orphan them (a BULK item has no
    // per-unit identity). Same "reject the change, don't silently corrupt
    // data" stance as F.15's payslip PAID-lock.
    if (existing.rentalTrackingType === 'UNIT' && payload.rentalTrackingType !== 'UNIT') {
      const unitCount = await db.rentalUnit.count({ where: { productId: payload.id } })
      if (unitCount > 0) {
        return { success: false, error: { code: 'PRD-004', message: `Cannot change tracking type — this product has ${unitCount} rental unit(s) already on record. Retire them first if you no longer need unit-level tracking.` } }
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id: payload.id },
        data: {
          productName: payload.productName,
          categoryId: payload.categoryId || null,
          sku: payload.sku || null,
          barcode: payload.barcode || null,
          hsnCode: payload.hsnCode?.trim() || null,
          description: payload.description,
          productType: payload.productType,
          unit: payload.unit,
          costPrice: payload.costPrice,
          sellingPrice: payload.sellingPrice,
          mrp: payload.mrp ?? null,
          taxRate: payload.taxRate,
          imagePath: payload.imagePath || null,
          gender: payload.gender ?? null,
          isPrescriptionRequired: payload.isPrescriptionRequired ?? false,
          defaultSupplierId: payload.defaultSupplierId || null,
          expiryAlertLeadDays: payload.expiryAlertLeadDays || null,
          sellByWeight: payload.sellByWeight,
          weightUnit: payload.sellByWeight ? payload.weightUnit : null,
          pricePerWeightUnit: payload.sellByWeight ? payload.pricePerWeightUnit : null,
          sellByPack: payload.sellByPack ?? false,
          packUnit: payload.sellByPack ? payload.packUnit : null,
          unitsPerPack: payload.sellByPack ? payload.unitsPerPack : null,
          barcodeSource: payload.barcode && payload.barcode !== existing.barcode ? 'MANUAL' : existing.barcodeSource,
          isRentable: payload.isRentable ?? false,
          rentalTrackingType: payload.isRentable ? payload.rentalTrackingType ?? null : null,
          rentalRates: JSON.stringify(payload.isRentable ? payload.rentalRates ?? [] : []),
          rentalSecurityDeposit: payload.isRentable ? payload.rentalSecurityDeposit ?? null : null,
          ...jewelleryFieldsFor(payload),
        }
      })

      const typeChanged = existing.productType !== payload.productType
      if (typeChanged && payload.productType === 'SERVICE') {
        // Changing from STANDARD to SERVICE — remove orphan inventory record
        await tx.inventory.deleteMany({ where: { productId: payload.id } })
      } else if (typeChanged && payload.productType === 'STANDARD') {
        // Changing from SERVICE to STANDARD — create inventory record
        await tx.inventory.upsert({
          where: { productId: payload.id },
          create: { productId: payload.id, quantity: 0, reservedQuantity: 0, reorderLevel: payload.reorderLevel ?? 0, reorderQuantity: payload.reorderQuantity ?? 0 },
          update: {}
        })
      } else if (payload.productType === 'STANDARD' && (payload.reorderLevel !== undefined || payload.reorderQuantity !== undefined)) {
        await tx.inventory.updateMany({
          where: { productId: payload.id },
          data: {
            ...(payload.reorderLevel !== undefined ? { reorderLevel: payload.reorderLevel } : {}),
            ...(payload.reorderQuantity !== undefined ? { reorderQuantity: payload.reorderQuantity } : {})
          }
        })
      }

      return p
    })

    await logAction({ userId: getCurrentSession()?.userId, action: 'PRODUCT_UPDATED', entityType: 'Product', entityId: payload.id, newValue: { productName: payload.productName } })
    return { success: true, data: updated }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

// Phase 58 §2 (2026-07-17) — Restaurant's "86 today": a menu item
// temporarily unavailable, distinct from archiveProduct's permanent
// deactivation above. `unavailableUntil` set to end-of-today marks it 86'd;
// clearing it back to null (not "set to a past date") makes it available
// again immediately — the field self-expires naturally at midnight since
// every read-side check compares against "now", so there's no reset job to
// forget to run.
export async function setProductAvailability(id: string, unavailableUntil: string | null): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const product = await db.product.update({ where: { id }, data: { unavailableUntil: unavailableUntil ? new Date(unavailableUntil) : null } })
    await logAction({ userId: getCurrentSession()?.userId, action: unavailableUntil ? 'PRODUCT_86D' : 'PRODUCT_AVAILABILITY_RESTORED', entityType: 'Product', entityId: id })
    return { success: true, data: product }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

// Phase 58 §2 — Distributor customer-class/negotiated pricing. Resolved
// fresh server-side at every add-to-cart/accept site (BillingScreen,
// QuotationFormScreen, BulkOrderScreen, the field-rep accept flow) — never
// trusted from the client, exactly the same principle as
// Product.sellingPrice itself. Falls back to the product's own sellingPrice
// when the customer has no customerClass set, or no price is on file for
// that (productId, customerClass) pair — a class price is an override, not
// a requirement.
export async function resolveCustomerPrice(productId: string, customerId?: string | null): Promise<number> {
  const db = getPrisma()
  const product = await db.product.findUnique({ where: { id: productId }, select: { sellingPrice: true } })
  if (!product) throw new ServiceError('PRD-005', 'Product not found.')
  if (!customerId) return product.sellingPrice

  const customer = await db.customer.findUnique({ where: { id: customerId }, select: { customerClass: true } })
  if (!customer?.customerClass) return product.sellingPrice

  const classPrice = await db.customerClassPrice.findUnique({
    where: { productId_customerClass: { productId, customerClass: customer.customerClass } }
  })
  return classPrice ? classPrice.price : product.sellingPrice
}

export async function resolveCustomerPriceForUi(productId: string, customerId?: string | null): Promise<ApiResponse> {
  try {
    const price = await resolveCustomerPrice(productId, customerId)
    return { success: true, data: { price } }
  } catch (err) {
    if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function listCustomerClassPrices(productId?: string): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const prices = await db.customerClassPrice.findMany({
      where: productId ? { productId } : {},
      include: { product: { select: { productName: true, sellingPrice: true } } },
      orderBy: [{ productId: 'asc' }, { customerClass: 'asc' }]
    })
    return { success: true, data: prices }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function upsertCustomerClassPrice(payload: { productId: string; customerClass: string; price: number }): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    const product = await db.product.findUnique({ where: { id: payload.productId }, select: { id: true } })
    if (!product) return { success: false, error: { code: 'PRD-005', message: 'Product not found.' } }
    if (payload.price < 0) return { success: false, error: { code: 'VAL-002', message: 'Price cannot be negative.' } }

    const record = await db.customerClassPrice.upsert({
      where: { productId_customerClass: { productId: payload.productId, customerClass: payload.customerClass } },
      create: { productId: payload.productId, customerClass: payload.customerClass, price: payload.price },
      update: { price: payload.price }
    })
    await logAction({ userId: getCurrentSession()?.userId, action: 'CUSTOMER_CLASS_PRICE_SET', entityType: 'CustomerClassPrice', entityId: record.id })
    return { success: true, data: record }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function deleteCustomerClassPrice(id: string): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    await db.customerClassPrice.delete({ where: { id } })
    await logAction({ userId: getCurrentSession()?.userId, action: 'CUSTOMER_CLASS_PRICE_DELETED', entityType: 'CustomerClassPrice', entityId: id })
    return { success: true }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}

export async function archiveProduct(id: string): Promise<ApiResponse> {
  try {
    const db = getPrisma()
    // P006: Check for active invoice items (cannot archive product used in unpaid invoices)
    const activeInvoiceItems = await db.invoiceItem.count({ where: { productId: id, invoice: { status: 'ACTIVE' } } })
    if (activeInvoiceItems > 0) {
      return { success: false, error: { code: 'PRD-004', message: 'Cannot archive: product has active invoices.' } }
    }
    await db.product.update({ where: { id }, data: { isActive: false } })
    await logAction({ userId: getCurrentSession()?.userId, action: 'PRODUCT_ARCHIVED', entityType: 'Product', entityId: id })
    return { success: true }
  } catch {
    return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
  }
}
