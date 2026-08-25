import { getPrisma } from '../database/db'
import { createReturn } from './returns.service'
import { billingService } from './billing.service'
import { roundCurrency } from './currency.service'

// Phase 67 §9.1 — Clothing item 4: size/color exchange workflow, distinct
// from the generic Return workflow (returns.service.ts) a cashier would
// otherwise have to chain manually. Orchestrates two ALREADY-correct,
// separately-proven primitives — a real invoiceType='RETURN' invoice for
// the surrendered item, then a real invoiceType='RETAIL' sale for the
// replacement — as one cashier-facing action, rather than inventing a
// single combined document. See Invoice.exchangeReturnId's own schema
// comment for why a single mixed-sign document was deliberately rejected.
export interface CreateExchangePayload {
  originalInvoiceId: string
  oldProductId: string
  oldVariantId: string
  quantity: number
  newVariantId: string
  reason: string
  // Same enum billing.service.ts's own CreateInvoiceSchema uses — the
  // cashier picks how any balance (or a shortfall in the other direction)
  // actually gets settled, exactly like any ordinary sale.
  paymentMethod: 'CASH' | 'UPI' | 'CARD' | 'WALLET' | 'CREDIT' | 'SPLIT'
}

export async function createExchange(
  payload: CreateExchangePayload,
  userId?: string
): Promise<{
  success: boolean
  data?: { returnInvoiceId: string; returnInvoiceNumber: string; newInvoiceId: string; newInvoiceNumber: string; netAmountDue: number }
  error?: { code: string; message: string }
}> {
  try {
    const db = getPrisma()

    if (!payload.reason?.trim()) return { success: false, error: { code: 'EXC-001', message: 'Exchange reason is required.' } }
    if (!payload.quantity || payload.quantity <= 0) return { success: false, error: { code: 'EXC-002', message: 'Exchange quantity must be greater than zero.' } }
    if (!payload.oldVariantId || !payload.newVariantId) return { success: false, error: { code: 'EXC-003', message: 'Both the original and replacement variant are required.' } }
    if (payload.oldVariantId === payload.newVariantId) return { success: false, error: { code: 'EXC-004', message: 'Replacement variant must be different from the original.' } }

    // Cheap up-front check so the common "we don't have that size" case
    // fails BEFORE the return leg runs, rather than leaving a customer with
    // a completed return but no replacement in hand. decrementVariantStockTx
    // (inside createInvoice below) is still the real, race-safe guard —
    // this is a courtesy pre-check only.
    const newVariant = await db.productVariant.findUnique({ where: { id: payload.newVariantId }, include: { product: true } })
    if (!newVariant || !newVariant.isActive) return { success: false, error: { code: 'EXC-005', message: 'Replacement variant not found or inactive.' } }
    if (newVariant.stockQty < payload.quantity) {
      return { success: false, error: { code: 'EXC-006', message: `Replacement variant is out of stock. Available: ${newVariant.stockQty}, required: ${payload.quantity}.` } }
    }

    const original = await db.invoice.findUnique({ where: { id: payload.originalInvoiceId }, include: { customer: true } })
    if (!original) return { success: false, error: { code: 'EXC-007', message: 'Original invoice not found.' } }

    // Leg 1 — surrender the old item. Reuses createReturn() wholesale so its
    // own already-returned/-exchanged guard (getReturnedAwayQuantities),
    // inventory restore, and customer-ledger credit all apply exactly as
    // they would for a plain return — zero duplicated logic, zero risk of
    // drifting from that workflow's own correctness fixes over time.
    const returnRes = await createReturn(
      payload.originalInvoiceId,
      [{ productId: payload.oldProductId, quantity: payload.quantity, variantId: payload.oldVariantId }],
      `Exchange (for ${[newVariant.size, newVariant.color].filter(Boolean).join(' / ') || 'a different variant'}): ${payload.reason.trim()}`,
      userId
    )
    if (!returnRes.success || !returnRes.data) {
      return { success: false, error: returnRes.error ?? { code: 'EXC-008', message: 'Could not process the return leg of this exchange.' } }
    }
    const returnInvoice = await db.invoice.findUniqueOrThrow({ where: { id: returnRes.data.returnInvoiceId }, select: { totalAmount: true } })

    // Leg 2 — sell the replacement item, at its own real current price (not
    // the old item's price) and its own real tax rate. Deliberately does
    // NOT try to re-derive the original line's discount rate onto this new
    // line — that's a real product-policy call (a manager could reasonably
    // decide either way), left to whatever discount/scheme mechanism the
    // cashier applies to this sale like any other, not silently assumed here.
    const variantInfo = [newVariant.size, newVariant.color].filter(Boolean).join(' / ') || undefined
    const newUnitPrice = roundCurrency(newVariant.product.sellingPrice + newVariant.additionalPrice)
    const saleRes = await billingService.createInvoice({
      customerId: original.customerId ?? undefined,
      paymentMethod: payload.paymentMethod,
      items: [{
        productId: newVariant.productId,
        quantity: payload.quantity,
        unitPrice: newUnitPrice,
        discountAmount: 0,
        taxRate: newVariant.product.taxRate,
        variantId: newVariant.id,
        variantInfo,
        isFreeOfCost: false
      }],
      globalDiscount: 0,
      notes: `Exchange for invoice ${original.invoiceNumber} (return ${returnRes.data.invoiceNumber}). Reason: ${payload.reason.trim()}`
    }, userId)

    if (!saleRes.success || !saleRes.data) {
      // The return already committed (see the courtesy pre-check above for
      // why this should be rare) — surface both facts rather than a bare
      // sale-side error, so the cashier isn't left thinking nothing happened.
      return {
        success: false,
        error: {
          code: 'EXC-009',
          message: `The return (${returnRes.data.invoiceNumber}) was processed, but the replacement item could not be sold: ${saleRes.error?.message ?? 'unknown error'}. The customer's return credit is on their account — issue the replacement separately once resolved.`
        }
      }
    }

    await db.invoice.update({ where: { id: saleRes.data.id }, data: { exchangeReturnId: returnRes.data.returnInvoiceId } })

    const netAmountDue = roundCurrency(saleRes.data.totalAmount - Math.abs(returnInvoice.totalAmount))

    return {
      success: true,
      data: {
        returnInvoiceId: returnRes.data.returnInvoiceId,
        returnInvoiceNumber: returnRes.data.invoiceNumber,
        newInvoiceId: saleRes.data.id,
        newInvoiceNumber: saleRes.data.invoiceNumber,
        netAmountDue
      }
    }
  } catch (err) {
    return { success: false, error: { code: 'EXC-099', message: err instanceof Error ? err.message : 'Could not process exchange.' } }
  }
}
