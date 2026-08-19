import { getPrisma } from '../database/db'
import { logAction } from './audit.service'
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

      const [, updatedCard] = await db.$transaction([
        db.loyaltyRedemption.create({
          data: {
            loyaltyCardId: card.id,
            punchesUsed: program.punchesRequired,
            rewardDescription: program.rewardDescription,
            redeemedById: userId ?? null
          }
        }),
        // Subtract exactly what was required rather than resetting to 0 — a
        // customer with surplus punches beyond the threshold keeps them
        // toward their next reward instead of losing them.
        db.loyaltyCard.update({
          where: { id: card.id },
          data: { currentPunches: { decrement: program.punchesRequired }, totalRewardsRedeemed: { increment: 1 } }
        })
      ])

      await logAction({ userId, action: 'LOYALTY_REWARD_REDEEMED', entityType: 'LoyaltyCard', entityId: card.id, newValue: { rewardDescription: program.rewardDescription, punchesUsed: program.punchesRequired } })
      return { success: true, data: updatedCard }
    } catch (err) {
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
  }
}
