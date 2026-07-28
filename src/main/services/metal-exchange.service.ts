import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { generateSequenceNumber } from './sequence.service'
import { roundCurrency } from './currency.service'

// Jewellery vertical (fresh-audit build, 2026-07-12). Old-gold/silver
// exchange (buyback/trade-in) — standalone record-keeping.
//
// Phase 58 §2: billing.service.ts's createInvoice now applies an unlinked
// exchange's valueGiven ATOMICALLY as part of the SAME invoice-creation
// transaction (pass `metalExchangeId` in the payload) — the old two-step
// "type the same number into globalDiscount, then separately call
// linkMetalExchangeToInvoice" process is no longer the only path and is
// error-prone (a mistyped discount, or a forgotten link call, silently
// leaves the exchange record and the actual applied discount out of sync).
// linkMetalExchangeToInvoice below is kept for any case that still needs to
// link an already-created invoice after the fact (e.g. correcting an older
// invoice), but the normal counter-sale flow should prefer the atomic path.

export async function listMetalExchanges(filters?: { customerId?: string; unlinkedOnly?: boolean }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.customerId) where.customerId = filters.customerId
    if (filters?.unlinkedOnly) where.invoiceId = null
    const exchanges = await db.metalExchange.findMany({
      where,
      include: { customer: { select: { id: true, customerName: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: exchanges }
  } catch (err) {
    return { success: false, error: { code: 'MX-001', message: err instanceof Error ? err.message : 'Could not list exchanges.' } }
  }
}

export async function createMetalExchange(payload: {
  customerId?: string
  customerName?: string
  metalType: string
  purity: string
  grossWeight: number
  deductionWeight?: number
  notes?: string
  createdById?: string
}) {
  try {
    if (payload.grossWeight <= 0) {
      return { success: false, error: { code: 'MX-002', message: 'Gross weight must be greater than zero.' } }
    }
    const deductionWeight = payload.deductionWeight ?? 0
    if (deductionWeight < 0 || deductionWeight >= payload.grossWeight) {
      return { success: false, error: { code: 'MX-003', message: 'Deduction weight must be zero or more, and less than the gross weight.' } }
    }
    if (!payload.customerId && !payload.customerName?.trim()) {
      return { success: false, error: { code: 'MX-004', message: 'A customer or a walk-in name is required.' } }
    }

    const db = getPrisma()
    const rateRow = await db.metalRate.findUnique({ where: { metalType_purity: { metalType: payload.metalType, purity: payload.purity } } })
    if (!rateRow) {
      return { success: false, error: { code: 'MX-005', message: `No rate configured for ${payload.metalType} ${payload.purity}. Set today's rate first.` } }
    }

    const netWeight = payload.grossWeight - deductionWeight
    // Real bug found live (2026-07-28 product-vertical audit): raw JS
    // multiplication with no rounding, unlike every other money computation
    // in this codebase — e.g. netWeight=8.1, ratePerGram=6410.20 gives
    // 51922.619999999995 (verified), stored and printed on exchange slips
    // exactly like that.
    const valueGiven = roundCurrency(netWeight * rateRow.ratePerGram)

    const exchange = await db.$transaction(async (tx) => {
      const exchangeNumber = await generateSequenceNumber(
        tx, 'metal_exchange_number_sequence', 'MEX', 5,
        async () => {
          const last = await tx.metalExchange.findFirst({ orderBy: { createdAt: 'desc' }, select: { exchangeNumber: true } })
          return last ? parseInt(last.exchangeNumber.replace('MEX-', ''), 10) : 0
        }
      )
      return tx.metalExchange.create({
        data: {
          exchangeNumber,
          customerId: payload.customerId ?? null,
          customerName: payload.customerName ?? null,
          metalType: payload.metalType,
          purity: payload.purity,
          grossWeight: payload.grossWeight,
          deductionWeight,
          netWeight,
          ratePerGram: rateRow.ratePerGram,
          valueGiven,
          notes: payload.notes ?? null,
          createdById: payload.createdById ?? null,
        },
        include: { customer: { select: { id: true, customerName: true, phone: true } } },
      })
    })

    await logAction({ userId: payload.createdById, action: 'METAL_EXCHANGE_CREATED', entityType: 'MetalExchange', entityId: exchange.id, newValue: { exchangeNumber: exchange.exchangeNumber, valueGiven } })
    return { success: true, data: exchange }
  } catch (err) {
    return { success: false, error: { code: 'MX-006', message: err instanceof Error ? err.message : 'Could not create exchange.' } }
  }
}

// Called once staff have applied this exchange's valueGiven as a discount on
// a real invoice — purely a record-keeping link, doesn't touch the invoice
// itself (the discount was already applied through the ordinary billing
// flow before this is called).
export async function linkMetalExchangeToInvoice(exchangeId: string, invoiceId: string) {
  try {
    const db = getPrisma()
    const existing = await db.metalExchange.findUnique({ where: { id: exchangeId } })
    if (!existing) return { success: false, error: { code: 'MX-007', message: 'Exchange not found.' } }
    if (existing.invoiceId) return { success: false, error: { code: 'MX-008', message: 'This exchange is already linked to an invoice.' } }
    // Real bug found live (2026-07-28 product-vertical audit): this used to
    // be an unconditional update, with the only "not already linked" check
    // done on a stale pre-write read — the same TOCTOU shape already fixed
    // for the atomic exchange-application path in billing.service.ts (right
    // above this function's own header comment references it). Two
    // near-simultaneous links of the same exchange to two different
    // invoices would have the later write silently overwrite the former,
    // breaking the audit trail between an invoice's applied discount and
    // the exchange record that justified it.
    const claim = await db.metalExchange.updateMany({ where: { id: exchangeId, invoiceId: null }, data: { invoiceId } })
    if (claim.count === 0) {
      return { success: false, error: { code: 'MX-008', message: 'This exchange is already linked to an invoice.' } }
    }
    const updated = await db.metalExchange.findUnique({ where: { id: exchangeId } })
    await logAction({ action: 'METAL_EXCHANGE_LINKED', entityType: 'MetalExchange', entityId: exchangeId, newValue: { invoiceId } })
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'MX-009', message: err instanceof Error ? err.message : 'Could not link exchange to invoice.' } }
  }
}

export async function deleteMetalExchange(id: string) {
  try {
    const db = getPrisma()
    const existing = await db.metalExchange.findUnique({ where: { id } })
    if (!existing) return { success: false, error: { code: 'MX-007', message: 'Exchange not found.' } }
    if (existing.invoiceId) return { success: false, error: { code: 'MX-010', message: 'Cannot delete an exchange already linked to an invoice.' } }
    await db.metalExchange.delete({ where: { id } })
    await logAction({ action: 'METAL_EXCHANGE_DELETED', entityType: 'MetalExchange', entityId: id })
    return { success: true }
  } catch (err) {
    return { success: false, error: { code: 'MX-011', message: err instanceof Error ? err.message : 'Could not delete exchange.' } }
  }
}
