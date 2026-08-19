import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import { loyaltyProgramService } from '../loyalty-program.service'

function makeProgram(overrides: Record<string, unknown> = {}) {
  return { id: 'program-1', isActive: true, punchesRequired: 5, rewardDescription: 'Free coffee', minPurchaseAmount: 0, ...overrides }
}

function makeCard(overrides: Record<string, unknown> = {}) {
  return {
    id: 'card-1', customerId: 'cust-1', currentPunches: 2, totalPunchesEarned: 2, totalRewardsRedeemed: 0,
    customer: { id: 'cust-1', customerName: 'Jane Doe', phone: '9999999999' },
    ...overrides
  }
}

function makeDb(overrides: Record<string, unknown> = {}) {
  const db = {
    loyaltyProgram: { findFirst: vi.fn().mockResolvedValue(makeProgram()), create: vi.fn().mockResolvedValue(makeProgram()), update: vi.fn().mockResolvedValue(makeProgram()) },
    loyaltyCard: { findUnique: vi.fn().mockResolvedValue(makeCard()), findMany: vi.fn().mockResolvedValue([makeCard()]), upsert: vi.fn().mockResolvedValue(makeCard()), update: vi.fn().mockResolvedValue(makeCard()) },
    loyaltyPunchEvent: { create: vi.fn().mockResolvedValue({}) },
    loyaltyRedemption: { create: vi.fn().mockResolvedValue({}), count: vi.fn().mockResolvedValue(0) },
    $transaction: vi.fn((ops: unknown) => Promise.all(ops as Promise<unknown>[])),
    ...overrides
  } as Record<string, any>
  return db
}

beforeEach(() => vi.clearAllMocks())

describe('loyaltyProgramService.upsertProgram', () => {
  it('creates a new program when none exists', async () => {
    const db = makeDb({ loyaltyProgram: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue(makeProgram()), update: vi.fn() } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await loyaltyProgramService.upsertProgram({ punchesRequired: 5, rewardDescription: 'Free coffee' } as never)

    expect(res.success).toBe(true)
    expect(db.loyaltyProgram.create).toHaveBeenCalled()
    expect(db.loyaltyProgram.update).not.toHaveBeenCalled()
  })

  it('updates the existing program rather than creating a second one', async () => {
    const db = makeDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await loyaltyProgramService.upsertProgram({ punchesRequired: 8, rewardDescription: 'Free tea' } as never)

    expect(db.loyaltyProgram.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'program-1' }, data: expect.objectContaining({ punchesRequired: 8, rewardDescription: 'Free tea' })
    }))
    expect(db.loyaltyProgram.create).not.toHaveBeenCalled()
  })
})

describe('loyaltyProgramService.listCards', () => {
  it('marks a card ready for reward once currentPunches reaches punchesRequired', async () => {
    const db = makeDb({ loyaltyCard: { findMany: vi.fn().mockResolvedValue([makeCard({ currentPunches: 5 })]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await loyaltyProgramService.listCards()

    expect(res.success).toBe(true)
    expect((res as { data: { rows: { readyForReward: boolean }[] } }).data.rows[0].readyForReward).toBe(true)
  })

  it('does not mark a card ready when below the threshold', async () => {
    const db = makeDb({ loyaltyCard: { findMany: vi.fn().mockResolvedValue([makeCard({ currentPunches: 2 })]) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await loyaltyProgramService.listCards()

    expect((res as { data: { rows: { readyForReward: boolean }[] } }).data.rows[0].readyForReward).toBe(false)
  })

  it('filters to only ready-for-reward cards when requested', async () => {
    const db = makeDb({
      loyaltyCard: { findMany: vi.fn().mockResolvedValue([makeCard({ id: 'card-ready', currentPunches: 5 }), makeCard({ id: 'card-not-ready', currentPunches: 1 })]) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await loyaltyProgramService.listCards({ readyForRewardOnly: true })

    const rows = (res as { data: { rows: { id: string }[] } }).data.rows
    expect(rows).toHaveLength(1)
    expect(rows[0].id).toBe('card-ready')
  })
})

describe('loyaltyProgramService.redeemReward', () => {
  it('rejects when no program is configured', async () => {
    const db = makeDb({ loyaltyProgram: { findFirst: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await loyaltyProgramService.redeemReward('cust-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('LTY-001')
  })

  it('rejects when the program is turned off', async () => {
    const db = makeDb({ loyaltyProgram: { findFirst: vi.fn().mockResolvedValue(makeProgram({ isActive: false })) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await loyaltyProgramService.redeemReward('cust-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('LTY-002')
  })

  it('rejects when the customer has fewer punches than required', async () => {
    const db = makeDb({ loyaltyCard: { findUnique: vi.fn().mockResolvedValue(makeCard({ currentPunches: 3 })) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await loyaltyProgramService.redeemReward('cust-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('LTY-003')
  })

  it('subtracts exactly punchesRequired rather than resetting to 0, preserving surplus punches', async () => {
    const db = makeDb({ loyaltyCard: { findUnique: vi.fn().mockResolvedValue(makeCard({ currentPunches: 7 })), update: vi.fn().mockResolvedValue({}) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await loyaltyProgramService.redeemReward('cust-1')

    expect(db.loyaltyCard.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'card-1' }, data: expect.objectContaining({ currentPunches: { decrement: 5 }, totalRewardsRedeemed: { increment: 1 } })
    }))
    expect(db.loyaltyRedemption.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ loyaltyCardId: 'card-1', punchesUsed: 5, rewardDescription: 'Free coffee' })
    }))
  })
})

describe('loyaltyProgramService.recordPunchTx', () => {
  it('does nothing when no program is configured', async () => {
    const db = makeDb({ loyaltyProgram: { findFirst: vi.fn().mockResolvedValue(null) } })

    await loyaltyProgramService.recordPunchTx(db as never, 'cust-1', 'inv-1', 500)

    expect(db.loyaltyCard.upsert).not.toHaveBeenCalled()
  })

  it('does nothing when the program is turned off', async () => {
    const db = makeDb({ loyaltyProgram: { findFirst: vi.fn().mockResolvedValue(makeProgram({ isActive: false })) } })

    await loyaltyProgramService.recordPunchTx(db as never, 'cust-1', 'inv-1', 500)

    expect(db.loyaltyCard.upsert).not.toHaveBeenCalled()
  })

  it('does nothing when the invoice total is below minPurchaseAmount', async () => {
    const db = makeDb({ loyaltyProgram: { findFirst: vi.fn().mockResolvedValue(makeProgram({ minPurchaseAmount: 200 })) } })

    await loyaltyProgramService.recordPunchTx(db as never, 'cust-1', 'inv-1', 100)

    expect(db.loyaltyCard.upsert).not.toHaveBeenCalled()
  })

  it('creates/increments the card and records a punch event when qualifying', async () => {
    const db = makeDb()

    await loyaltyProgramService.recordPunchTx(db as never, 'cust-1', 'inv-1', 500)

    expect(db.loyaltyCard.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { customerId: 'cust-1' },
      create: expect.objectContaining({ customerId: 'cust-1', currentPunches: 1, totalPunchesEarned: 1 }),
      update: expect.objectContaining({ currentPunches: { increment: 1 }, totalPunchesEarned: { increment: 1 } })
    }))
    expect(db.loyaltyPunchEvent.create).toHaveBeenCalledWith({ data: { loyaltyCardId: 'card-1', invoiceId: 'inv-1' } })
  })

  it('never throws even if the DB call fails — a punch is a bonus, never a blocker', async () => {
    const db = makeDb({ loyaltyCard: { upsert: vi.fn().mockRejectedValue(new Error('db down')) } })

    await expect(loyaltyProgramService.recordPunchTx(db as never, 'cust-1', 'inv-1', 500)).resolves.toBeUndefined()
  })
})

describe('loyaltyProgramService.getSummary', () => {
  it('reports not configured when no program exists', async () => {
    const db = makeDb({ loyaltyProgram: { findFirst: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await loyaltyProgramService.getSummary()

    expect(res).toEqual({ success: true, data: { configured: false } })
  })

  it('counts ready-for-reward cards and rewards redeemed this month', async () => {
    const db = makeDb({
      loyaltyCard: { findMany: vi.fn().mockResolvedValue([makeCard({ currentPunches: 5 }), makeCard({ id: 'card-2', currentPunches: 1 })]) },
      loyaltyRedemption: { count: vi.fn().mockResolvedValue(3) }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await loyaltyProgramService.getSummary()

    expect(res).toEqual({ success: true, data: { configured: true, isActive: true, totalCards: 2, readyForRewardCount: 1, rewardsRedeemedThisMonth: 3 } })
  })
})
