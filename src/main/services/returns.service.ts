import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { generateSequenceNumber } from './sequence.service'
import { ServiceError } from '../errors/service-error'
import { restoreBatchStockFIFO } from './batch.service'
import { restoreVariantStockTx } from './variant.service'
import { customerLedgerService } from './customer-ledger.service'
import { roundCurrency, sumCurrency, moneyEpsilon } from './currency.service'
import { prorateAmount } from '../../shared/utils/money'
import { getBusinessCurrencyDecimals } from './settings.service'
import { applyLocationDeltaTx } from './inventory.service'
import { explodeKitComponentsTx } from './kit.service'
import { markSerialAvailableTx } from './serial.service'
import { postReturnJournalTx } from './return-journal.util'
import { postReturnCogsJournalTx } from './cogs-journal.util'

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

// Founder decision, 2026-07-28 (pre-installer audit finding #7, previously
// an open policy question, not an engineering bug): unlike billing.service.ts's
// createInvoice, this deliberately does NOT check getLicenseState()/block on
// an expired trial. A return isn't new billable business the same way a
// fresh sale is — it corrects/services a sale that already happened, and
// this app's own stated licensing philosophy (see RELEASE_CHECKLIST.md and
// the LIC-002 message in billing.service.ts) is "existing data and services
// tied to prior sales stay accessible; only creating new revenue-generating
// documents pauses." Gating returns would leave a customer wanting a
// legitimate refund stuck for as long as the shop owner's license stays
// lapsed — a real customer-facing harm, not just an inconvenience to the
// business. Decided to keep this ungated; do not "fix" this as a bug.
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
    // Real bug found live (core-commerce audit): nothing here ever checked
    // whether the original invoice was CANCELLED — cancelInvoice() already
    // restores inventory, reverses payments, and reverses every customer-
    // ledger entry for that invoice, so filing a return against it afterward
    // (reachable directly: ReturnScreen.tsx's search box never filters out
    // cancelled invoices either) would restore inventory a SECOND time and
    // post a brand-new ledger/invoice-balance credit for a sale that was
    // already fully unwound. Matches the same "reject the action, don't
    // silently corrupt state" guard this file already has for RET-004.
    if (original.status === 'CANCELLED') {
      return { success: false, error: { code: 'RET-012', message: 'Cannot process a return against a cancelled invoice — the sale was already reversed when it was cancelled.' } }
    }

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
      const alreadyReturned = await getReturnedAwayQuantities(tx, originalInvoiceId)
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
      // Real bug found live (2026-07-28 core-commerce audit): this raw-float
      // proration bypassed the app's own Decimal-safe currency helpers
      // (currency.service.ts) that every other total computation in this
      // scope routes through specifically to avoid compounding float error
      // (e.g. qty 1 of 3 returned -> 1/3 = 0.3333333333333333, carried
      // through unrounded into taxAmount/lineTotal). Rounded to 2dp at each
      // step via roundCurrency now, matching calculateLineTotal's own
      // discipline.
      // Every original (tax-exclusive or inclusive, with or without an invoice-level discount) refunds from the
      // stored line total and stored tax, proportionally by quantity. Those already hold the line discount and the
      // line's share of any invoice-level discount, which unit price x quantity does not. The last piece of a
      // line takes exactly what is left, so a line can never refund more than it was sold for and a full return
      // refunds the sold amount to the last minor unit.
      const dp = await getBusinessCurrencyDecimals()
      const priorValues = await getReturnedAwayValues(tx, originalInvoiceId, dp)
      const returnItems = items.map(ri => {
        const orig = original.items.find(i => sameLine(i, ri.productId, ri.variantId))!
        const key = itemKey(ri.productId, ri.variantId)
        const priorQty = alreadyReturned.get(key) ?? 0
        const prior = priorValues.get(key) ?? { total: 0, tax: 0 }
        const isRest = ri.quantity >= orig.quantity - priorQty - 0.0000001
        const remTotal = roundCurrency(orig.lineTotal - prior.total, dp)
        const remTax = roundCurrency(orig.taxAmount - prior.tax, dp)
        const inclTotal = isRest ? remTotal : Math.min(remTotal, prorateAmount(orig.lineTotal, ri.quantity, orig.quantity, dp))
        const lineTax = isRest ? remTax : Math.min(remTax, prorateAmount(orig.taxAmount, ri.quantity, orig.quantity, dp))
        const taxable = roundCurrency(inclTotal - lineTax, dp)
        // Exclusive returns show the gross they reverse and the discount (line plus invoice-level share) that
        // separates it from the refunded taxable value; inclusive returns carry their entered line prices.
        const gross = roundCurrency(orig.unitPrice * ri.quantity, dp)
        return {
          productId: ri.productId,
          quantity: ri.quantity,
          unitPrice: orig.unitPrice,
          discountAmount: original.pricesIncludeTax
            ? prorateAmount(orig.discountAmount, ri.quantity, orig.quantity, dp)
            : Math.max(0, roundCurrency(gross - taxable, dp)),
          taxRate: orig.taxRate,
          taxCategory: orig.taxCategory,
          taxAmount: lineTax,
          lineTotal: -taxable, // negative, tax-exclusive like every return line
          // Carried onto the return's own InvoiceItem so the return record
          // itself stays traceable to the exact variant, matching how the
          // original sale's line was recorded.
          variantId: orig.variantId,
          variantInfo: orig.variantInfo
        }
      })

      const returnNetBeforeTax = sumCurrency(returnItems.map(i => i.lineTotal), dp) // negative
      // An inclusive return's lines carry their entered (tax-inclusive) prices, so the header's
      // tax-exclusive subtotal is the refunded taxable value itself (no separate discount to show).
      const returnSubtotal = original.pricesIncludeTax
        ? Math.abs(returnNetBeforeTax)
        : sumCurrency(returnItems.map(i => Math.abs(i.lineTotal) + i.discountAmount), dp) // gross reversed = refunded taxable + discount, so subtotal - discount + tax = total to the last unit
      const returnDiscountReversed = original.pricesIncludeTax ? 0 : sumCurrency(returnItems.map(i => i.discountAmount), dp)
      const returnTaxAmount = sumCurrency(returnItems.map(i => i.taxAmount), dp) // positive magnitude
      // The invoice's real money total MUST include tax — the customer is
      // owed back the tax they paid too, not just the pre-tax goods value.
      // The previous version used returnNetBeforeTax directly as totalAmount,
      // silently excluding tax from both the invoice total and (via
      // creditAmount below) the customer's ledger credit.
      const returnTotal = roundCurrency(returnNetBeforeTax - returnTaxAmount, dp) // negative, tax-inclusive

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
          pricesIncludeTax: original.pricesIncludeTax,
          // A return is presented the way its sale was, so it reverses the same tax head.
          gstType: original.gstType,
          buyerState: original.buyerState,
          paidAmount: 0,
          balanceAmount: returnTotal,
          paymentStatus: 'PAID',
          notes: `Return for invoice ${original.invoiceNumber}. Reason: ${reason}`,
          createdById: userId,
          items: { create: returnItems }
        }
      })

      // The whole original invoice was billed from one location (or the
      // default, if none) — recover it from any of the original sale's own
      // movements, so restoring stock here credits the same place it was
      // actually taken from instead of always defaulting. REAL BUG
      // found+fixed 2026-09-15: this restoration never touched LocationStock
      // at all before, silently drifting it from the aggregate Inventory.quantity
      // (same bug class already closed for per-variant stock by
      // restoreVariantStockTx below — see its own comment).
      const anySaleMovement = await tx.inventoryMovement.findFirst({
        where: { referenceType: 'INVOICE', referenceId: original.id, movementType: 'SALE' },
        select: { locationId: true }
      })
      const saleLocationId = anySaleMovement?.locationId ?? undefined

      // Restore inventory — one movement per returned item
      for (const ri of items) {
        const orig = original.items.find(i => sameLine(i, ri.productId, ri.variantId))!
        if (orig.product.productType === 'STANDARD' && !orig.product.isKit) {
          await tx.inventoryMovement.create({
            data: {
              productId: ri.productId,
              movementType: 'RETURN_IN',
              quantity: ri.quantity,
              referenceType: 'RETURN',
              referenceId: returnInvoice.id,
              remarks: `Return for invoice ${original.invoiceNumber}`,
              createdById: userId,
              locationId: saleLocationId ?? null
            }
          })
          await tx.inventory.upsert({
            where: { productId: ri.productId },
            create: { productId: ri.productId, quantity: ri.quantity },
            update: { quantity: { increment: ri.quantity } }
          })
          await applyLocationDeltaTx(tx, ri.productId, ri.quantity, saleLocationId)
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
          // REAL BUG found+fixed 2026-09-22: a serial-tracked item
          // (Electronics IMEI, Furniture serial number) returned through
          // this flow had its aggregate Inventory.quantity restored above
          // like any other product, but the specific ProductSerial record
          // stayed permanently 'SOLD' — cancelInvoice() already restores
          // every sold serial back to AVAILABLE (see its own
          // markSerialAvailableTx call), but this separate returns flow
          // never did the equivalent, so a returned device could never be
          // re-sold or found again through serial/IMEI search. Serials link
          // to the invoice, not InvoiceItem (see billing.service.ts's own
          // comment on soldSerials) — capped to ri.quantity, not every sold
          // serial for this invoice, since a return can be partial while
          // cancelInvoice reverses the whole sale at once.
          const returnedSerials = await tx.productSerial.findMany({
            where: { invoiceId: original.id, productId: ri.productId, status: 'SOLD' },
            take: ri.quantity
          })
          for (const serial of returnedSerials) {
            await markSerialAvailableTx(tx, serial.id)
          }
        } else if (orig.product.isKit) {
          // REAL BUG found+fixed 2026-09-15: a kit's own Inventory.quantity
          // is never decremented at sale (createInvoice explodes it into
          // per-component reduceStockTx calls instead — see that branch's
          // own comment) — crediting orig.productId here (the old behavior,
          // since isKit products also have productType 'STANDARD') created
          // phantom stock for a product whose inventory was never touched,
          // while the real component stock actually taken was never
          // restored at all. Explode by the CURRENT kit recipe (same helper
          // createInvoice itself uses) scaled to the quantity actually being
          // returned, not the original full sale quantity — partial returns
          // must only restore their own share.
          const componentLines = await explodeKitComponentsTx(tx, ri.productId, ri.quantity)
          for (const comp of componentLines) {
            await tx.inventoryMovement.create({
              data: {
                productId: comp.componentProductId,
                movementType: 'RETURN_IN',
                quantity: comp.quantity,
                referenceType: 'RETURN',
                referenceId: returnInvoice.id,
                remarks: `Return for invoice ${original.invoiceNumber} (component of kit "${orig.productName}")`,
                createdById: userId,
                locationId: saleLocationId ?? null
              }
            })
            await tx.inventory.upsert({
              where: { productId: comp.componentProductId },
              create: { productId: comp.componentProductId, quantity: comp.quantity },
              update: { quantity: { increment: comp.quantity } }
            })
            await applyLocationDeltaTx(tx, comp.componentProductId, comp.quantity, saleLocationId)
            await restoreBatchStockFIFO(tx, comp.componentProductId, comp.quantity)
          }
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
        const newBalance = roundCurrency(currentOriginal.balanceAmount - appliedToOriginal, dp)
        await tx.invoice.update({
          where: { id: original.id },
          data: {
            balanceAmount: newBalance,
            paymentStatus: newBalance <= moneyEpsilon(dp) ? 'PAID' : currentOriginal.paymentStatus
          }
        })
      }

      // Credit customer ledger if there was a customer.
      //
      // BUG FOUND 2026-07-22: this used to hand-roll the balance calculation
      // (`findFirst` "last" ledger row ordered by createdAt, minus the credit)
      // instead of using the shared customerLedgerService.addEntry() helper
      // that credit-note.service.ts and every other ledger-writing path uses.
      // That's exactly the anti-pattern credit-note.service.ts's own comment
      // warns about: (1) `orderBy: createdAt desc` with no tie-breaker can
      // pick the wrong "last" row if two entries share a millisecond
      // timestamp, and (2) using `{decrement: creditAmount}` on
      // customer.outstandingBalance (relative) instead of recomputing from a
      // fresh SUM over the whole ledger means any prior drift is preserved
      // and compounded here instead of self-correcting — and this exact
      // field is what billing.service.ts's real-money credit-limit
      // enforcement reads. addEntry() always recomputes from an aggregate
      // SUM, so it can never drift regardless of ordering/timing.
      if (original.customerId) {
        const creditAmount = Math.abs(returnTotal)
        await customerLedgerService.addEntry({
          customerId: original.customerId,
          referenceType: 'RETURN',
          referenceId: returnInvoice.id,
          debitAmount: 0,
          creditAmount,
          remarks: `Credit for return — ${returnInvoice.invoiceNumber}`
        }, tx)
      }

      await postReturnJournalTx(tx, returnInvoice)
      await postReturnCogsJournalTx(tx, returnInvoice, original.id)

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

// Phase 67 — Clothing item 4 (size/color exchange workflow). Shared by
// createReturn's own already-returned guard above AND exchange.service.ts's
// analogous guard, so the two workflows can't be combined to double-dip on
// the same original line (return it via ReturnScreen, THEN exchange the
// "same" quantity again, or vice versa). An EXCHANGE invoice's own two
// InvoiceItem rows are told apart by sign: the surrendered/old leg always
// has a negative lineTotal (mirroring a RETURN row's own convention
// exactly), the acquired/new leg a positive one — so filtering to
// lineTotal < 0 picks out only the "given back" side of an exchange,
// leaving the "taken instead" side (a different product/variant key
// entirely) uncounted here, right where it belongs.
export async function getReturnedAwayQuantities(
  tx: Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0],
  originalInvoiceId: string
): Promise<Map<string, number>> {
  const priorDocs = await tx.invoice.findMany({
    where: { invoiceType: { in: ['RETURN', 'EXCHANGE'] }, originalInvoiceId },
    include: { items: true }
  })
  const returnedAway = new Map<string, number>()
  for (const doc of priorDocs) {
    for (const it of doc.items) {
      if (it.lineTotal >= 0) continue
      const key = itemKey(it.productId, it.variantId)
      returnedAway.set(key, (returnedAway.get(key) ?? 0) + it.quantity)
    }
  }
  return returnedAway
}

// Tax-inclusive originals only: value already refunded per line (tax-inclusive total and tax part).
// A return line stores lineTotal as the negative tax-exclusive value, so inclusive = |lineTotal| + taxAmount.
async function getReturnedAwayValues(
  tx: Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0],
  originalInvoiceId: string,
  dp: number
): Promise<Map<string, { total: number; tax: number }>> {
  const priorDocs = await tx.invoice.findMany({
    where: { invoiceType: { in: ['RETURN', 'EXCHANGE'] }, originalInvoiceId },
    include: { items: true }
  })
  const out = new Map<string, { total: number; tax: number }>()
  for (const doc of priorDocs) {
    for (const it of doc.items) {
      if (it.lineTotal >= 0) continue
      const key = itemKey(it.productId, it.variantId)
      const cur = out.get(key) ?? { total: 0, tax: 0 }
      out.set(key, { total: sumCurrency([cur.total, Math.abs(it.lineTotal), it.taxAmount], dp), tax: sumCurrency([cur.tax, it.taxAmount], dp) })
    }
  }
  return out
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
