import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { parseLocalDateStart } from '../utils/date.util'
import { inventoryService } from './inventory.service'
import { customerLedgerService } from './customer-ledger.service'
import { isModuleEnabled } from './industry-template.service'
import { generateInvoiceNumber, postInvoiceJournalEntry } from './billing.service'
import { generateSONumber } from './sales-order.service'
import { generateSequenceNumber } from './sequence.service'
import { calculateLineTotal, sumCurrency, roundCurrency, getCurrencyDecimals } from './currency.service'
import { ServiceError } from '../errors/service-error'
import { getLicenseState } from './license.service'
import { createRetainer, generateInvoiceForRetainer } from './retainer.service'

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
  items: Array<{
    productId?: string
    productName: string
    sku?: string
    quantity: number
    unitPrice: number
    discount?: number
    taxRate?: number
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

    const lineRows = payload.items.map(item => {
      const lineGross = roundCurrency(item.quantity * item.unitPrice, currencyDecimals)
      const discAmt = roundCurrency(lineGross * ((item.discount ?? 0) / 100), currencyDecimals)
      const { taxAmount: lineTax, lineTotal } = calculateLineTotal(item.quantity, item.unitPrice, discAmt, item.taxRate ?? 0, currencyDecimals)
      return { item, lineGross, discAmt, lineTax, lineTotal }
    })

    const subtotal = sumCurrency(lineRows.map(r => r.lineGross), currencyDecimals)
    const discountAmount = sumCurrency(lineRows.map(r => r.discAmt), currencyDecimals)
    const taxAmount = sumCurrency(lineRows.map(r => r.lineTax), currencyDecimals)
    const totalAmount = roundCurrency(subtotal - discountAmount + taxAmount, currencyDecimals)

    const computedItems = lineRows.map(({ item, lineTotal }) => ({
      ...item, discount: item.discount ?? 0, taxRate: item.taxRate ?? 0, lineTotal
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
          createdBy: userId,
          items: { create: computedItems }
        },
        include: { items: true, customer: true }
      })
    })

    await logAction({ userId, action: 'CREATE_QUOTATION', entityType: 'Quotation', entityId: quotation.id, newValue: `Quotation ${quotation.quotationNumber}` })
    return { success: true, data: quotation }
  },

  async list(params: { status?: string; customerId?: string; page?: number; limit?: number }) {
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
    const q = await db.quotation.update({
      where: { id: payload.id },
      data: { status: payload.status }
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
    // Phase 67 §9.1 — Universal Quote -> Order -> Invoice pipeline. Once a
    // Quotation has become a SalesOrder, billing must go through THAT
    // SalesOrder's own createInvoiceFromSalesOrder() (which tracks partial
    // invoicing via SalesOrderItem.invoicedQty) — going straight to Invoice
    // here instead would silently bypass that tracking and double-book the
    // same quoted items across two independent, disconnected invoices.
    if (q.salesOrder) return { success: false, error: { code: 'QT-006', message: 'Quotation already converted to a Sales Order. Invoice from the Sales Order instead.' } }

    const businessProfile = await db.businessProfile.findFirst({ select: { currencyCode: true } })
    const currencyDecimals = getCurrencyDecimals(businessProfile?.currencyCode)

    // Resolve productId for each item: use linked product or find by name; fallback to a Misc product.
    // productType is carried through so only real STANDARD products get stock deducted below.
    const resolvedItems = await Promise.all(q.items.map(async (item) => {
      if (item.productId) {
        const p = await db.product.findUnique({ where: { id: item.productId }, select: { productType: true } })
        return { ...item, resolvedProductId: item.productId, resolvedProductType: p?.productType ?? 'STANDARD' }
      }
      const byName = await db.product.findFirst({ where: { productName: item.productName, isActive: true } })
      if (byName) return { ...item, resolvedProductId: byName.id, resolvedProductType: byName.productType }
      // No matching product — get or create a system Miscellaneous product
      let misc = await db.product.findFirst({ where: { productName: '__MISC_ITEM__' } })
      if (!misc) {
        misc = await db.product.create({
          data: { productName: '__MISC_ITEM__', sellingPrice: 0, taxRate: 0, productType: 'SERVICE', unit: 'PCS', isActive: true }
        })
      }
      return { ...item, resolvedProductId: misc.id, resolvedProductType: misc.productType }
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
    const invoiceLineRows = resolvedItems.map((item) => {
      const lineGross = roundCurrency(item.quantity * item.unitPrice, currencyDecimals)
      const lineDiscountAmount = roundCurrency(lineGross * (item.discount / 100), currencyDecimals)
      const { taxAmount: lineTaxAmount, lineTotal } = calculateLineTotal(item.quantity, item.unitPrice, lineDiscountAmount, item.taxRate, currencyDecimals)
      return { item, lineGross, lineDiscountAmount, lineTaxAmount, lineTotal }
    })
    const invoiceSubtotal = sumCurrency(invoiceLineRows.map(r => r.lineGross), currencyDecimals)
    const invoiceDiscountAmount = sumCurrency(invoiceLineRows.map(r => r.lineDiscountAmount), currencyDecimals)
    const invoiceTaxAmount = sumCurrency(invoiceLineRows.map(r => r.lineTaxAmount), currencyDecimals)
    const invoiceTotalAmount = roundCurrency(invoiceSubtotal - invoiceDiscountAmount + invoiceTaxAmount, currencyDecimals)

    try {
      const invoice = await db.$transaction(async (tx) => {
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
            totalAmount: invoiceTotalAmount,
            balanceAmount: invoiceTotalAmount,
            quotationId: q.id,
            createdById: userId
          }
        })

        for (const { item, lineDiscountAmount, lineTaxAmount, lineTotal } of invoiceLineRows) {
          await tx.invoiceItem.create({
            data: {
              invoiceId: inv.id,
              productId: item.resolvedProductId,
              productName: item.productName,
              productSku: item.sku ?? null,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discountAmount: lineDiscountAmount,
              taxRate: item.taxRate,
              taxAmount: lineTaxAmount,
              lineTotal
            }
          })

          if (item.resolvedProductType === 'STANDARD') {
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
    if (!q.customerId) return { success: false, error: { code: 'QT-007', message: 'A Sales Order requires a real customer, not a walk-in name.' } }

    const customer = await db.customer.findUnique({ where: { id: q.customerId } })
    if (!customer) return { success: false, error: { code: 'CUST-001', message: 'Customer not found.' } }
    if (!customer.isActive) return { success: false, error: { code: 'CUST-004', message: 'Cannot create a Sales Order for an archived customer.' } }

    const businessProfile = await db.businessProfile.findFirst({ select: { currencyCode: true } })
    const currencyDecimals = getCurrencyDecimals(businessProfile?.currencyCode)

    const resolvedItems = await Promise.all(q.items.map(async (item) => {
      if (item.productId) {
        return { ...item, resolvedProductId: item.productId as string | null }
      }
      const byName = await db.product.findFirst({ where: { productName: item.productName, isActive: true } })
      if (byName) return { ...item, resolvedProductId: byName.id }
      let misc = await db.product.findFirst({ where: { productName: '__MISC_ITEM__' } })
      if (!misc) {
        misc = await db.product.create({
          data: { productName: '__MISC_ITEM__', sellingPrice: 0, taxRate: 0, productType: 'SERVICE', unit: 'PCS', isActive: true }
        })
      }
      return { ...item, resolvedProductId: misc.id }
    }))

    const lineRows = resolvedItems.map((item) => {
      const lineGross = roundCurrency(item.quantity * item.unitPrice, currencyDecimals)
      const lineDiscountAmount = roundCurrency(lineGross * (item.discount / 100), currencyDecimals)
      // Effective net-of-discount unit price — the SalesOrder line's own
      // total (quantity * effectiveUnitPrice, taxed) reproduces the
      // quotation line's already-agreed total with no separate discount field.
      const effectiveUnitPrice = item.quantity > 0 ? roundCurrency((lineGross - lineDiscountAmount) / item.quantity, currencyDecimals) : item.unitPrice
      const { taxAmount: lineTaxAmount, lineTotal } = calculateLineTotal(item.quantity, effectiveUnitPrice, 0, item.taxRate, currencyDecimals)
      return { item, effectiveUnitPrice, lineTaxAmount, lineTotal }
    })
    const soSubtotal = sumCurrency(lineRows.map(r => roundCurrency(r.item.quantity * r.effectiveUnitPrice, currencyDecimals)), currencyDecimals)
    const soTaxAmount = sumCurrency(lineRows.map(r => r.lineTaxAmount), currencyDecimals)
    const soTotalAmount = roundCurrency(soSubtotal + soTaxAmount, currencyDecimals)

    try {
      const salesOrder = await db.$transaction(async (tx) => {
        const soNumber = await generateSONumber(tx)

        const so = await tx.salesOrder.create({
          data: {
            soNumber,
            customerId: q.customerId!,
            status: 'DRAFT',
            subtotal: soSubtotal,
            taxAmount: soTaxAmount,
            totalAmount: soTotalAmount,
            notes: q.notes ? `Converted from quotation ${q.quotationNumber}. ${q.notes}` : `Converted from quotation ${q.quotationNumber}.`,
            quotationId: q.id,
            createdById: userId,
            items: {
              create: lineRows.map(({ item, effectiveUnitPrice, lineTaxAmount, lineTotal }) => ({
                productId: item.resolvedProductId,
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
      let retainerId: string
      const existingActive = await db.retainerAgreement.findFirst({ where: { clientId: q.customerId, status: 'ACTIVE' } })
      if (existingActive) {
        retainerId = existingActive.id
      } else {
        const created = await createRetainer({
          clientId: q.customerId,
          title: `Retainer — ${q.quotationNumber}`,
          retainerType: q.retainerType,
          monthlyAmount: q.totalAmount,
          billingDay: new Date().getDate(),
          startDate: new Date().toISOString().slice(0, 10),
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
