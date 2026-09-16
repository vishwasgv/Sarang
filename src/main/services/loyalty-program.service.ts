import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
import { ServiceError } from '../errors/service-error'
import type { UpsertLoyaltyProgramPayload } from '../validation/loyalty-program.validation'

type TxClient = Parameters<Parameters<ReturnType<typeof getPrisma>['$transaction']>[0]>[0]

// Phase 67 §9.1 — Retail: simple visit-based loyalty punch-card. Deliberately
// Retail-specific (not a generic multi-vertical loyalty engine) — see the
// schema's own comment. A single active program is configured once;
// recordPunchTx() is called from inside billing.service.ts's createInvoice
// transaction so a punch is earned automatically at sale time, no separate
// staff action required for the common case. Redeeming a reward is the one
// deliberate manual step (a cashier decision, not automatic).
export const loyaltyProgramService = {
  async getProgram() {
    try {
      const db = getPrisma()
      const program = await db.loyaltyProgram.findFirst()
      return { success: true, data: program }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to load loyalty program.' } }
    }
  },

  async upsertProgram(payload: UpsertLoyaltyProgramPayload, userId?: string) {
    try {
      const db = getPrisma()
      const existing = await db.loyaltyProgram.findFirst()
      const data = {
        isActive: payload.isActive ?? true,
        punchesRequired: payload.punchesRequired,
        rewardDescription: payload.rewardDescription,
        minPurchaseAmount: payload.minPurchaseAmount ?? 0
      }
      const program = existing
        ? await db.loyaltyProgram.update({ where: { id: existing.id }, data })
        : await db.loyaltyProgram.create({ data })

      await logAction({ userId, action: existing ? 'LOYALTY_PROGRAM_UPDATED' : 'LOYALTY_PROGRAM_CREATED', entityType: 'LoyaltyProgram', entityId: program.id, newValue: data })
      return { success: true, data: program }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to save loyalty program.' } }
    }
  },

  async listCards(filters?: { readyForRewardOnly?: boolean }) {
    try {
      const db = getPrisma()
      const program = await db.loyaltyProgram.findFirst()
      const cards = await db.loyaltyCard.findMany({
        include: { customer: { select: { id: true, customerName: true, phone: true } } },
        orderBy: { currentPunches: 'desc' }
      })
      const punchesRequired = program?.punchesRequired ?? 10
      const rows = cards
        .map(c => ({ ...c, readyForReward: c.currentPunches >= punchesRequired }))
        .filter(c => !filters?.readyForRewardOnly || c.readyForReward)
      return { success: true, data: { punchesRequired, rows } }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to list loyalty cards.' } }
    }
  },

  async redeemReward(customerId: string, userId?: string) {
    try {
      const db = getPrisma()
      const program = await db.loyaltyProgram.findFirst()
      if (!program) return { success: false, error: { code: 'LTY-001', message: 'No loyalty program is configured yet.' } }
      if (!program.isActive) return { success: false, error: { code: 'LTY-002', message: 'The loyalty program is currently turned off.' } }

      const card = await db.loyaltyCard.findUnique({ where: { customerId } })
      if (!card || card.currentPunches < program.punchesRequired) {
        return { success: false, error: { code: 'LTY-003', message: `This customer has ${card?.currentPunches ?? 0} of ${program.punchesRequired} punches needed.` } }
      }

      // Real race found in the zero-logical-errors audit: the eligibility
      // gate above was only checked against this stale pre-transaction read
      // — the array-form $transaction below couldn't branch on a fresh
      // re-check, so two concurrent redemptions for a customer sitting at
      // exactly punchesRequired (double-click, two staff terminals) both
      // passed the guard and both executed, giving away two rewards for one
      // customer's punches and driving currentPunches negative. Switched to
      // a callback-form transaction with an atomic conditional claim —
      // exactly one concurrent call can win.
      const updatedCard = await db.$transaction(async (tx) => {
        const claim = await tx.loyaltyCard.updateMany({
          where: { id: card.id, currentPunches: { gte: program.punchesRequired } },
          // Subtract exactly what was required rather than resetting to 0 — a
          // customer with surplus punches beyond the threshold keeps them
          // toward their next reward instead of losing them.
          data: { currentPunches: { decrement: program.punchesRequired }, totalRewardsRedeemed: { increment: 1 } }
        })
        if (claim.count === 0) {
          throw new ServiceError('LTY-003', `This customer has ${card.currentPunches} of ${program.punchesRequired} punches needed.`)
        }
        await tx.loyaltyRedemption.create({
          data: {
            loyaltyCardId: card.id,
            punchesUsed: program.punchesRequired,
            rewardDescription: program.rewardDescription,
            redeemedById: userId ?? null
          }
        })
        return tx.loyaltyCard.findUnique({ where: { id: card.id } })
      })

      await logAction({ userId, action: 'LOYALTY_REWARD_REDEEMED', entityType: 'LoyaltyCard', entityId: card.id, newValue: { rewardDescription: program.rewardDescription, punchesUsed: program.punchesRequired } })
      return { success: true, data: updatedCard }
    } catch (err) {
      if (err instanceof ServiceError) return { success: false, error: { code: err.code, message: err.message } }
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to redeem reward.' } }
    }
  },

  // Ask Sarang AI's retail.loyaltyProgress intent (Section 1.2 — every new
  // capture mechanism gets a matching AI query pattern).
  async getSummary(): Promise<
    | { success: true; data: { configured: false } }
    | { success: true; data: { configured: true; isActive: boolean; totalCards: number; readyForRewardCount: number; rewardsRedeemedThisMonth: number } }
    | { success: false; error: { code: string; message: string } }
  > {
    try {
      const db = getPrisma()
      const program = await db.loyaltyProgram.findFirst()
      if (!program) return { success: true, data: { configured: false } }

      const cards = await db.loyaltyCard.findMany()
      const readyForRewardCount = cards.filter(c => c.currentPunches >= program.punchesRequired).length

      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
      const rewardsRedeemedThisMonth = await db.loyaltyRedemption.count({ where: { redeemedAt: { gte: monthStart } } })

      return {
        success: true,
        data: { configured: true, isActive: program.isActive, totalCards: cards.length, readyForRewardCount, rewardsRedeemedThisMonth }
      }
    } catch (err) {
      return { success: false, error: { code: 'SYS-001', message: err instanceof Error ? err.message : 'Failed to load loyalty summary.' } }
    }
  },

  // Called from billing.service.ts's createInvoice, INSIDE its own open
  // transaction — never opens a transaction of its own (see the Phase 62
  // "nested transaction self-deadlock" lesson). Never throws: a loyalty
  // punch failing must never block the sale itself from completing.
  async recordPunchTx(tx: TxClient, customerId: string, invoiceId: string, totalAmount: number) {
    try {
      const program = await tx.loyaltyProgram.findFirst()
      if (!program || !program.isActive) return
      if (totalAmount < program.minPurchaseAmount) return

      const card = await tx.loyaltyCard.upsert({
        where: { customerId },
        create: { customerId, currentPunches: 1, totalPunchesEarned: 1, lastPunchAt: new Date() },
        update: { currentPunches: { increment: 1 }, totalPunchesEarned: { increment: 1 }, lastPunchAt: new Date() }
      })
      await tx.loyaltyPunchEvent.create({ data: { loyaltyCardId: card.id, invoiceId } })
    } catch {
      // A punch is a bonus, never a blocker — the sale itself must never fail because of this.
    }
  },

  // Called from billing.service.ts's cancelInvoice, INSIDE its own open
  // transaction — mirrors recordPunchTx's own "never opens its own
  // transaction" rule. Real gap found+fixed in the zero-logical-errors
  // audit: recordPunchTx had no reversal counterpart at all — cancelling a
  // sale that earned a punch left it on the customer's card forever, and if
  // it was the punch that crossed punchesRequired, the customer became
  // eligible to redeem a real reward for a sale that no longer exists in
  // the books. Never throws — same "a punch is a bonus, never a blocker"
  // invariant applies to reversing one; invoice cancellation must never
  // fail because of a loyalty-side correction.
  async reversePunchTx(tx: TxClient, invoiceId: string) {
    try {
      const events = await tx.loyaltyPunchEvent.findMany({ where: { invoiceId } })
      for (const event of events) {
        const card = await tx.loyaltyCard.findUnique({ where: { id: event.loyaltyCardId } })
        if (card) {
          await tx.loyaltyCard.update({
            where: { id: card.id },
            data: {
              currentPunches: Math.max(0, card.currentPunches - 1),
              totalPunchesEarned: Math.max(0, card.totalPunchesEarned - 1)
            }
          })
        }
        await tx.loyaltyPunchEvent.delete({ where: { id: event.id } })
      }
    } catch {
      // Same invariant as recordPunchTx — never blocks the cancellation itself.
    }
  }
}
