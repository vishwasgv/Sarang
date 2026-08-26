import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { generateSequenceNumber } from './sequence.service'
import { roundCurrency } from './currency.service'

// Phase 67 §9.1 — Jewellery item 1: Gold savings scheme (chit) ledger, "the
// single most-requested feature in Indian jewellery retail" per the source
// audit. A customer pays a fixed amount monthly for a set tenure; at
// redemption the accumulated total (plus an optional scheme bonus) is
// applied toward a purchase. Deliberately mirrors MetalExchange's own
// original standalone-record design (see that model's own schema comment):
// NOT wired atomically into billing.service.ts's invoice creation — that
// function is the single most money-critical, most-tested path in this
// codebase, and this is a brand-new redemption concept, not a proven one.
// Staff apply the redeemed amount as an ordinary invoice-level discount
// through the already-existing, already-tested globalDiscount mechanism,
// then call linkGoldSavingsSchemeToInvoice to record which sale it went to.

const customerSelect = { id: true, customerName: true, phone: true } as const

export async function listGoldSavingsSchemes(filters?: { customerId?: string; status?: string }) {
  try {
    const db = getPrisma()
    const where: Record<string, unknown> = {}
    if (filters?.customerId) where.customerId = filters.customerId
    if (filters?.status) where.status = filters.status
    const schemes = await db.goldSavingsScheme.findMany({
      where,
      include: { customer: { select: customerSelect }, installments: { orderBy: { paidAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, data: schemes }
  } catch (err) {
    return { success: false, error: { code: 'GSS-001', message: err instanceof Error ? err.message : 'Could not list gold savings schemes.' } }
  }
}

export async function createGoldSavingsScheme(payload: {
  customerId: string
  metalType: string
  monthlyAmount: number
  tenureMonths: number
  startDate: string
  notes?: string
  createdById?: string
}) {
  try {
    if (payload.monthlyAmount <= 0) return { success: false, error: { code: 'GSS-002', message: 'Monthly amount must be greater than zero.' } }
    if (!Number.isInteger(payload.tenureMonths) || payload.tenureMonths <= 0) return { success: false, error: { code: 'GSS-003', message: 'Tenure must be a whole number of months, greater than zero.' } }
    const db = getPrisma()
    const customer = await db.customer.findUnique({ where: { id: payload.customerId } })
    if (!customer) return { success: false, error: { code: 'GSS-004', message: 'Customer not found.' } }

    const scheme = await db.$transaction(async (tx) => {
      const schemeNumber = await generateSequenceNumber(
        tx, 'gold_savings_scheme_number_sequence', 'GSS', 5,
        async () => {
          const last = await tx.goldSavingsScheme.findFirst({ orderBy: { createdAt: 'desc' }, select: { schemeNumber: true } })
          return last ? parseInt(last.schemeNumber.replace('GSS-', ''), 10) : 0
        }
      )
      return tx.goldSavingsScheme.create({
        data: {
          schemeNumber,
          customerId: payload.customerId,
          metalType: payload.metalType,
          monthlyAmount: payload.monthlyAmount,
          tenureMonths: payload.tenureMonths,
          startDate: new Date(payload.startDate),
          notes: payload.notes?.trim() || null,
          createdById: payload.createdById ?? null,
        },
        include: { customer: { select: customerSelect }, installments: true },
      })
    })

    await logAction({ userId: payload.createdById, action: 'GOLD_SAVINGS_SCHEME_CREATED', entityType: 'GoldSavingsScheme', entityId: scheme.id, newValue: { schemeNumber: scheme.schemeNumber } })
    return { success: true, data: scheme }
  } catch (err) {
    return { success: false, error: { code: 'GSS-005', message: err instanceof Error ? err.message : 'Could not create gold savings scheme.' } }
  }
}

export async function recordInstallment(payload: { schemeId: string; amount: number; paymentMethod?: string; notes?: string; createdById?: string }) {
  try {
    if (payload.amount <= 0) return { success: false, error: { code: 'GSS-006', message: 'Installment amount must be greater than zero.' } }
    const db = getPrisma()
    const scheme = await db.goldSavingsScheme.findUnique({ where: { id: payload.schemeId } })
    if (!scheme) return { success: false, error: { code: 'GSS-007', message: 'Scheme not found.' } }
    if (scheme.status !== 'ACTIVE') return { success: false, error: { code: 'GSS-008', message: `Cannot record an installment against a ${scheme.status.toLowerCase()} scheme.` } }

    const [installment] = await db.$transaction([
      db.goldSavingsInstallment.create({
        data: {
          schemeId: payload.schemeId,
          amount: payload.amount,
          paymentMethod: payload.paymentMethod ?? null,
          notes: payload.notes?.trim() || null,
          createdById: payload.createdById ?? null,
        },
      }),
      db.goldSavingsScheme.update({
        where: { id: payload.schemeId },
        data: { totalDeposited: { increment: payload.amount } },
      }),
    ])

    await logAction({ userId: payload.createdById, action: 'GOLD_SAVINGS_INSTALLMENT_RECORDED', entityType: 'GoldSavingsScheme', entityId: payload.schemeId, newValue: { amount: payload.amount } })
    return { success: true, data: installment }
  } catch (err) {
    return { success: false, error: { code: 'GSS-009', message: err instanceof Error ? err.message : 'Could not record installment.' } }
  }
}

export async function redeemGoldSavingsScheme(payload: { schemeId: string; bonusAmount?: number; userId?: string }) {
  try {
    const bonusAmount = payload.bonusAmount ?? 0
    if (bonusAmount < 0) return { success: false, error: { code: 'GSS-010', message: 'Bonus amount cannot be negative.' } }
    const db = getPrisma()
    const scheme = await db.goldSavingsScheme.findUnique({ where: { id: payload.schemeId } })
    if (!scheme) return { success: false, error: { code: 'GSS-007', message: 'Scheme not found.' } }
    if (scheme.status !== 'ACTIVE') return { success: false, error: { code: 'GSS-011', message: `This scheme is already ${scheme.status.toLowerCase()}.` } }

    const redeemedAmount = roundCurrency(scheme.totalDeposited + bonusAmount)
    // Atomically claim the ACTIVE->REDEEMED transition — same "conditional
    // update, not a plain unconditional one" shape checkoutBooking/
    // returnBooking already established for rental, so two near-simultaneous
    // redemptions of the same scheme can't both succeed.
    const claim = await db.goldSavingsScheme.updateMany({
      where: { id: payload.schemeId, status: 'ACTIVE' },
      data: { status: 'REDEEMED', bonusAmount, redeemedAmount, redeemedAt: new Date() },
    })
    if (claim.count === 0) {
      return { success: false, error: { code: 'GSS-011', message: 'This scheme was already redeemed by another action.' } }
    }

    await logAction({ userId: payload.userId, action: 'GOLD_SAVINGS_SCHEME_REDEEMED', entityType: 'GoldSavingsScheme', entityId: payload.schemeId, newValue: { redeemedAmount } })
    const updated = await db.goldSavingsScheme.findUnique({ where: { id: payload.schemeId }, include: { customer: { select: customerSelect }, installments: true } })
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'GSS-012', message: err instanceof Error ? err.message : 'Could not redeem scheme.' } }
  }
}

// Called once staff have applied this scheme's redeemedAmount as a discount
// on a real invoice — purely a record-keeping link, matches
// linkMetalExchangeToInvoice's own exact shape.
export async function linkGoldSavingsSchemeToInvoice(schemeId: string, invoiceId: string) {
  try {
    const db = getPrisma()
    const existing = await db.goldSavingsScheme.findUnique({ where: { id: schemeId } })
    if (!existing) return { success: false, error: { code: 'GSS-007', message: 'Scheme not found.' } }
    if (existing.status !== 'REDEEMED') return { success: false, error: { code: 'GSS-013', message: 'Redeem the scheme before linking it to an invoice.' } }
    if (existing.invoiceId) return { success: false, error: { code: 'GSS-014', message: 'This scheme is already linked to an invoice.' } }
    const claim = await db.goldSavingsScheme.updateMany({ where: { id: schemeId, invoiceId: null }, data: { invoiceId } })
    if (claim.count === 0) {
      return { success: false, error: { code: 'GSS-014', message: 'This scheme is already linked to an invoice.' } }
    }
    const updated = await db.goldSavingsScheme.findUnique({ where: { id: schemeId } })
    await logAction({ action: 'GOLD_SAVINGS_SCHEME_LINKED', entityType: 'GoldSavingsScheme', entityId: schemeId, newValue: { invoiceId } })
    return { success: true, data: updated }
  } catch (err) {
    return { success: false, error: { code: 'GSS-015', message: err instanceof Error ? err.message : 'Could not link scheme to invoice.' } }
  }
}

export const goldSavingsService = {
  listGoldSavingsSchemes,
  createGoldSavingsScheme,
  recordInstallment,
  redeemGoldSavingsScheme,
  linkGoldSavingsSchemeToInvoice,
}
