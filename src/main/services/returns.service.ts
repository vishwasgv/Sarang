import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { generateSequenceNumber } from './sequence.service'
import { ServiceError } from '../errors/service-error'
import { restoreBatchStockFIFO } from './batch.service'
import { restoreVariantStockTx } from './variant.service'

export interface ReturnItem {
  productId: string
  quantity: number
  // Real bug found 2026-07-16: without this, a product sold as two distinct
  // variants (e.g. Black-M and Red-L of the same T-shirt) on one invoice
  // was indistinguishable here — matching/already-returned tracking was
  // productId-only, so returns could match the wrong line and never
  // restored the specific variant's stock at all. Optional: absent for
  // products with no variants, exactly like InvoiceItem.variantId itself.
  variantId?: string
}

// Composite key so same-product-different-variant lines never collide —
// undefined variantId (non-variant products) still keys uniquely per product.
function itemKey(productId: string, variantId?: string | null): string {
  return `${productId}|${variantId ?? ''}`
}

// A real bug in this very fix, caught by its own unit tests: Prisma's
// InvoiceItem.variantId comes back as `null` for a non-variant line, but a
// plain-JS test/caller object with no variantId property at all reads as
// `undefined` — `null === undefined` is false, so a naive `===` comparison
// silently failed to match every non-variant return. Normalize both sides
// through this instead of comparing raw fields directly.
function sameLine(item: { productId: string; variantId?: string | null }, productId: string, variantId?: string | null): boolean {
  return item.productId === productId && (item.variantId ?? null) === (variantId ?? null)
}

export async function createReturn(
  originalInvoiceId: string,
  items: ReturnItem[],
  reason: string,
  userId?: string
): Promise<{ success: boolean; data?: { returnInvoiceId: string; invoiceNumber: string }; error?: { code: string; message: string } }> {
  try {
    const db = getPrisma()

    if (!reason?.trim()) return { success: false, error: { code: 'RET-001', message: 'Return reason is required.' } }
    if (!items?.length) return { success: false, error: { code: 'RET-002', message: 'At least one item is required for a return.' } }

    const original = await db.invoice.findUnique({
      where: { id: originalInvoiceId },
      include: { items: { include: { product: true } }, customer: true }
    })
    if (!original) return { success: false, error: { code: 'RET-003', message: 'Original invoice not found.' } }
    if (original.invoiceType === 'RETURN') return { success: false, error: { code: 'RET-004', message: 'Cannot return a return invoice.' } }

    // Fast-fail pre-checks outside the transaction (cheap, and the underlying
    // data — quantity <= 0, whether a product is on the original invoice —
    // isn't subject to a meaningful race).
    for (const ri of items) {
      if (ri.quantity <= 0) return { success: false, error: { code: 'RET-005', message: 'Return quantity must be greater than zero.' } }
      if (!original.items.find(i => sameLine(i, ri.productId, ri.variantId))) {
        return { success: false, error: { code: 'RET-006', message: `Product not found in original invoice.` } }
      }
    }

    const result = await db.$transaction(async tx => {
      // Sum quantities already returned across ALL prior return transactions
      // for this invoice, re-read fresh INSIDE the transaction (not against a
      // pre-read snapshot) — the same TOCTOU class of bug billing.service.ts's
      // credit-limit check already guards against: reading this before the
      // transaction opens would leave a window where two return submissions
      // for the same invoice, each individually valid, could together exceed
      // what was actually purchased. Uses the real originalInvoiceId FK
      // (fresh-audit fix) rather than a notes-substring match — the old
      // `notes: { contains: originalInvoiceId }` could false-match if one
      // invoice's cuid ever appeared as a substring of another's notes text.
      const priorReturns = await tx.invoice.findMany({
        where: { invoiceType: 'RETURN', originalInvoiceId },
        include: { items: true }
      })
      const alreadyReturned = new Map<string, number>()
      for (const pr of priorReturns) {
        for (const it of pr.items) {
          const key = itemKey(it.productId, it.variantId)
          alreadyReturned.set(key, (alreadyReturned.get(key) ?? 0) + it.quantity)
        }
      }
      for (const ri of items) {
        const origItem = original.items.find(i => sameLine(i, ri.productId, ri.variantId))!
        const key = itemKey(ri.productId, ri.variantId)
        const remaining = origItem.quantity - (alreadyReturned.get(key) ?? 0)
        if (ri.quantity > remaining) {
          throw new ServiceError('RET-007', `Return quantity (${ri.quantity}) exceeds remaining returnable quantity (${remaining}) for "${origItem.product.productName}${origItem.variantInfo ? ` (${origItem.variantInfo})` : ''}" — ${alreadyReturned.get(key) ?? 0} of ${origItem.quantity} already returned.`)
        }
      }

      // Generate return invoice number. Was `` `RET-${(await tx.invoice.count())+1}` ``
      // — coupled to the TOTAL invoice count (all types, not just RETURN),
      // and raced/collided the same way customerCode/supplierCode did: a
      // plain count() doesn't survive concurrent creates or any prior
      // hard-delete. Dedicated atomic sequence, scoped to RETURN invoices
      // specifically so it isn't accidentally coupled to unrelated
      // CASH/CREDIT invoice volume.
      const invoiceNumber = await generateSequenceNumber(
        tx, 'return_invoice_sequence', 'RET', 5,
        async () => {
          const rows = await tx.invoice.findMany({ where: { invoiceType: 'RETURN' }, select: { invoiceNumber: true } })
          let max = 0
          for (const row of rows) {
            const n = parseInt(row.invoiceNumber.replace('RET-', ''), 10)
            if (Number.isFinite(n) && n > max) max = n
          }
          return max
        }
      )

      // Build return line items (mirror originals for the returned products).
      // lineTotal is the net (post-discount, pre-tax) reversal — negative,
      // matching the "return reduces revenue" sign convention already used
      // for subtotal. discountAmount is tracked per item (previously hardcoded
      // to 0 even though a proportional discount was being silently subtracted
      // inside lineTotal — internally inconsistent with the standard
      // subtotal - discountAmount + taxAmount = totalAmount invariant used
      // everywhere else in the app).
      const returnItems = items.map(ri => {
        const orig = original.items.find(i => sameLine(i, ri.productId, ri.variantId))!
        const discountReversed = orig.discountAmount * (ri.quantity / orig.quantity)
        const lineTotal = -(ri.quantity * orig.unitPrice - discountReversed)
        const lineTax = lineTotal * (orig.taxRate / 100)
        return {
          productId: ri.productId,
          quantity: ri.quantity,
          unitPrice: orig.unitPrice,
          discountAmount: discountReversed,
          taxRate: orig.taxRate,
          taxAmount: Math.abs(lineTax),
          lineTotal, // negative
          // Carried onto the return's own InvoiceItem so the return record
          // itself stays traceable to the exact variant, matching how the
          // original sale's line was recorded.
          variantId: orig.variantId,
          variantInfo: orig.variantInfo
        }
      })

      const returnSubtotal = returnItems.reduce((s, i) => s + Math.abs(i.unitPrice * i.quantity), 0)
      const returnDiscountReversed = returnItems.reduce((s, i) => s + i.discountAmount, 0)
      const returnNetBeforeTax = returnItems.reduce((s, i) => s + i.lineTotal, 0) // negative
      const returnTaxAmount = returnItems.reduce((s, i) => s + i.taxAmount, 0) // positive magnitude
      // The invoice's real money total MUST include tax — the customer is
      // owed back the tax they paid too, not just the pre-tax goods value.
      // The previous version used returnNetBeforeTax directly as totalAmount,
      // silently excluding tax from both the invoice total and (via
      // creditAmount below) the customer's ledger credit.
      const returnTotal = returnNetBeforeTax - returnTaxAmount // negative, tax-inclusive

      // Create return invoice
      const returnInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          invoiceType: 'RETURN',
          customerId: original.customerId,
          originalInvoiceId: original.id,
          status: 'ACTIVE',
          subtotal: -returnSubtotal,
          discountAmount: returnDiscountReversed,
          taxAmount: returnTaxAmount,
          roundingAmount: 0,
          totalAmount: returnTotal,
          paidAmount: 0,
          balanceAmount: returnTotal,
          paymentStatus: 'PAID',
          notes: `Return for invoice ${original.invoiceNumber}. Reason: ${reason}`,
          createdById: userId,
          items: { create: returnItems }
        }
      })

      // Restore inventory — one movement per returned item
      for (const ri of items) {
        const orig = original.items.find(i => sameLine(i, ri.productId, ri.variantId))!
        if (orig.product.productType === 'STANDARD') {
          await tx.inventoryMovement.create({
            data: {
              productId: ri.productId,
              movementType: 'RETURN_IN',
              quantity: ri.quantity,
              referenceType: 'RETURN',
              referenceId: returnInvoice.id,
              remarks: `Return for invoice ${original.invoiceNumber}`,
              createdById: userId
            }
          })
          await tx.inventory.upsert({
            where: { productId: ri.productId },
            create: { productId: ri.productId, quantity: ri.quantity },
            update: { quantity: { increment: ri.quantity } }
          })
          // Real bug found 2026-07-16: the parent Inventory.quantity above
          // was always restored, but a variant-sold item's specific
          // ProductVariant.stockQty (size/colour) never was — silently
          // drifting per-variant stock low on every Clothing/Footwear
          // return. Mirrors decrementVariantStockTx's use at sale time in
          // billing.service.ts exactly, just in the increment direction.
          if (orig.variantId) {
            await restoreVariantStockTx(tx, orig.variantId, ri.quantity)
          }
          // Restore batch quantityRemaining (Pharmacy/Agri Inputs) — mirrors
          // billing.service.ts's own invoice-cancellation path; without this,
          // aggregate Inventory.quantity went back up on a return but the
          // batch-level ledger (used for expiry tracking/alerts) stayed
          // permanently understated. No-op if the product has no batches.
          await restoreBatchStockFIFO(tx, ri.productId, ri.quantity)
        }
      }

      // Reduce the ORIGINAL invoice's own balance if it still had one outstanding —
      // mirroring exactly what recording a payment against it would do. Without
      // this, generateOutstandingReport (report.service.ts) — which sums
      // invoice.balanceAmount directly rather than reading CustomerLedger —
      // kept showing the full original balance as owed even after a return
      // against it, while the Dashboard/Customer Ledger Report (which do read
      // CustomerLedger/customer.outstandingBalance, updated below) correctly
      // showed it reduced. Capped at the original balance itself: any excess
      // return value becomes a general credit via the ledger entry below, not
      // a negative invoice balance. Re-read fresh inside the transaction (not
      // the pre-transaction `original` snapshot) — same TOCTOU guard as the
      // already-returned-quantity check above; a payment could have landed on
      // this invoice between that initial read and this transaction opening.
      const returnAmountAbs = Math.abs(returnTotal)
      const currentOriginal = await tx.invoice.findUniqueOrThrow({ where: { id: original.id }, select: { balanceAmount: true, paymentStatus: true } })
      if (currentOriginal.balanceAmount > 0) {
        const appliedToOriginal = Math.min(currentOriginal.balanceAmount, returnAmountAbs)
        const newBalance = currentOriginal.balanceAmount - appliedToOriginal
        await tx.invoice.update({
          where: { id: original.id },
          data: {
            balanceAmount: newBalance,
            paymentStatus: newBalance <= 0.01 ? 'PAID' : currentOriginal.paymentStatus
          }
        })
      }

      // Credit customer ledger if there was a customer
      if (original.customerId) {
        const creditAmount = Math.abs(returnTotal)
        const last = await tx.customerLedger.findFirst({
          where: { customerId: original.customerId },
          orderBy: { createdAt: 'desc' },
          select: { balance: true }
        })
        const prevBalance = last?.balance ?? 0
        const newBalance = prevBalance - creditAmount // credit reduces outstanding

        await tx.customerLedger.create({
          data: {
            customerId: original.customerId,
            referenceType: 'RETURN',
            referenceId: returnInvoice.id,
            debitAmount: 0,
            creditAmount,
            balance: newBalance,
            remarks: `Credit for return — ${returnInvoice.invoiceNumber}`
          }
        })

        await tx.customer.update({
          where: { id: original.customerId },
          data: { outstandingBalance: { decrement: creditAmount } }
        })
      }

      return returnInvoice
    })

    await logAction(userId, 'RETURN_CREATED', 'Invoice', result.id, originalInvoiceId, result.invoiceNumber)
    return { success: true, data: { returnInvoiceId: result.id, invoiceNumber: result.invoiceNumber } }
  } catch (err) {
    if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
    return { success: false, error: { code: 'RET-099', message: err instanceof Error ? err.message : 'Could not process return.' } }
  }
}

export async function listReturns(originalInvoiceId?: string) {
  try {
    const db = getPrisma()
    const returns = await db.invoice.findMany({
      where: {
        invoiceType: 'RETURN',
        ...(originalInvoiceId ? { originalInvoiceId } : {})
      },
      include: {
        customer: { select: { customerName: true } },
        items: { include: { product: { select: { productName: true } } } }
      },
      orderBy: { createdAt: 'desc' }
    })
    return { success: true, data: returns }
  } catch (err) {
    return { success: false, error: { code: 'RET-010', message: err instanceof Error ? err.message : 'Could not list returns.' } }
  }
}

// Retail's dashboard widget deliverable (spec §9.3) — a lightweight,
// DB-side aggregate rather than fetching the full (unbounded, growing)
// returns list to the renderer just to count today's rows client-side.
export async function getTodayReturnsSummary() {
  try {
    const db = getPrisma()
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    const dayEnd = new Date()
    dayEnd.setHours(23, 59, 59, 999)

    const returns = await db.invoice.findMany({
      where: { invoiceType: 'RETURN', createdAt: { gte: dayStart, lte: dayEnd } },
      select: { totalAmount: true }
    })

    return {
      success: true,
      data: {
        count: returns.length,
        totalRefunded: returns.reduce((s, r) => s + Math.abs(r.totalAmount), 0)
      }
    }
  } catch (err) {
    return { success: false, error: { code: 'RET-011', message: err instanceof Error ? err.message : 'Could not load today\'s returns summary.' } }
  }
}
