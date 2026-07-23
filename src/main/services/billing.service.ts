import { getPrisma } from '../database/db'
import { parseLocalDateStart } from '../utils/date.util'
import { inventoryService } from './inventory.service'
import { customerLedgerService } from './customer-ledger.service'
import { calculateLineTotal, sumCurrency, roundCurrency, getCurrencyDecimals } from './currency.service'
import { logAction } from './audit.service'
import { isModuleEnabled } from './industry-template.service'
import { createNotification } from './notification.service'
import { decrementVariantStockTx } from './variant.service'
import { deductBatchStockFIFO, restoreBatchStockFIFO, hasEnoughNonExpiredBatchStock } from './batch.service'
import { markSerialSoldTx, markSerialAvailableTx } from './serial.service'
import { SequenceContendedError } from './sequence.service'
import { releaseTablesForInvoiceTx } from './restaurant.service'
import type { CreateInvoicePayload, CancelInvoicePayload, SplitInvoicePayload } from '../validation/billing.validation'
import { ServiceError } from '../errors/service-error'

export async function generateInvoiceNumber(tx?: Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]): Promise<string> {
  const db = tx ?? getPrisma()
  const year = new Date().getFullYear()

  // Atomic sequence via Setting table — prevents duplicates under concurrent
  // invoice creation. Claims the tip via a conditional updateMany (same
  // pattern as sequence.service.ts's generateSequenceNumber, see its header
  // comment for why a plain unconditional update still let two concurrent
  // transactions both "succeed" with a value computed from the same stale
  // read, relying entirely on Invoice.invoiceNumber's @unique constraint to
  // catch the resulting collision rather than actually preventing it).
  const seqKey = `invoice_sequence_${year}`
  const existing = await db.setting.findUnique({ where: { settingKey: seqKey } })
  const nextNum = existing ? parseInt(existing.settingValue, 10) + 1 : 1

  if (existing) {
    const claim = await db.setting.updateMany({
      where: { settingKey: seqKey, settingValue: existing.settingValue },
      data: { settingValue: String(nextNum) }
    })
    if (claim.count === 0) throw new SequenceContendedError(seqKey)
  } else {
    try {
      await db.setting.create({ data: { settingKey: seqKey, settingValue: String(nextNum), settingType: 'NUMBER' } })
    } catch {
      throw new SequenceContendedError(seqKey)
    }
  }

  // Configurable prefix from settings; falls back to 'INV'
  const prefixSetting = await db.setting.findUnique({ where: { settingKey: 'invoice_prefix' } })
  const prefix = prefixSetting?.settingValue?.trim() || 'INV'

  return `${prefix}-${year}-${String(nextNum).padStart(6, '0')}`
}

async function getAllowNegativeInventory(): Promise<boolean> {
  try {
    const db = getPrisma()
    const s = await db.setting.findUnique({ where: { settingKey: 'allow_negative_inventory' } })
    return s?.settingValue === 'true'
  } catch { return false }
}

// Default is BLOCK — FIFO batch dispensing always surfaces the oldest batch
// first, which is the most likely one to be expired, so without this check
// the app would silently sell expired stock (e.g. medicine) by default. An
// owner who genuinely needs a warn-only override (e.g. non-consumable goods
// where "expiry" is closer to a soft best-by date) can opt in via Settings.
async function getAllowExpiredBatchSale(): Promise<boolean> {
  try {
    const db = getPrisma()
    const s = await db.setting.findUnique({ where: { settingKey: 'allow_expired_batch_sale' } })
    return s?.settingValue === 'true'
  } catch { return false }
}

// Unset by default (no cap) — manual discretionary discounts are normal and
// legitimate across every vertical in this app (a comp meal, a loyalty
// discount, an apology for a defect), and nothing here can distinguish "a
// deliberate manual discount" from "a tampered/mistaken bulk-order request"
// by payload shape alone. This is an opt-in ceiling for an owner who wants
// one (e.g. a Distributor capping staff-applied discounts to their own
// volume-pricing tiers), not a rule imposed on every business by default.
async function getMaxDiscountPercent(): Promise<number | null> {
  try {
    const db = getPrisma()
    const s = await db.setting.findUnique({ where: { settingKey: 'max_discount_percent' } })
    if (!s) return null
    const pct = parseFloat(s.settingValue)
    return Number.isFinite(pct) && pct >= 0 ? pct : null
  } catch { return null }
}

export const billingService = {
  // Phase 58 §2 (2026-07-17) — Restaurant's "tip / service charge line on
  // invoices". There is no ad-hoc (non-Product) invoice-line path anywhere
  // in this app — productId is a hard, non-nullable FK threaded through
  // inventory/serial/batch/variant deduction in createInvoice below — so
  // this follows the same lookup-or-create generic-Product pattern already
  // proven in time-entry.service.ts/placement.service.ts/etc., not a schema
  // change. taxRate 0 by default (a voluntary tip/gratuity is not
  // consideration for a taxable supply under Indian GST; an owner who
  // wants to tax a mandatory service charge can edit the resulting
  // Product's tax rate afterward like any other product) and productType
  // SERVICE so it never shows up in inventory-quantity screens. Not
  // Restaurant-specific in the API — any vertical can use the same button.
  async getOrCreateTipProduct() {
    const db = getPrisma()
    // Looked up by name, not hsnCode like the other lookup-or-create
    // helpers elsewhere in this codebase — a tip/gratuity has no real HSN/
    // SAC code to key off (those are numeric GST classification codes;
    // fabricating one here would misrepresent it on a printed GST invoice
    // or the HSN Summary report). hsnCode stays null/blank, matching a
    // genuinely out-of-scope-of-GST line item.
    let product = await db.product.findFirst({ where: { productName: 'Tip / Service Charge', isActive: true } })
    if (!product) {
      product = await db.product.create({
        data: { productName: 'Tip / Service Charge', productType: 'SERVICE', sellingPrice: 0, taxRate: 0, unit: 'NOS', isActive: true },
      })
    }
    return { success: true, data: product }
  },

  // Phase 58 §2 — Retail's "fast favorites/frequently-sold grid" on
  // Billing. Ranked by units sold (not revenue) across every non-returned
  // active invoice ever recorded — a genuine walk-up POS convenience
  // ranking, not a financial report, so unlike analytics.service.ts's
  // getTopProducts() this doesn't bother correcting for the RETURN-invoice
  // positive-quantity storage convention; excluding invoiceType 'RETURN'
  // rows outright already keeps the ranking sane for this purpose. Returns
  // full Product fields (not just aggregate stats) so a tile tap can call
  // addToCart() directly with zero follow-up fetch.
  async getFrequentlySoldProducts(limit = 12) {
    const db = getPrisma()
    const grouped = await db.invoiceItem.groupBy({
      by: ['productId'],
      where: { invoice: { status: 'ACTIVE', invoiceType: { not: 'RETURN' } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: limit,
    })
    const productIds = grouped.map((g) => g.productId)
    if (productIds.length === 0) return { success: true, data: { products: [] } }

    const products = await db.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: { category: { select: { id: true, name: true } }, inventory: { select: { quantity: true, reorderLevel: true, reorderQuantity: true } } },
    })
    const byId = new Map(products.map((p) => [p.id, p]))
    // Preserve the groupBy's quantity-sold order — findMany's `id: {in:}`
    // does not guarantee result order.
    const ordered = productIds.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p)
    return { success: true, data: { products: ordered } }
  },

  async generateInvoiceNumber() {
    // PREVIEW ONLY — reads current sequence without incrementing, so no sequence gaps on cancel
    const db = getPrisma()
    const year = new Date().getFullYear()
    const seqKey = `invoice_sequence_${year}`
    const existing = await db.setting.findUnique({ where: { settingKey: seqKey } })
    const nextNum = existing ? parseInt(existing.settingValue, 10) + 1 : 1
    const prefixSetting = await db.setting.findUnique({ where: { settingKey: 'invoice_prefix' } })
    const prefix = prefixSetting?.settingValue?.trim() || 'INV'
    return { success: true, data: `${prefix}-${year}-${String(nextNum).padStart(6, '0')}` }
  },

  // RULE B001–B010: fully atomic invoice creation
  async createInvoice(payload: CreateInvoicePayload, userId?: string) {
    const db = getPrisma()

    // Pre-transaction validation: verify products + compute line totals
    const allowNegative = await getAllowNegativeInventory()
    const allowExpiredBatchSale = await getAllowExpiredBatchSale()
    const maxDiscountPercent = await getMaxDiscountPercent()
    // Decimal places vary by currency (JPY/KRW have none, BHD/KWD/OMR have
    // 3) — hardcoding 2 everywhere silently mis-rounds every non-2dp
    // currency's invoice math, not just its display.
    const businessProfile = await db.businessProfile.findFirst({ select: { currencyCode: true } })
    const currencyDecimals = getCurrencyDecimals(businessProfile?.currencyCode)

    // Fresh-audit fix (2026-07-12): a B2B customer marked tax-exempt (reverse
    // charge, diplomatic/NGO exemption, etc.) previously had no way to get a
    // 0%-tax invoice at all — every line always taxed at the product's own
    // rate regardless of who the buyer was. Read once here, applied to every
    // line below; the reason (if any) is stamped onto the invoice notes so
    // it's visible on the printed document, not just an internal flag.
    let customerTaxExempt = false
    let customerTaxExemptReason: string | null = null
    if (payload.customerId) {
      const exemptCheck = await db.customer.findUnique({ where: { id: payload.customerId }, select: { taxExempt: true, taxExemptReason: true } })
      customerTaxExempt = exemptCheck?.taxExempt ?? false
      customerTaxExemptReason = exemptCheck?.taxExemptReason ?? null
    }

    // Validate each item and compute line figures
    type ValidatedItem = {
      productId: string; productName: string; productSku: string | null; hsnCode: string | null; productType: string
      quantity: number; unitPrice: number; discountAmount: number
      taxRate: number; lineTaxable: number; lineTax: number; lineTotal: number
      variantId: string | null; variantInfo: string | null
      serialId: string | null
      weightUnit: string | null
      jewelleryMetalType: string | null; jewelleryPurity: string | null
      jewelleryNetWeight: number | null; jewelleryRatePerGram: number | null
      jewelleryMakingCharge: number | null; jewelleryHallmarkNumber: string | null
      prescriptionPatientName: string | null; prescriptionDoctorName: string | null
      prescriptionDate: Date | null
    }
    const validatedItems: ValidatedItem[] = []

    for (const item of payload.items) {
      const product = await db.product.findUnique({
        where: { id: item.productId },
        include: { inventory: true }
      })
      if (!product) return { success: false, error: { code: 'PRD-001', message: `Product not found.` } }
      if (!product.isActive) return { success: false, error: { code: 'PRD-005', message: `Product "${product.productName}" is archived and cannot be sold.` } }
      // Phase 58 §2 — Pharmacy Schedule H/H1: a prescription-flagged product
      // cannot be sold without a patient + doctor name captured on this line.
      // Enforced here (server-side), not just a UI prompt — matches the
      // "never trust the client for a compliance-relevant fact" stance used
      // throughout billing.service.ts.
      if (product.isPrescriptionRequired && (!item.prescriptionPatientName?.trim() || !item.prescriptionDoctorName?.trim())) {
        return { success: false, error: { code: 'RX-001', message: `"${product.productName}" is a prescription-only item — patient and doctor name are required to sell it.` } }
      }
      // RULE B003: Quantity > 0 enforced by Zod; double-check
      if (item.quantity <= 0) return { success: false, error: { code: 'INVOC-007', message: 'Quantity must be greater than zero.' } }
      // RULE B004: Unit price cannot be negative
      if (item.unitPrice < 0) return { success: false, error: { code: 'INVOC-008', message: 'Unit price cannot be negative.' } }
      // A discount larger than the line's own gross value drives that line's taxable
      // amount and tax negative — the invoice-level B-005 check only catches the
      // grand total going negative, so a large per-line discount offset by other
      // lines could silently understate the true tax owed without ever failing
      // that check. Reject at the line level instead.
      const lineGross = roundCurrency(item.quantity * item.unitPrice, currencyDecimals)
      if ((item.discountAmount ?? 0) > lineGross + 0.01) {
        return { success: false, error: { code: 'INVOC-010', message: `Discount for "${product.productName}" cannot exceed the line's value (${lineGross.toFixed(2)}).` } }
      }
      // Opt-in ceiling (Settings → max_discount_percent) — no server-side check
      // previously existed on discount size beyond "not more than the line's
      // own value," so any staff member (or a modified request bypassing the
      // UI's own math, e.g. a bulk-order screen's client-computed volume
      // discount) could apply any discount up to 100% to any line. Unset by
      // default; only enforced once an owner opts in.
      if (maxDiscountPercent !== null && lineGross > 0) {
        const linePct = ((item.discountAmount ?? 0) / lineGross) * 100
        if (linePct > maxDiscountPercent + 0.01) {
          return { success: false, error: { code: 'INVOC-011', message: `Discount for "${product.productName}" (${linePct.toFixed(1)}%) exceeds the configured maximum of ${maxDiscountPercent}%.` } }
        }
      }

      // Check inventory for STANDARD products (SERVICE and AREA_BASED skip inventory)
      if (product.productType === 'STANDARD') {
        const qty = product.inventory?.quantity ?? 0
        if (!allowNegative && qty < item.quantity) {
          return { success: false, error: { code: 'INV-002', message: `Insufficient stock for "${product.productName}". Available: ${qty}, required: ${item.quantity}.` } }
        }
        // Also validate per-variant stock for clothing/footwear
        if (item.variantId) {
          const variant = await db.productVariant.findUnique({ where: { id: item.variantId } })
          if (!variant || !variant.isActive) {
            return { success: false, error: { code: 'VAR-009', message: `Selected variant is not available.` } }
          }
          if (!allowNegative && variant.stockQty < item.quantity) {
            return { success: false, error: { code: 'VAR-010', message: `Insufficient stock for this variant. Available: ${variant.stockQty}, requested: ${item.quantity}.` } }
          }
        }
        // A serial identifies exactly one physical unit — "quantity 3 tied to
        // one serial" is meaningless (electronics is sold as 3 separate cart
        // lines, one serial each), and re-selling an already-SOLD unit would
        // silently orphan or double-link the original sale.
        if (item.serialId) {
          if (item.quantity !== 1) {
            return { success: false, error: { code: 'SER-010', message: 'A specific device (serial/IMEI) can only be sold one unit at a time.' } }
          }
          const serial = await db.productSerial.findUnique({ where: { id: item.serialId } })
          if (!serial || serial.productId !== item.productId) {
            return { success: false, error: { code: 'SER-011', message: 'Selected device does not match this product.' } }
          }
          if (serial.status !== 'AVAILABLE') {
            return { success: false, error: { code: 'SER-012', message: `This device is not available for sale (status: ${serial.status}).` } }
          }
        }
        // RULE B011: don't let a sale silently draw from expired batch stock —
        // FIFO-by-expiry-date (deductBatchStockFIFO) surfaces the oldest batch
        // first, which is the batch most likely to already be expired.
        if (!allowExpiredBatchSale) {
          const okExpiry = await hasEnoughNonExpiredBatchStock(db, item.productId, item.quantity)
          if (!okExpiry) {
            return { success: false, error: { code: 'BATCH-004', message: `"${product.productName}" only has expired batch stock available to cover this quantity. Sale blocked to prevent selling expired stock — check Batch Tracking, or enable "Allow expired batch sale" in Settings if this override is intentional.` } }
          }
        }
      }

      const effectiveTaxRate = customerTaxExempt ? 0 : (item.taxRate ?? product.taxRate ?? 0)
      const lineDiscount = item.discountAmount ?? 0
      // Decimal-safe: subtotal/discount/tax/total are computed once via
      // Prisma.Decimal (see currency.service.ts) instead of chained float
      // arithmetic, so per-line rounding error can't creep into lineTax.
      const { subtotal: lineSubtotal, taxAmount: lineTax, lineTotal } = calculateLineTotal(item.quantity, item.unitPrice, lineDiscount, effectiveTaxRate, currencyDecimals)
      const lineTaxable = roundCurrency(lineSubtotal - lineDiscount, currencyDecimals)

      validatedItems.push({
        productId: item.productId,
        productName: product.productName,
        productSku: product.sku ?? null,
        hsnCode: product.hsnCode ?? null,
        productType: product.productType,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: lineDiscount,
        taxRate: effectiveTaxRate,
        lineTaxable,
        lineTax,
        lineTotal,
        variantId: item.variantId ?? null,
        variantInfo: item.variantInfo ?? null,
        serialId: item.serialId ?? null,
        weightUnit: item.weightUnit ?? null,
        jewelleryMetalType: item.jewelleryMetalType ?? null,
        jewelleryPurity: item.jewelleryPurity ?? null,
        jewelleryNetWeight: item.jewelleryNetWeight ?? null,
        jewelleryRatePerGram: item.jewelleryRatePerGram ?? null,
        jewelleryMakingCharge: item.jewelleryMakingCharge ?? null,
        jewelleryHallmarkNumber: item.jewelleryHallmarkNumber?.trim() || null,
        prescriptionPatientName: product.isPrescriptionRequired ? (item.prescriptionPatientName?.trim() ?? null) : null,
        prescriptionDoctorName: product.isPrescriptionRequired ? (item.prescriptionDoctorName?.trim() ?? null) : null,
        prescriptionDate: product.isPrescriptionRequired && item.prescriptionDate ? new Date(item.prescriptionDate) : null
      })
    }

    // Phase 58 §2 — Jewellery old-metal exchange, applied atomically. Fetched
    // and validated BEFORE the totals below (its valueGiven folds into the
    // discount), and re-claimed with a conditional update INSIDE the
    // transaction further down — the same "read outside, claim atomically
    // inside" shape generateInvoiceNumber/generateSequenceNumber already use,
    // so two concurrent invoices can never both apply the same exchange.
    let metalExchangeDiscount = 0
    if (payload.metalExchangeId) {
      const exchange = await db.metalExchange.findUnique({ where: { id: payload.metalExchangeId } })
      if (!exchange) return { success: false, error: { code: 'INVOC-012', message: 'Metal exchange not found.' } }
      if (exchange.invoiceId) return { success: false, error: { code: 'INVOC-013', message: 'This metal exchange is already linked to another invoice.' } }
      if (exchange.customerId && payload.customerId && exchange.customerId !== payload.customerId) {
        return { success: false, error: { code: 'INVOC-014', message: 'This metal exchange belongs to a different customer.' } }
      }
      metalExchangeDiscount = exchange.valueGiven
    }

    // Compute invoice-level totals. Summed via Decimal (sumCurrency), not a
    // plain-float reduce — accumulating many lineTax/discount values with
    // `+=` on floats is exactly where binary representation error compounds
    // across a multi-line invoice.
    const subtotal = sumCurrency(validatedItems.map(i => i.quantity * i.unitPrice), currencyDecimals)
    const totalLineDiscount = sumCurrency(validatedItems.map(i => i.discountAmount), currencyDecimals)
    // Design note (previously undocumented — flagged in a 2026-07-22 audit as "not
    // documented as an intentional choice anywhere"): globalDiscount/metalExchangeDiscount
    // are applied only to the final total, AFTER taxAmount below is already summed from
    // each line's own tax-on-discounted-base (lineTax uses only that line's own
    // discountAmount, computed earlier per item). A global/invoice-level discount does NOT
    // reduce the taxable value tax was computed on. This is a deliberate scope choice, not
    // a drift bug: client and server agree on the number, and correctly reducing the taxable
    // base for a lump-sum, not-tied-to-any-line discount is a jurisdiction-specific tax-law
    // question (GST/VAT treatment of trade discounts varies by country and by whether the
    // discount was disclosed at the time of supply) that this app does not currently attempt
    // to model. Businesses that need discounts to affect the taxable value should apply them
    // as per-line discounts instead, which already flow correctly into lineTax.
    const globalDiscount = (payload.globalDiscount ?? 0) + metalExchangeDiscount
    const discountAmount = roundCurrency(totalLineDiscount + globalDiscount, currencyDecimals)
    const taxAmount = sumCurrency(validatedItems.map(i => i.lineTax), currencyDecimals)
    const rawTotal = roundCurrency(subtotal - discountAmount + taxAmount, currencyDecimals)
    // Whole-unit cash rounding is an Indian retail convention (rupee coins
    // are the smallest cash denomination in practice) — applying it to every
    // currency would be wrong for e.g. a USD invoice, where cents matter.
    // Only round to whole units for zero-decimal-native currencies (INR
    // keeps its historical default here) or when the currency already has no
    // subunit (JPY, KRW, ...); everything else keeps its natural precision.
    const applyWholeUnitRounding = currencyDecimals === 2 && (businessProfile?.currencyCode ?? 'INR') === 'INR'
    const totalAmount = applyWholeUnitRounding ? Math.round(rawTotal) : rawTotal
    const roundingAmount = roundCurrency(totalAmount - rawTotal, currencyDecimals)

    // RULE B005: Invoice total cannot be negative
    if (totalAmount < 0) {
      return { success: false, error: { code: 'INVOC-002', message: 'Invoice total cannot be negative. Check discounts.' } }
    }

    const isCredit = payload.paymentMethod === 'CREDIT'
    // SPLIT = invoice is UNPAID upfront; cashier records each payment method separately via payments:record
    const isSplit = payload.paymentMethod === 'SPLIT'
    const startsUnpaid = isCredit || isSplit
    const paidAmount = startsUnpaid ? 0 : totalAmount
    const balanceAmount = startsUnpaid ? totalAmount : 0
    const paymentStatus = startsUnpaid ? 'UNPAID' : 'PAID'

    // Validate customer exists for credit sales
    if (isCredit && !payload.customerId) {
      return { success: false, error: { code: 'INVOC-009', message: 'A customer must be selected for credit sales.' } }
    }

    // Credit limit enforcement (Distributor / Hardware templates with credit_limit_enforcement enabled).
    // Scoped to true CREDIT sales only — SPLIT is always for the full invoice
    // amount, paid immediately across two methods (the UI requires cash+UPI to
    // sum to the total before submit), so it never actually extends credit.
    // Gating on `startsUnpaid` (which also covers SPLIT) wrongly blocked a
    // customer near their limit from paying via cash+UPI split.
    const creditLimitModuleEnabled = isCredit && await isModuleEnabled('credit_limit_enforcement')

    try {
      // RULE B007 + B008: ALL operations in ONE transaction — rolled back if any step fails
      const invoice = await db.$transaction(async (tx) => {
        // Re-validated fresh INSIDE the transaction, not against a pre-read
        // snapshot — reading the customer's balance before the transaction opened
        // left a window where two concurrent CREDIT sales to the same customer,
        // each individually within the limit, could together push them over it.
        if (payload.customerId && creditLimitModuleEnabled) {
          const customer = await tx.customer.findUnique({ where: { id: payload.customerId } })
          if (customer && customer.creditLimit > 0) {
            const projectedBalance = customer.outstandingBalance + totalAmount
            if (projectedBalance > customer.creditLimit) {
              throw new ServiceError('CUST-003', `Credit limit exceeded. Outstanding: ${customer.outstandingBalance.toFixed(2)}, invoice: ${totalAmount.toFixed(2)}, limit: ${customer.creditLimit.toFixed(2)}.`)
            }
          }
        }

        // Generate invoice number inside transaction (uses tx to avoid race condition)
        const invoiceNumber = await generateInvoiceNumber(tx)

        // Create invoice record
        const inv = await tx.invoice.create({
          data: {
            invoiceNumber,
            customerId: payload.customerId ?? null,
            subtotal,
            discountAmount,
            taxAmount,
            roundingAmount,
            totalAmount,
            paidAmount,
            balanceAmount,
            paymentStatus,
            gstType: payload.gstType ?? 'CGST_SGST',
            buyerState: payload.buyerState ?? null,
            dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
            tableId: payload.tableIds?.[0] ?? null,
            notes: customerTaxExempt
              ? [`Tax Exempt${customerTaxExemptReason ? ` — ${customerTaxExemptReason}` : ''}`, payload.notes].filter(Boolean).join(' | ')
              : (payload.notes ?? null),
            createdById: userId ?? null,
            status: 'ACTIVE'
          }
        })

        // Phase 58 §2 (2026-07-21) — Restaurant table↔order binding.
        // Atomically claim each selected table (same conditional-update
        // claim shape as the metal-exchange claim right below) — a table
        // already pointing at another running invoice can't be silently
        // re-claimed by a second concurrent dine-in order; selecting more
        // than one table here is exactly what a "merge tables for a large
        // party" order is (see RestaurantTable.currentInvoiceId's schema
        // comment).
        if (payload.tableIds && payload.tableIds.length > 0) {
          const tableClaim = await tx.restaurantTable.updateMany({
            where: { id: { in: payload.tableIds }, currentInvoiceId: null },
            data: { currentInvoiceId: inv.id, status: 'OCCUPIED' }
          })
          if (tableClaim.count !== payload.tableIds.length) {
            throw new ServiceError('INVOC-015', 'One or more selected tables are already part of another running order.')
          }
          // A CASH/UPI/CARD/WALLET dine-in order pays in full in this same
          // call (paymentStatus is already 'PAID' below, computed earlier
          // from payload.paymentMethod) — there's no later recordPayment
          // call coming to trigger the usual release hook, so without this
          // the table would stay OCCUPIED forever after an already-fully-
          // settled walk-in sale. Only a CREDIT/SPLIT order (paymentStatus
          // stays UNPAID here) is a real "running tab" that keeps the table
          // occupied until it's actually paid via payments.record later.
          if (paymentStatus === 'PAID') {
            await releaseTablesForInvoiceTx(tx, inv.id)
          }
        }

        // Atomically claim the metal exchange for this invoice — a
        // conditional update (not a plain unconditional one) so a second
        // concurrent invoice that read the same "still unlinked" exchange
        // before this transaction committed gets rejected here instead of
        // silently double-applying the same trade-in credit.
        if (payload.metalExchangeId) {
          const claim = await tx.metalExchange.updateMany({
            where: { id: payload.metalExchangeId, invoiceId: null },
            data: { invoiceId: inv.id }
          })
          if (claim.count === 0) {
            throw new ServiceError('INVOC-013', 'This metal exchange is already linked to another invoice.')
          }
        }

        // Create invoice items — productName snapshotted at time of sale (RULE: historical invoices must show original name)
        for (const item of validatedItems) {
          await tx.invoiceItem.create({
            data: {
              invoiceId: inv.id,
              productId: item.productId,
              productName: item.productName,
              productSku: item.productSku,
              hsnCode: item.hsnCode,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountAmount: item.discountAmount,
              taxRate: item.taxRate,
              taxAmount: item.lineTax,
              lineTotal: item.lineTotal,
              variantId: item.variantId,
              variantInfo: item.variantInfo,
              weightUnit: item.weightUnit,
              jewelleryMetalType: item.jewelleryMetalType,
              jewelleryPurity: item.jewelleryPurity,
              jewelleryNetWeight: item.jewelleryNetWeight,
              jewelleryRatePerGram: item.jewelleryRatePerGram,
              jewelleryMakingCharge: item.jewelleryMakingCharge,
              jewelleryHallmarkNumber: item.jewelleryHallmarkNumber,
              prescriptionPatientName: item.prescriptionPatientName,
              prescriptionDoctorName: item.prescriptionDoctorName,
              prescriptionDate: item.prescriptionDate
            }
          })
        }

        // Deduct inventory for STANDARD products (RULE I001 — movement created inside reduceStockTx)
        for (const item of validatedItems) {
          if (item.productType === 'STANDARD') {
            await inventoryService.reduceStockTx(
              tx, item.productId, item.quantity,
              `Invoice ${invoiceNumber}`, 'INVOICE', inv.id, userId
            )
            // Decrement per-variant stock (clothing/footwear); inventory.quantity already handled above
            if (item.variantId) {
              await decrementVariantStockTx(tx, item.variantId, item.quantity)
            }
            // Dispense FIFO from batch records (pharmacy); no-op if the product has no batches
            await deductBatchStockFIFO(tx, item.productId, item.quantity)
            // Link the specific device sold to this invoice (electronics); inventory.quantity already handled above
            if (item.serialId) {
              await markSerialSoldTx(tx, item.serialId, inv.id)
            }
          }
        }

        // Customer ledger: debit for CREDIT sales only (not SPLIT — SPLIT is pay-later per-payment-method)
        if (payload.customerId && isCredit) {
          await customerLedgerService.addEntry({
            customerId: payload.customerId,
            referenceType: 'INVOICE',
            referenceId: inv.id,
            debitAmount: totalAmount,
            creditAmount: 0,
            remarks: `Invoice ${invoiceNumber}`
          }, tx)
        }

        // Create payment record for direct payment methods only (not CREDIT or SPLIT which are deferred)
        if (!startsUnpaid) {
          await tx.payment.create({
            data: {
              invoiceId: inv.id,
              customerId: payload.customerId ?? null,
              paymentMethod: payload.paymentMethod,
              amount: totalAmount,
              referenceNumber: payload.referenceNumber ?? null,
              recordedById: userId ?? null
            }
          })
        }

        return inv
      }, { timeout: 15000, maxWait: 10000 })
      // Phase 55 stress-test finding: SQLite only allows one writer at a
      // time, so a burst of genuinely concurrent createInvoice calls (e.g.
      // several cashier terminals, or the QR-ordering HTTP server and the
      // main window both writing at once) queues most of them behind
      // whichever transaction currently holds the write lock. Prisma's
      // default interactive-transaction timeout (5000ms) is measured from
      // when a transaction STARTS, not from when it actually gets to run —
      // a transaction that spent most of that window merely queued, then
      // finally got the lock, could still get killed as "expired" moments
      // later purely because the clock had already run out, not because
      // anything was actually slow. Raised to 15s/10s (maxWait — time
      // allowed to even acquire a slot — separately from timeout — time
      // allowed once running) to absorb realistic contention bursts;
      // matches the precedent already set in db.ts's own migration runner
      // for the identical "default 5s isn't enough" problem. This does not
      // change what happens once genuinely exhausted — see the catch
      // block's now-specific P2028 message below — only how much
      // contention is absorbed before that path is reached at all.

      // Audit log AFTER successful transaction
      await logAction({
        userId,
        action: 'INVOICE_CREATED',
        entityType: 'Invoice',
        entityId: invoice.id,
        newValue: { invoiceNumber: invoice.invoiceNumber, totalAmount, paymentMethod: payload.paymentMethod }
      })

      // R15: Check for low-stock after deducting inventory for STANDARD products
      for (const item of validatedItems) {
        if (item.productType === 'STANDARD') {
          try {
            const db = getPrisma()
            const inv = await db.inventory.findUnique({ where: { productId: item.productId } })
            if (inv && inv.reorderLevel > 0 && inv.quantity <= inv.reorderLevel) {
              await createNotification({
                title: 'Low Stock Alert',
                message: `"${item.productName}" is at or below reorder level. Current stock: ${inv.quantity}.`,
                notificationType: 'WARNING'
              })
            }
          } catch { /* notification failure must not affect billing */ }
        }
      }

      return { success: true, data: invoice }
    } catch (err) {
      if (err instanceof ServiceError) {
        return { success: false, error: { code: err.code, message: err.message } }
      }
      // Phase 55 stress-test finding: under genuine write contention
      // (several concurrent sales hitting SQLite's single-writer lock at
      // once), a queued transaction can still get killed by Prisma's own
      // timeout before it ever gets a real turn to run — confirmed live via
      // Prisma's internal error log: "Transaction API error: Transaction
      // already closed: A query cannot be executed on an expired
      // transaction." Without this check it fell into the generic SYS-001
      // "something unexpected happened" catch-all, which is both
      // unhelpful (doesn't say what actually happened) and misleading
      // (implies a bug, not ordinary busy-system contention). No data
      // corruption occurs either way — Prisma still rolls the whole
      // transaction back cleanly — so surfacing a specific, honest,
      // retry-suggesting message here is a pure improvement with no
      // correctness downside.
      if (err instanceof Error && /transaction already closed|expired transaction/i.test(err.message)) {
        return { success: false, error: { code: 'INVOC-012', message: 'The system is busy processing another sale right now. Please try again in a moment.' } }
      }
      // A concurrent createInvoice call claimed the invoice-number sequence
      // first (generateInvoiceNumber's atomic claim) — same honest,
      // retry-suggesting story as the timeout case above, just a different
      // trigger. No data corruption either way — this whole transaction,
      // including the just-computed invoice, rolled back cleanly.
      if (err instanceof SequenceContendedError) {
        return { success: false, error: { code: 'INVOC-012', message: 'The system is busy processing another sale right now. Please try again in a moment.' } }
      }
      return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
  },

  async getInvoice(id: string) {
    const db = getPrisma()
    const invoice = await db.invoice.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, customerName: true, phone: true, customerCode: true } },
        createdBy: { select: { id: true, fullName: true } },
        items: {
          include: { product: { select: { id: true, unit: true } } }
        },
        payments: {
          where: { isReversed: false },
          include: { recordedBy: { select: { id: true, fullName: true } } },
          orderBy: { paymentDate: 'asc' }
        },
        kot: { select: { id: true, status: true } }
      }
    })
    if (!invoice) return { success: false, error: { code: 'INVOC-005', message: 'Invoice not found.' } }
    return { success: true, data: invoice }
  },

  async listInvoices(filters?: { status?: string; customerId?: string; dateFrom?: string; dateTo?: string; search?: string; page?: number; limit?: number }) {
    const db = getPrisma()
    const page = filters?.page ?? 1
    const limit = filters?.limit ?? 20
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {}
    if (filters?.status) where.status = filters.status
    if (filters?.customerId) where.customerId = filters.customerId
    if (filters?.dateFrom || filters?.dateTo) {
      where.invoiceDate = {
        // BUG FOUND 2026-07-22: gte used to be new Date(filters.dateFrom),
        // parsed as UTC midnight instead of local midnight — this is the
        // main Invoice List screen's own date-range filter.
        ...(filters.dateFrom ? { gte: parseLocalDateStart(filters.dateFrom) } : {}),
        // Full millisecond precision on the end boundary — without it, an
        // invoice created in the last second of the selected "to" date would
        // be silently excluded even though it falls within that calendar day.
        ...(filters.dateTo ? { lte: new Date(filters.dateTo + 'T23:59:59.999') } : {})
      }
    }
    if (filters?.search) {
      where.OR = [
        { invoiceNumber: { contains: filters.search } },
        { customer: { customerName: { contains: filters.search } } },
        { customer: { phone: { contains: filters.search } } }
      ]
    }

    const [invoices, total] = await db.$transaction([
      db.invoice.findMany({
        where,
        include: {
          customer: { select: { id: true, customerName: true, customerCode: true } },
          items: { select: { id: true } }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      db.invoice.count({ where })
    ])

    return { success: true, data: { invoices, total } }
  },

  // RULE B010: Cancelled invoices remain visible — soft cancel only
  async cancelInvoice(payload: CancelInvoicePayload, userId?: string) {
    const db = getPrisma()

    try {
      await db.$transaction(async (tx) => {
        // Lookup + status check must happen INSIDE the transaction — reading the
        // invoice beforehand and using that snapshot for the writes left a window
        // where two concurrent cancel calls for the same invoice could both pass
        // the "not already cancelled" check and each run the full reversal:
        // inventory restored twice, customer ledger reversed twice.
        const invoice = await tx.invoice.findUnique({
          where: { id: payload.invoiceId },
          include: { items: { include: { product: true } }, payments: { where: { isReversed: false } } }
        })
        if (!invoice) throw new ServiceError('INVOC-005', 'Invoice not found.')
        if (invoice.status === 'CANCELLED') {
          throw new ServiceError('INVOC-006', 'This invoice is already cancelled.')
        }
        // BUG FOUND 2026-07-22: every sibling mutation that must not touch a
        // RETURN invoice (splitInvoice's SPLIT-003, createReturn's RET-004)
        // has this exact guard; cancelInvoice didn't, relying only on the UI
        // hiding the Cancel button for return invoices. If ever reached
        // directly (the IPC handler only does a Zod shape check), this
        // function's inventory-restore loop below would increment stock a
        // second time for quantities the original return already restored
        // once, while its ledger-reversal query (filtered on
        // referenceType: 'INVOICE') would find nothing to reverse — because
        // the return posted its own ledger entry as referenceType: 'RETURN'
        // — so the return's credit would never be clawed back either.
        if (invoice.invoiceType === 'RETURN') {
          throw new ServiceError('INVOC-016', 'Cannot cancel a return invoice.')
        }

        // Serials aren't stored on InvoiceItem (linked the other way, via
        // ProductSerial.invoiceId, to avoid a schema migration) — look up
        // every device sold on this invoice once, up front.
        const soldSerials = await tx.productSerial.findMany({
          where: { invoiceId: invoice.id, status: 'SOLD' }
        })

        // Restore inventory for STANDARD products
        for (const item of invoice.items) {
          if (item.product.productType === 'STANDARD') {
            await tx.inventory.update({
              where: { productId: item.productId },
              data: { quantity: { increment: item.quantity } }
            })
            // Restore per-variant stock (clothing/footwear)
            if (item.variantId) {
              await tx.productVariant.update({
                where: { id: item.variantId },
                data: { stockQty: { increment: item.quantity } }
              })
            }
            // Restore batch quantityRemaining (pharmacy) — mirrors the FIFO
            // deduction done at sale time, so a cancelled invoice doesn't
            // leave batch stock permanently understated.
            await restoreBatchStockFIFO(tx, item.productId, item.quantity)
            await tx.inventoryMovement.create({
              data: {
                productId: item.productId,
                movementType: 'RETURN',
                quantity: item.quantity,
                referenceType: 'INVOICE_CANCEL',
                referenceId: invoice.id,
                remarks: `Cancellation of Invoice ${invoice.invoiceNumber}`,
                createdById: userId ?? null
              }
            })
          }
        }

        // Restore every device sold on this invoice back to AVAILABLE (electronics)
        for (const serial of soldSerials) {
          await markSerialAvailableTx(tx, serial.id)
        }

        // Reverse ONLY ledger entries that actually exist for this invoice and its payments.
        // Querying first prevents phantom reversals (e.g. cash sale with customer selected has
        // no ledger entry at invoice creation, so nothing to reverse there).
        if (invoice.customerId) {
          const paymentIds = invoice.payments.map(p => p.id)
          const existingLedgerEntries = await tx.customerLedger.findMany({
            where: {
              customerId: invoice.customerId,
              OR: [
                { referenceType: 'INVOICE', referenceId: invoice.id },
                ...(paymentIds.length > 0 ? [{ referenceType: 'PAYMENT', referenceId: { in: paymentIds } }] : [])
              ]
            }
          })

          for (const entry of existingLedgerEntries) {
            // Swap debit/credit to exactly offset the original entry
            await customerLedgerService.addEntry({
              customerId: invoice.customerId,
              referenceType: entry.referenceType === 'INVOICE' ? 'INVOICE_CANCEL' : 'PAYMENT_REVERSAL',
              referenceId: entry.referenceId ?? invoice.id,
              debitAmount: entry.creditAmount,
              creditAmount: entry.debitAmount,
              remarks: `Cancellation of Invoice ${invoice.invoiceNumber}`
            }, tx)
          }
        }

        // Auto-reverse all non-reversed payments so the audit trail stays clean
        // and cash/payment reports don't show phantom received amounts on cancelled invoices.
        if (invoice.payments.length > 0) {
          await tx.payment.updateMany({
            where: { invoiceId: payload.invoiceId, isReversed: false },
            data: { isReversed: true, reversalReason: `Auto-reversed: Invoice ${invoice.invoiceNumber} cancelled — ${payload.reason}` }
          })
        }

        // Soft cancel — RULE B010: remains visible
        const cancelNote = invoice.notes ? `${invoice.notes}\nCancelled: ${payload.reason}` : `Cancelled: ${payload.reason}`
        // RULE: preserve paidAmount — it represents cash actually collected before cancellation.
        // Only zero balanceAmount since nothing further is owed after cancellation.
        await tx.invoice.update({
          where: { id: payload.invoiceId },
          data: { status: 'CANCELLED', balanceAmount: 0, paymentStatus: 'CANCELLED', notes: cancelNote }
        })

        // Phase 58 §2 — a cancelled dine-in order is also a terminal state
        // for whichever table(s) it was running on.
        await releaseTablesForInvoiceTx(tx, invoice.id)
      })

      await logAction({ userId, action: 'INVOICE_CANCELLED', entityType: 'Invoice', entityId: payload.invoiceId, newValue: { reason: payload.reason } })
      return { success: true }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      const msg = err instanceof Error ? err.message : 'Failed to cancel invoice.'
      return { success: false, error: { code: 'SYS-001', message: msg } }
    }
  },

  // Phase 58 §2 (2026-07-21) — real split-bill. KOT.invoiceId is a strict
  // 1:1 @unique FK, so an existing KOT (and the ingredient deduction/kitchen
  // ticket it represents) intentionally stays pointed at the now-SPLIT
  // original invoice — the food was already one ticket; splitting only
  // divides how the BILL is paid, not how it was cooked/tracked. Only
  // callable while nothing has been paid yet (paidAmount === 0), which
  // keeps this from ever having to reconcile an existing payment against a
  // bill that no longer exists in its original shape.
  async splitInvoice(payload: SplitInvoicePayload, userId?: string) {
    const db = getPrisma()
    const businessProfile = await db.businessProfile.findFirst({ select: { currencyCode: true } })
    const currencyDecimals = getCurrencyDecimals(businessProfile?.currencyCode)

    try {
      const newInvoiceIds = await db.$transaction(async (tx) => {
        const original = await tx.invoice.findUnique({ where: { id: payload.invoiceId }, include: { items: true } })
        if (!original) throw new ServiceError('SPLIT-001', 'Invoice not found.')
        if (original.paidAmount > 0.01) throw new ServiceError('SPLIT-002', 'Cannot split an invoice that already has a payment recorded — reverse the payment first.')
        if (original.invoiceType === 'RETURN') throw new ServiceError('SPLIT-003', 'Cannot split a return invoice.')

        // Atomic claim: ACTIVE -> SPLIT right here, guarded by a
        // conditional update — mirrors generateTimeEntryInvoice's
        // atomic-claim pattern, so two concurrent split calls on the same
        // invoice can't both succeed. Also zero out the original's own
        // financial totals (safe — paidAmount is guaranteed 0 by the guard
        // above): its value has fully moved to the new split invoices, and
        // several report.service.ts queries filter invoices by
        // `status: { not: 'CANCELLED' }` rather than `status: 'ACTIVE'` —
        // zeroing here (not just relying on every such query to also know
        // about 'SPLIT') is what actually prevents the original + its
        // children from double-counting revenue/outstanding.
        const claim = await tx.invoice.updateMany({
          where: { id: payload.invoiceId, status: 'ACTIVE' },
          data: { status: 'SPLIT', subtotal: 0, discountAmount: 0, taxAmount: 0, totalAmount: 0, balanceAmount: 0, paymentStatus: 'PAID' }
        })
        if (claim.count === 0) throw new ServiceError('SPLIT-004', 'This invoice is not in a splittable state (already split or cancelled).')

        // Validate every allocated item belongs to this invoice and the
        // total allocated quantity per line never exceeds what was
        // originally billed on that line.
        const itemById = new Map(original.items.map(i => [i.id, i]))
        const allocatedByItem = new Map<string, number>()
        for (const split of payload.splits) {
          for (const alloc of split.allocations) {
            if (!itemById.has(alloc.invoiceItemId)) {
              throw new ServiceError('SPLIT-005', 'One of the selected items does not belong to this invoice.')
            }
            allocatedByItem.set(alloc.invoiceItemId, (allocatedByItem.get(alloc.invoiceItemId) ?? 0) + alloc.quantity)
          }
        }
        for (const [itemId, allocatedQty] of allocatedByItem) {
          const item = itemById.get(itemId)!
          if (allocatedQty > item.quantity + 0.001) {
            throw new ServiceError('SPLIT-006', `Allocated quantity for "${item.productName}" (${allocatedQty}) exceeds the original billed quantity (${item.quantity}).`)
          }
        }

        const createdInvoiceIds: string[] = []
        for (const split of payload.splits) {
          const invoiceNumber = await generateInvoiceNumber(tx)

          const lineRows: Array<ReturnType<typeof calculateLineTotal> & { itemId: string }> = split.allocations.map(alloc => {
            const item = itemById.get(alloc.invoiceItemId)!
            // Discount is prorated by the fraction of the line's original
            // quantity this check is taking, then a fresh line is computed
            // from scratch via the same calculateLineTotal() every other
            // invoice line in this app goes through — not a proration of
            // the original (already-rounded) lineTotal, which would
            // compound rounding error across N splits.
            const proratedDiscount = roundCurrency(item.discountAmount * (alloc.quantity / item.quantity), currencyDecimals)
            return { itemId: item.id, ...calculateLineTotal(alloc.quantity, item.unitPrice, proratedDiscount, item.taxRate, currencyDecimals) }
          })

          const subtotal = sumCurrency(lineRows.map(r => r.subtotal), currencyDecimals)
          const discountAmount = sumCurrency(lineRows.map(r => r.discountAmount), currencyDecimals)
          const taxAmount = sumCurrency(lineRows.map(r => r.taxAmount), currencyDecimals)
          const totalAmount = sumCurrency(lineRows.map(r => r.lineTotal), currencyDecimals)

          const newInv = await tx.invoice.create({
            data: {
              invoiceNumber,
              customerId: split.customerId ?? original.customerId,
              subtotal,
              discountAmount,
              taxAmount,
              roundingAmount: 0,
              totalAmount,
              paidAmount: 0,
              balanceAmount: totalAmount,
              paymentStatus: 'UNPAID',
              gstType: original.gstType,
              buyerState: original.buyerState,
              tableId: original.tableId,
              splitFromInvoiceId: original.id,
              notes: `Split from ${original.invoiceNumber}`,
              createdById: userId ?? null,
              status: 'ACTIVE'
            }
          })

          for (const row of lineRows) {
            const item = itemById.get(row.itemId)!
            const alloc = split.allocations.find(a => a.invoiceItemId === row.itemId)!
            await tx.invoiceItem.create({
              data: {
                invoiceId: newInv.id,
                productId: item.productId,
                productName: item.productName,
                productSku: item.productSku,
                hsnCode: item.hsnCode,
                quantity: alloc.quantity,
                unitPrice: item.unitPrice,
                discountAmount: row.discountAmount,
                taxRate: item.taxRate,
                taxAmount: row.taxAmount,
                lineTotal: row.lineTotal,
                variantId: item.variantId,
                variantInfo: item.variantInfo,
                weightUnit: item.weightUnit,
              }
            })
          }

          createdInvoiceIds.push(newInv.id)
        }

        // A table's currentInvoiceId can only ever point at ONE invoice —
        // splitting into N checks means the table isn't done yet (guests
        // are still settling separate checks), so it stays OCCUPIED, just
        // re-pointed at the first split check instead of the now-zeroed
        // original (which would otherwise fail mergeTableIntoInvoice's
        // "must be ACTIVE" guard). Staff releases the table normally once
        // every split check is actually paid.
        if (createdInvoiceIds.length > 0) {
          await tx.restaurantTable.updateMany({
            where: { currentInvoiceId: original.id },
            data: { currentInvoiceId: createdInvoiceIds[0] }
          })
        }

        return createdInvoiceIds
      }, { timeout: 15000, maxWait: 10000 })

      await logAction({ userId, action: 'INVOICE_SPLIT', entityType: 'Invoice', entityId: payload.invoiceId, newValue: { splitInto: newInvoiceIds } })
      return { success: true, data: { invoiceIds: newInvoiceIds } }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      const msg = err instanceof Error ? err.message : 'Failed to split invoice.'
      return { success: false, error: { code: 'SYS-001', message: msg } }
    }
  }
}
