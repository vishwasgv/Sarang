import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { parseLocalDateStart, toLocalISODate } from '../utils/date.util'
import { inventoryService } from './inventory.service'
import { customerLedgerService } from './customer-ledger.service'
import { isModuleEnabled } from './industry-template.service'
import { generateInvoiceNumber, postInvoiceJournalEntry } from './billing.service'
import { explodeKitComponentsTx } from './kit.service'
import { generateSONumber } from './sales-order.service'
import { generateSequenceNumber } from './sequence.service'
import { calculateLineTotal, sumCurrency, roundCurrency, getCurrencyDecimals } from './currency.service'
import { computeDocumentTotals } from '../../shared/utils/money'
import { resolveDocumentGstType, customerStateOf, lineTaxCategories } from './gst-type.util'
import { ServiceError } from '../errors/service-error'
import { getLicenseState } from './license.service'
import { createRetainer, generateInvoiceForRetainer } from './retainer.service'
import { getBusinessCurrencyDecimals, getInvoiceRoundingRule } from './settings.service'

export interface CreateQuotationPayload {
  customerId?: string
  customerName?: string
  validUntil?: string
  notes?: string
  // Phase 63 — set when this Estimate represents a retainer engagement;
  // mirrors RetainerAgreement.retainerType's own enum. Drives
  // convertToRetainer() below instead of the normal one-shot
  // convertToInvoice() when accepted.
  retainerType?: 'FIXED_FEE' | 'HOURLY_BUCKET' | 'DELIVERABLE_BASED'
  pricesIncludeTax?: boolean
  gstType?: 'CGST_SGST' | 'IGST' | 'GST'
  items: Array<{
    productId?: string
    productName: string
    sku?: string
    quantity: number
    unitPrice: number
    discount?: number
    taxRate?: number
    // HSN/SAC; filled from the product when not given
    hsnCode?: string
  }>
}

export interface UpdateQuotationStatusPayload {
  id: string
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'EXPIRED'
}

export const quotationService = {
  async create(payload: CreateQuotationPayload, userId: string) {
    const db = getPrisma()

    // Real bug found live (core-commerce audit): subtotal/discountAmount/
    // taxAmount/totalAmount used to be accumulated with plain `+=` on raw
    // floats instead of routing through currency.service.ts's Decimal-backed
    // helpers the way billing.service.ts does — not just cosmetic here,
    // since convertToInvoice() below copies these totals verbatim onto a
    // real Invoice and posts `debitAmount: q.totalAmount` straight into the
    // customer's real ledger balance. QuotationItem.discount is stored as a
    // PERCENT (not a currency amount), so it's converted to an amount first
    // (rounded) before being fed into the same calculateLineTotal used
    // everywhere else in this scope.
    const businessProfile = await db.businessProfile.findFirst({ select: { currencyCode: true } })
    const currencyDecimals = getCurrencyDecimals(businessProfile?.currencyCode)

    // Same shared module the quotation form runs on screen (src/shared/utils/money.ts).
    const computed = computeDocumentTotals(
      payload.items.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, discountPercent: i.discount ?? 0, taxRate: i.taxRate ?? 0 })),
      { decimals: currencyDecimals, pricesIncludeTax: payload.pricesIncludeTax === true }
    )
    const { subtotal, discountAmount, taxAmount, totalAmount } = computed
    const gstType = await resolveDocumentGstType(payload.gstType, await customerStateOf(payload.customerId))

    const productIds = Array.from(new Set(payload.items.map(i => i.productId).filter((x): x is string => !!x)))
    const hsnByProduct = new Map<string, string | null>()
    if (productIds.length > 0) {
      try {
        const rows = await db.product.findMany({ where: { id: { in: productIds } }, select: { id: true, hsnCode: true } })
        for (const r of rows) hsnByProduct.set(r.id, r.hsnCode ?? null)
      } catch { /* the HSN is a snapshot convenience, never blocks a quotation */ }
    }
    const computedItems = payload.items.map((item, idx) => ({
      ...item, discount: item.discount ?? 0, taxRate: item.taxRate ?? 0, lineTotal: computed.lines[idx].total,
      hsnCode: item.hsnCode?.trim() || (item.productId ? hsnByProduct.get(item.productId) ?? null : null)
    }))

    // Number generation must happen inside the same transaction as the
    // insert — see sequence.service.ts's header comment for why a plain
    // pre-transaction read is a real race under concurrent creates.
    const quotation = await db.$transaction(async (tx) => {
      const quotationNumber = await generateSequenceNumber(
        tx, 'quotation_sequence', 'QT', 5,
        async () => {
          const last = await tx.quotation.findFirst({ orderBy: { createdAt: 'desc' }, select: { quotationNumber: true } })
          return last ? parseInt(last.quotationNumber.replace('QT-', ''), 10) : 0
        }
      )

      return tx.quotation.create({
        data: {
          quotationNumber,
          customerId: payload.customerId ?? null,
          customerName: payload.customerName ?? null,
          // Real bug found live (2026-07-28 core-commerce audit): a bare
          // `new Date('YYYY-MM-DD')` parses as UTC midnight — wrong by a day
          // when displayed in any timezone behind UTC. Same fix as
          // billing.service.ts's dueDate (see its comment there).
          validUntil: payload.validUntil ? parseLocalDateStart(payload.validUntil) : null,
          notes: payload.notes ?? null,
          retainerType: payload.retainerType ?? null,
          subtotal,
          taxAmount,
          discountAmount,
          totalAmount,
          pricesIncludeTax: payload.pricesIncludeTax === true,
          gstType,
          createdBy: userId,
          items: { create: computedItems }
        },
        include: { items: true, customer: true }
      })
    })

    await logAction({ userId, action: 'CREATE_QUOTATION', entityType: 'Quotation', entityId: quotation.id, newValue: `Quotation ${quotation.quotationNumber}` })
    return { success: true, data: quotation }
  },

  // A quotation whose valid-until date has passed and that was never accepted
  // is marked EXPIRED. Runs whenever the list loads and on the hourly
  // evaluator, so the Expired filter is real without any manual step.
  async expireOverdue(): Promise<number> {
    try {
      const db = getPrisma()
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      const res = await db.quotation.updateMany({
        where: { status: { in: ['DRAFT', 'SENT'] }, validUntil: { not: null, lt: startOfToday }, invoice: { is: null }, salesOrder: { is: null } },
        data: { status: 'EXPIRED' }
      })
      return res.count
    } catch {
      return 0
    }
  },

  async list(params: { status?: string; customerId?: string; page?: number; limit?: number }) {
    await this.expireOverdue()
    const db = getPrisma()
    const { status, customerId, page = 1, limit = 50 } = params
    const where = {
      ...(status ? { status } : {}),
      ...(customerId ? { customerId } : {})
    }
    const [quotations, total] = await Promise.all([
      db.quotation.findMany({
        where,
        // Real bug found live (Phase 67 §9.1): this list query never
        // included `invoice`, even though QuotationsScreen.tsx's own list
        // row branches on `q.invoice` to decide whether to show a link to
        // the converted invoice or the "Convert to Invoice" button — always
        // undefined here, so an already-converted quotation kept showing
        // "Convert to Invoice" on the list screen until the backend
        // rejected the repeat attempt with QT-002. Fixed by including both
        // conversion targets, adding `salesOrder` at the same time for this
        // phase's new Quote -> Order -> Invoice pipeline.
        include: { customer: true, invoice: true, salesOrder: true, _count: { select: { items: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      db.quotation.count({ where })
    ])
    return { success: true, data: { quotations, total } }
  },

  async getById(id: string) {
    const db = getPrisma()
    const q = await db.quotation.findUnique({
      where: { id },
      include: { items: true, customer: true, invoice: true }
    })
    if (!q) return { success: false, error: { code: 'QT-001', message: 'Quotation not found.' } }
    return { success: true, data: q }
  },

  async updateStatus(payload: UpdateQuotationStatusPayload, userId: string) {
    const db = getPrisma()
    // Re-opening a lapsed quotation (EXPIRED -> DRAFT/SENT) clears the old
    // valid-until date; otherwise the next expiry pass would immediately
    // mark it EXPIRED again.
    const reopening = payload.status === 'DRAFT' || payload.status === 'SENT'
    const q = await db.quotation.update({
      where: { id: payload.id },
      data: reopening ? { status: payload.status, validUntil: null } : { status: payload.status }
    })
    await logAction({ userId, action: 'UPDATE_QUOTATION_STATUS', entityType: 'Quotation', entityId: q.id, newValue: `Status → ${payload.status}` })
    return { success: true, data: q }
  },

  async convertToInvoice(id: string, userId: string) {
    // Phase 59 licensing gate — this creates a real invoice exactly like
    // billing.service.ts's createInvoice, and must be blocked the same way
    // once the current license key's year has genuinely expired (TRIAL's
    // free year or, since 2026-07-28, a PAID key's paid year too — see
    // license.service.ts's getLicenseState()). Without this, converting a
    // quotation was a complete bypass of the licensing enforcement (every
    // other invoice-creating path in the app routes through createInvoice,
    // which already has this check — this was the one path that didn't).
    const licenseState = await getLicenseState()
    if (licenseState.status === 'EXPIRED') {
      const message = licenseState.tier === 'PAID'
        ? 'Your license has expired. Renew (Settings → License) to keep creating new invoices — all your existing data remains fully accessible.'
        : 'Your free year has ended. Renew your license (Settings → License) to keep creating new invoices — all your existing data remains fully accessible.'
      return { success: false, error: { code: 'LIC-002', message } }
    }

    const db = getPrisma()
    const q = await db.quotation.findUnique({ where: { id }, include: { items: true, invoice: true, salesOrder: true } })
    if (!q) return { success: false, error: { code: 'QT-001', message: 'Quotation not found.' } }
    if (q.invoice) return { success: false, error: { code: 'QT-002', message: 'Quotation already converted to an invoice.' } }
    if (q.status === 'EXPIRED') {
      const when = q.validUntil ? q.validUntil.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'its valid-until date'
      return { success: false, error: { code: 'QT-009', message: `This quotation expired on ${when}. Change its status back to Sent to re-open it, then convert.` } }
    }
    // Phase 67 §9.1 — Universal Quote -> Order -> Invoice pipeline. Once a
    // Quotation has become a SalesOrder, billing must go through THAT
    // SalesOrder's own createInvoiceFromSalesOrder() (which tracks partial
    // invoicing via SalesOrderItem.invoicedQty) — going straight to Invoice
    // here instead would silently bypass that tracking and double-book the
    // same quoted items across two independent, disconnected invoices.
    if (q.salesOrder) return { success: false, error: { code: 'QT-006', message: 'Quotation already converted to a Sales Order. Invoice from the Sales Order instead.' } }

    const businessProfile = await db.businessProfile.findFirst({ select: { currencyCode: true } })
    const currencyDecimals = getCurrencyDecimals(businessProfile?.currencyCode)
    // The same rounding rule a direct sale uses, so a converted invoice equals a directly created one.
    const roundingRule = await getInvoiceRoundingRule(businessProfile?.currencyCode)

    // Resolve productId for each item: use linked product or find by name; fallback to a Misc product.
    // productType is carried through so only real STANDARD products get stock deducted below.
    const resolvedItems = await Promise.all(q.items.map(async (item) => {
      if (item.productId) {
        const p = await db.product.findUnique({ where: { id: item.productId }, select: { productType: true, isKit: true, hsnCode: true } })
        return { ...item, hsnCode: item.hsnCode ?? p?.hsnCode ?? null, resolvedProductId: item.productId, resolvedProductType: p?.productType ?? 'STANDARD', resolvedIsKit: p?.isKit ?? false }
      }
      const byName = await db.product.findFirst({ where: { productName: item.productName, isActive: true } })
      if (byName) return { ...item, hsnCode: item.hsnCode ?? byName.hsnCode ?? null, resolvedProductId: byName.id, resolvedProductType: byName.productType, resolvedIsKit: byName.isKit }
      // No matching product — get or create a system Miscellaneous product
      let misc = await db.product.findFirst({ where: { productName: '__MISC_ITEM__' } })
      if (!misc) {
        misc = await db.product.create({
          data: { productName: '__MISC_ITEM__', sellingPrice: 0, taxRate: 0, productType: 'SERVICE', unit: 'PCS', isActive: true }
        })
      }
      return { ...item, hsnCode: item.hsnCode ?? null, resolvedProductId: misc.id, resolvedProductType: misc.productType, resolvedIsKit: false }
    }))

    // A converted invoice always starts fully unpaid (the quotation never collected
    // payment) — treat it like a CREDIT sale for credit-limit enforcement, matching
    // billing.service.ts's own createInvoice behaviour.
    const creditLimitModuleEnabled = await isModuleEnabled('credit_limit_enforcement')

    // REAL BUG found+fixed in this session's pre-release audit: this used to
    // (a) round the discount as a single `qty*unitPrice*pct` expression,
    // while create() above rounds the gross FIRST and applies the percent to
    // that rounded gross — two different formulas that can disagree by a
    // cent on a fractional qty/price landing on a rounding boundary — and
    // (b) copy the invoice header totals (subtotal/tax/discount/total)
    // verbatim from the quotation instead of deriving them from the
    // invoice's own freshly-computed line items, unlike every other
    // invoice-creating path in this app (createInvoice, splitInvoice), which
    // always sums its own line rows for the header. Together these could
    // produce an Invoice.totalAmount that didn't equal the sum of its own
    // InvoiceItem.lineTotal rows. Fixed by computing line rows once here
    // (mirroring create()'s exact rounding order) and deriving the header
    // from summing them, exactly like createInvoice/splitInvoice do.
    const invoiceComputed = computeDocumentTotals(
      resolvedItems.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, discountPercent: i.discount, taxRate: i.taxRate })),
      { decimals: currencyDecimals, pricesIncludeTax: q.pricesIncludeTax, roundingRule }
    )
    const invoiceCategories = await lineTaxCategories(resolvedItems.map(i => ({ productId: i.resolvedProductId, taxRate: i.taxRate })))
    const invoiceLineRows = resolvedItems.map((item, idx) => {
      const l = invoiceComputed.lines[idx]
      return { taxCategory: invoiceCategories[idx], item, lineGross: l.gross, lineDiscountAmount: l.discountAmount, lineTaxAmount: l.tax, lineTotal: l.total }
    })
    const { subtotal: invoiceSubtotal, discountAmount: invoiceDiscountAmount, taxAmount: invoiceTaxAmount, roundingAmount: invoiceRoundingAmount, totalAmount: invoiceTotalAmount } = invoiceComputed

    try {
      const invoice = await db.$transaction(async (tx) => {
        // Real race found in the zero-logical-errors audit: q.invoice/
        // q.salesOrder above were read from a plain pre-transaction query —
        // two concurrent conversions of the same Quotation (one to Invoice,
        // one to Sales Order, or a double-click firing this twice) could
        // both pass the QT-002/QT-006 guard before either write commits,
        // leaving one Quotation pointing at BOTH a real Invoice and a real
        // Sales Order — which can itself later be invoiced again via
        // createInvoiceFromSalesOrder, billing the same goods twice. Same
        // TOCTOU class already fixed for receivePO/PDC/fixed-asset/landed-cost
        // this session — re-check fresh, inside the transaction, right
        // before the write.
        const fresh = await tx.quotation.findUnique({ where: { id }, select: { invoice: { select: { id: true } }, salesOrder: { select: { id: true } } } })
        if (fresh?.invoice) throw new ServiceError('QT-002', 'Quotation already converted to an invoice.')
        if (fresh?.salesOrder) throw new ServiceError('QT-006', 'Quotation already converted to a Sales Order. Invoice from the Sales Order instead.')

        if (q.customerId && creditLimitModuleEnabled) {
          const customer = await tx.customer.findUnique({ where: { id: q.customerId } })
          if (customer && customer.creditLimit > 0) {
            const projectedBalance = customer.outstandingBalance + invoiceTotalAmount
            if (projectedBalance > customer.creditLimit) {
              throw new ServiceError('CUST-003', `Credit limit exceeded. Outstanding: ${customer.outstandingBalance.toFixed(2)}, invoice: ${invoiceTotalAmount.toFixed(2)}, limit: ${customer.creditLimit.toFixed(2)}.`)
            }
          }
        }

        const invoiceNumber = await generateInvoiceNumber(tx)

        const inv = await tx.invoice.create({
          data: {
            invoiceNumber,
            invoiceType: 'RETAIL',
            customerId: q.customerId ?? null,
            subtotal: invoiceSubtotal,
            taxAmount: invoiceTaxAmount,
            discountAmount: invoiceDiscountAmount,
            roundingAmount: invoiceRoundingAmount,
            totalAmount: invoiceTotalAmount,
            pricesIncludeTax: q.pricesIncludeTax,
            gstType: q.gstType,
            balanceAmount: invoiceTotalAmount,
            quotationId: q.id,
            createdById: userId
          }
        })

        for (const { item, lineDiscountAmount, lineTaxAmount, lineTotal, taxCategory } of invoiceLineRows) {
          await tx.invoiceItem.create({
            data: {
              invoiceId: inv.id,
              productId: item.resolvedProductId,
              productName: item.productName,
              productSku: item.sku ?? null,
              hsnCode: item.hsnCode ?? null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountAmount: lineDiscountAmount,
              taxRate: item.taxRate,
              taxCategory,
              taxAmount: lineTaxAmount,
              lineTotal
            }
          })

          if (item.resolvedIsKit) {
            const componentLines = await explodeKitComponentsTx(tx, item.resolvedProductId, item.quantity)
            for (const comp of componentLines) {
              await inventoryService.reduceStockTx(
                tx, comp.componentProductId, comp.quantity,
                `Invoice ${invoiceNumber} (converted from quotation ${q.quotationNumber}, component of kit "${item.productName}")`, 'INVOICE', inv.id, userId
              )
            }
          } else if (item.resolvedProductType === 'STANDARD') {
            await inventoryService.reduceStockTx(
              tx, item.resolvedProductId, item.quantity,
              `Invoice ${invoiceNumber} (converted from quotation ${q.quotationNumber})`, 'INVOICE', inv.id, userId
            )
          }
        }

        if (q.customerId) {
          await customerLedgerService.addEntry({
            customerId: q.customerId,
            referenceType: 'INVOICE',
            referenceId: inv.id,
            debitAmount: invoiceTotalAmount,
            creditAmount: 0,
            remarks: `Invoice ${invoiceNumber} (converted from quotation ${q.quotationNumber})`
          }, tx)
        }

        // Phase 63 gap-fix — a converted invoice never posted to the GL at
        // all before this. Always CREDIT-shaped (a quotation never collects
        // payment itself), so receivesCashNow=false — Debit Accounts
        // Receivable, same as any other unpaid invoice.
        await postInvoiceJournalEntry(tx, inv, false)

        await tx.quotation.update({ where: { id }, data: { status: 'ACCEPTED' } })

        return inv
      })

      await logAction({ userId, action: 'CONVERT_QUOTATION', entityType: 'Invoice', entityId: invoice.id, newValue: `From quotation ${q.quotationNumber}` })
      return { success: true, data: invoice }
    } catch (err) {
      if (err instanceof ServiceError) {
        return { success: false, error: { code: err.code, message: err.message } }
      }
      return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
  },

  // Phase 67 §9.1 — General's Universal Quote -> Order -> Invoice pipeline.
  // Quotation already converts straight to Invoice (convertToInvoice above),
  // and SalesOrder already converts to Invoice (salesOrderService's own
  // createInvoiceFromSalesOrder, partial-invoicing aware) — but nothing ever
  // connected the two, so there was no way to chain all three. This is the
  // missing middle link: turns an accepted Quotation into a real SalesOrder
  // (SalesOrder.quotationId), which can then be invoiced (fully or in
  // stages) through the existing SalesOrder flow.
  //
  // Mirrors convertToInvoice()'s own product-resolution logic exactly
  // (same-product / find-by-name / Misc fallback) rather than reusing
  // salesOrderService.createSalesOrder() — that function expects a fresh
  // caller-supplied payload, not an existing quotation's already-priced
  // items, and this needs the SAME transaction to also flip the
  // Quotation's own status, matching convertToInvoice's own shape.
  //
  // SalesOrderItem has no discount column at all (confirmed via schema —
  // unlike QuotationItem/InvoiceItem). Rather than silently dropping a
  // quotation's line discounts or adding a new column just for this,
  // each discount is folded into a reduced effective unit price so the
  // Sales Order's own total still exactly matches what the customer agreed
  // to on the quotation — the Sales Order simply reflects the final
  // negotiated per-unit price, with no separate discount line to show.
  async convertToSalesOrder(id: string, userId: string) {
    const db = getPrisma()
    const q = await db.quotation.findUnique({ where: { id }, include: { items: true, invoice: true, salesOrder: true } })
    if (!q) return { success: false, error: { code: 'QT-001', message: 'Quotation not found.' } }
    if (q.invoice) return { success: false, error: { code: 'QT-002', message: 'Quotation already converted to an invoice.' } }
    if (q.salesOrder) return { success: false, error: { code: 'QT-008', message: 'Quotation already converted to a Sales Order.' } }
    if (q.status === 'EXPIRED') {
      const when = q.validUntil ? q.validUntil.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'its valid-until date'
      return { success: false, error: { code: 'QT-009', message: `This quotation expired on ${when}. Change its status back to Sent to re-open it, then convert.` } }
    }
    if (!q.customerId) return { success: false, error: { code: 'QT-007', message: 'A Sales Order requires a real customer, not a walk-in name.' } }

    const customer = await db.customer.findUnique({ where: { id: q.customerId } })
    if (!customer) return { success: false, error: { code: 'CUST-001', message: 'Customer not found.' } }
    if (!customer.isActive) return { success: false, error: { code: 'CUST-004', message: 'Cannot create a Sales Order for an archived customer.' } }

    const businessProfile = await db.businessProfile.findFirst({ select: { currencyCode: true } })
    const currencyDecimals = getCurrencyDecimals(businessProfile?.currencyCode)

    const resolvedItems = await Promise.all(q.items.map(async (item) => {
      if (item.productId) {
        let productHsn: string | null = null
        if (!item.hsnCode) {
          try { productHsn = (await db.product.findUnique({ where: { id: item.productId }, select: { hsnCode: true } }))?.hsnCode ?? null } catch { /* HSN is a snapshot convenience */ }
        }
        return { ...item, hsnCode: item.hsnCode ?? productHsn, resolvedProductId: item.productId as string | null }
      }
      const byName = await db.product.findFirst({ where: { productName: item.productName, isActive: true } })
      if (byName) return { ...item, hsnCode: item.hsnCode ?? byName.hsnCode ?? null, resolvedProductId: byName.id }
      let misc = await db.product.findFirst({ where: { productName: '__MISC_ITEM__' } })
      if (!misc) {
        misc = await db.product.create({
          data: { productName: '__MISC_ITEM__', sellingPrice: 0, taxRate: 0, productType: 'SERVICE', unit: 'PCS', isActive: true }
        })
      }
      return { ...item, hsnCode: item.hsnCode ?? null, resolvedProductId: misc.id }
    }))

    // Inclusive quotations carry their exact computed line values across (the SO has no discount
    // column, so a rounded effective unit price alone could drift a minor unit from the quotation).
    const quoteComputed = q.pricesIncludeTax
      ? computeDocumentTotals(
          resolvedItems.map(i => ({ quantity: i.quantity, unitPrice: i.unitPrice, discountPercent: i.discount, taxRate: i.taxRate })),
          { decimals: currencyDecimals, pricesIncludeTax: true }
        )
      : null
    const lineRows = resolvedItems.map((item, idx) => {
      const lineGross = roundCurrency(item.quantity * item.unitPrice, currencyDecimals)
      const lineDiscountAmount = roundCurrency(lineGross * (item.discount / 100), currencyDecimals)
      // Effective net-of-discount unit price — the SalesOrder line's own
      // total (quantity * effectiveUnitPrice, taxed) reproduces the
      // quotation line's already-agreed total with no separate discount field.
      const effectiveUnitPrice = item.quantity > 0 ? roundCurrency((lineGross - lineDiscountAmount) / item.quantity, currencyDecimals) : item.unitPrice
      if (quoteComputed) {
        const l = quoteComputed.lines[idx]
        return { item, effectiveUnitPrice, lineTaxAmount: l.tax, lineTotal: l.total }
      }
      const { taxAmount: lineTaxAmount, lineTotal } = calculateLineTotal(item.quantity, effectiveUnitPrice, 0, item.taxRate, currencyDecimals)
      return { item, effectiveUnitPrice, lineTaxAmount, lineTotal }
    })
    const soSubtotal = quoteComputed
      ? sumCurrency([quoteComputed.subtotal, -quoteComputed.discountAmount], currencyDecimals)
      : sumCurrency(lineRows.map(r => roundCurrency(r.item.quantity * r.effectiveUnitPrice, currencyDecimals)), currencyDecimals)
    const soTaxAmount = quoteComputed ? quoteComputed.taxAmount : sumCurrency(lineRows.map(r => r.lineTaxAmount), currencyDecimals)
    const soTotalAmount = quoteComputed ? sumCurrency(lineRows.map(r => r.lineTotal), currencyDecimals) : roundCurrency(soSubtotal + soTaxAmount, currencyDecimals)

    try {
      const salesOrder = await db.$transaction(async (tx) => {
        // Same TOCTOU race fix as convertToInvoice's own re-check above —
        // q.invoice/q.salesOrder were read from a plain pre-transaction
        // query at the top of this function.
        const fresh = await tx.quotation.findUnique({ where: { id }, select: { invoice: { select: { id: true } }, salesOrder: { select: { id: true } } } })
        if (fresh?.invoice) throw new ServiceError('QT-002', 'Quotation already converted to an invoice.')
        if (fresh?.salesOrder) throw new ServiceError('QT-008', 'Quotation already converted to a Sales Order.')

        const soNumber = await generateSONumber(tx)

        const so = await tx.salesOrder.create({
          data: {
            soNumber,
            customerId: q.customerId!,
            status: 'DRAFT',
            subtotal: soSubtotal,
            taxAmount: soTaxAmount,
            totalAmount: soTotalAmount,
            pricesIncludeTax: q.pricesIncludeTax,
            gstType: q.gstType,
            notes: q.notes ? `Converted from quotation ${q.quotationNumber}. ${q.notes}` : `Converted from quotation ${q.quotationNumber}.`,
            quotationId: q.id,
            createdById: userId,
            items: {
              create: lineRows.map(({ item, effectiveUnitPrice, lineTaxAmount, lineTotal }) => ({
                productId: item.resolvedProductId,
                hsnCode: item.hsnCode,
                quantity: item.quantity,
                unitPrice: effectiveUnitPrice,
                taxRate: item.taxRate,
                taxAmount: lineTaxAmount,
                total: lineTotal
              }))
            }
          }
        })

        await tx.quotation.update({ where: { id }, data: { status: 'ACCEPTED' } })

        return so
      })

      await logAction({ userId, action: 'CONVERT_QUOTATION_TO_SO', entityType: 'SalesOrder', entityId: salesOrder.id, newValue: `From quotation ${q.quotationNumber}` })
      return { success: true, data: salesOrder }
    } catch (err) {
      if (err instanceof ServiceError) {
        return { success: false, error: { code: err.code, message: err.message } }
      }
      return { success: false, error: { code: 'SYS-001', message: 'Something unexpected happened. Please try again.' } }
    }
  },

  // Phase 63 — Estimate → auto-create Retainer Invoice on accept. A retainer-
  // flagged Quotation takes this path instead of the normal one-shot
  // convertToInvoice() above: creates a real RetainerAgreement (reusing the
  // customer's already-active one instead of creating a duplicate, if one
  // exists) and immediately generates its first period's invoice via
  // retainer.service.ts's own existing generateInvoiceForRetainer — not a
  // second, parallel billing mechanism, a synchronous first call to the one
  // that already exists and is already exercised by every other retainer.
  async convertToRetainer(id: string, userId: string) {
    const db = getPrisma()
    const q = await db.quotation.findUnique({ where: { id } })
    if (!q) return { success: false, error: { code: 'QT-001', message: 'Quotation not found.' } }
    if (!q.retainerType) return { success: false, error: { code: 'QT-004', message: 'This quotation is not marked as a retainer engagement.' } }
    if (q.status === 'ACCEPTED') return { success: false, error: { code: 'QT-002', message: 'Quotation already accepted.' } }
    if (!q.customerId) return { success: false, error: { code: 'QT-005', message: 'A retainer engagement requires a real customer, not a walk-in name.' } }

    try {
      const decimals = await getBusinessCurrencyDecimals()
      let retainerId: string
      const existingActive = await db.retainerAgreement.findFirst({ where: { clientId: q.customerId, status: 'ACTIVE' } })
      if (existingActive) {
        retainerId = existingActive.id
      } else {
        const created = await createRetainer({
          clientId: q.customerId,
          title: `Retainer — ${q.quotationNumber}`,
          retainerType: q.retainerType,
          // Same mode as the quotation: an inclusive quote carries its payable total, an exclusive one its taxable
          // amount (subtotal less discount) so retainer invoices add the tax once instead of taxing a total.
          monthlyAmount: q.pricesIncludeTax || typeof q.subtotal !== 'number' ? q.totalAmount : roundCurrency(q.subtotal - (q.discountAmount ?? 0), decimals),
          pricesIncludeTax: q.pricesIncludeTax === true,
          billingDay: new Date().getDate(),
          // toLocalISODate, not .toISOString().slice(0,10) — the latter is
          // the UTC calendar date, which can be a full day behind local
          // time (e.g. IST, any timezone ahead of UTC) for roughly the
          // first several hours of every local day, mismatching billingDay
          // above (already correctly local) and driving the wrong first
          // billing period once fed into createRetainer's own
          // parseLocalDateStart(startDate).
          startDate: toLocalISODate(new Date()),
          notes: q.notes ?? undefined
        })
        if (!created.success || !created.data) return created
        retainerId = (created.data as { id: string }).id
      }

      const invoiceResult = await generateInvoiceForRetainer(retainerId)
      if (!invoiceResult.success) return invoiceResult

      await db.quotation.update({ where: { id }, data: { status: 'ACCEPTED' } })
      await logAction({ userId, action: 'CONVERT_QUOTATION_TO_RETAINER', entityType: 'RetainerAgreement', entityId: retainerId, newValue: `From quotation ${q.quotationNumber}` })

      return { success: true, data: { retainerId, ...(invoiceResult.data as object) } }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to convert quotation to retainer.' } }
    }
  },

  async delete(id: string, userId: string) {
    const db = getPrisma()
    const q = await db.quotation.findUnique({ where: { id } })
    if (!q) return { success: false, error: { code: 'QT-001', message: 'Quotation not found.' } }
    if (q.status === 'ACCEPTED') return { success: false, error: { code: 'QT-003', message: 'Cannot delete an accepted quotation.' } }
    await db.quotation.delete({ where: { id } })
    await logAction({ userId, action: 'DELETE_QUOTATION', entityType: 'Quotation', entityId: id, newValue: q.quotationNumber })
    return { success: true }
  }
}
