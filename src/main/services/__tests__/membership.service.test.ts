import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../notification-queue.service', () => ({ buildWhatsAppLink: vi.fn().mockResolvedValue(null) }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { listMembershipPlans, createMembershipPlan, updateMembershipPlan, listMemberships, getMembershipsByClient, createMembership, generateMembershipInvoice, freezeMembership, resumeMembership } from '../membership.service'

// Regression coverage for the Phase 27 re-audit finding: MembershipPlan.price
// is a Prisma Decimal — Electron's IPC can't serialize a Decimal instance and
// throws "An object could not be cloned" on every response that includes it,
// whether returned directly (plan CRUD) or nested under `plan` via an
// `include` (membership list/create). Live-verified: creating a plan through
// the real UI left the "Save" button stuck forever with the plan silently
// written to the DB anyway, and the Plans/Memberships tabs never loaded. A
// FakeDecimal test double (toString/valueOf only, like a real Decimal.js
// instance) proves serializePlan/serializeMembership actually convert it.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    id: 'plan-1', planName: 'Monthly', durationDays: 30,
    price: new FakeDecimal(1500) as unknown as number,
    sessionsIncluded: null, allowedClasses: null, isActive: true,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeMembership(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mem-1', clientId: 'cust-1', planId: 'plan-1',
    startDate: new Date(), endDate: new Date(), status: 'ACTIVE', paymentStatus: 'PENDING',
    sessionsUsed: 0, invoiceId: null, freezeHistory: null, notes: null,
    createdAt: new Date(), updatedAt: new Date(),
    client: { id: 'cust-1', customerName: 'Test Client', phone: null },
    plan: makePlan(),
    ...overrides,
  }
}

function makeMockDb(plan: ReturnType<typeof makePlan> | null = makePlan()) {
  const db: Record<string, any> = {
    membershipPlan: {
      findMany: vi.fn().mockResolvedValue(plan ? [plan] : []),
      findUnique: vi.fn().mockResolvedValue(plan),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makePlan({ id: 'plan-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makePlan({ ...data }))
      ),
    },
    membership: {
      findMany: vi.fn().mockResolvedValue([makeMembership()]),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeMembership({ id: 'mem-new', ...data }))
      ),
    },
    notificationQueue: { create: vi.fn().mockResolvedValue({}) },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('membership.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('listMembershipPlans returns price as a plain number', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listMembershipPlans()

    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ price: unknown }> }).data[0].price).toBe('number')
  })

  it('createMembershipPlan returns price as a plain number', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createMembershipPlan({ planName: 'Quarterly', durationDays: 90, price: 4000 })

    expect(res.success).toBe(true)
    expect((res as unknown as { data: { price: number } }).data.price).toBe(4000)
  })

  it('updateMembershipPlan returns price as a plain number', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateMembershipPlan({ id: 'plan-1', price: 2000 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { price: unknown } }).data.price).toBe('number')
  })

  it('listMemberships returns the nested plan.price as a plain number', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listMemberships()

    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ plan: { price: unknown } }> }).data[0].plan.price).toBe('number')
  })

  it('getMembershipsByClient returns the nested plan.price as a plain number', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getMembershipsByClient('cust-1')

    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ plan: { price: unknown } }> }).data[0].plan.price).toBe('number')
  })

  it('createMembership returns the nested plan.price as a plain number', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createMembership({ clientId: 'cust-1', planId: 'plan-1', startDate: '2026-07-01' })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { plan: { price: unknown } } }).data.plan.price).toBe('number')
  })
})

// Phase 41 — generateMembershipInvoice

function makeMembershipForInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mem-1', clientId: 'cust-1', invoiceId: null,
    plan: { id: 'plan-1', planName: 'Monthly', price: 1500 },
    ...overrides,
  }
}

function makeInvoiceMockDb(membership: ReturnType<typeof makeMembershipForInvoice> | null) {
  const canClaim = !!membership && !membership.invoiceId
  return {
    membership: {
      updateMany: vi.fn().mockResolvedValue({ count: canClaim ? 1 : 0 }),
      findUnique: vi.fn().mockResolvedValue(membership),
      update: vi.fn().mockResolvedValue({}),
    },
    product: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'product-1', hsnCode: '999723' }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
}

describe('membership.service — generateMembershipInvoice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing membership', async () => {
    const db = makeInvoiceMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateMembershipInvoice('mem-missing')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('M27-008')
  })

  it('rejects a membership that already has an invoice', async () => {
    const db = makeInvoiceMockDb(makeMembershipForInvoice({ invoiceId: 'invoice-existing' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateMembershipInvoice('mem-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('M27-009')
  })

  it('rejects a membership whose plan has no price set', async () => {
    const db = makeInvoiceMockDb(makeMembershipForInvoice({ plan: { id: 'plan-1', planName: 'Free Trial', price: 0 } }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateMembershipInvoice('mem-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('M27-010')
  })

  it('generates an invoice using the correct SAC code (999723, not 999313)', async () => {
    const db = makeInvoiceMockDb(makeMembershipForInvoice())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-1' } } as never)

    const res = await generateMembershipInvoice('mem-1')

    expect(res.success).toBe(true)
    expect((res as { data: { invoiceId: string } }).data.invoiceId).toBe('invoice-1')
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'cust-1',
      items: [expect.objectContaining({ productId: 'product-1', unitPrice: 1500 })],
    }))
    expect(db.product.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ hsnCode: '999723' }) }))
    expect(db.membership.update).toHaveBeenCalledWith({ where: { id: 'mem-1' }, data: { invoiceId: 'invoice-1', paymentStatus: 'PAID' } })
    const call = vi.mocked(billingService.createInvoice).mock.calls[0][0]
    expect(call.items[0]).not.toHaveProperty('taxRate')
  })

  it('propagates a billing failure without linking an invoice, and releases the claim', async () => {
    const db = makeInvoiceMockDb(makeMembershipForInvoice())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'BILL-001', message: 'failed' } } as never)

    const res = await generateMembershipInvoice('mem-1')

    expect(res.success).toBe(false)
    expect(db.membership.update).toHaveBeenCalledWith({ where: { id: 'mem-1' }, data: { invoiceId: null } })
  })

  it('rejects and releases the claim when a concurrent call wins the race', async () => {
    const db = makeInvoiceMockDb(makeMembershipForInvoice())
    db.membership.updateMany = vi.fn().mockResolvedValueOnce({ count: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateMembershipInvoice('mem-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('M27-009')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })
})

// Phase 58 §2 — Gym/Studio: freezeMembership/resumeMembership real date math

function makeFreezeMockDb(membership: Record<string, unknown> | null) {
  return {
    membership: {
      findUnique: vi.fn().mockResolvedValue(membership),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...membership, ...data })
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
}

describe('membership.service — freezeMembership / resumeMembership', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  it('freeze rejects a missing membership', async () => {
    const db = makeFreezeMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await freezeMembership({ id: 'missing' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('M27-012')
  })

  it('freeze rejects a membership that is not ACTIVE', async () => {
    const db = makeFreezeMockDb({ id: 'mem-1', status: 'EXPIRED', freezeHistory: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await freezeMembership({ id: 'mem-1' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('M27-013')
  })

  it('freeze appends an open freeze entry and sets status FROZEN', async () => {
    const db = makeFreezeMockDb({ id: 'mem-1', status: 'ACTIVE', freezeHistory: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await freezeMembership({ id: 'mem-1', reason: 'Traveling' })
    expect(res.success).toBe(true)

    const updateCall = db.membership.update.mock.calls[0][0]
    expect(updateCall.data.status).toBe('FROZEN')
    const history = JSON.parse(updateCall.data.freezeHistory)
    expect(history).toHaveLength(1)
    expect(history[0].resumedOn).toBeNull()
    expect(history[0].reason).toBe('Traveling')
  })

  it('freeze preserves prior closed freeze entries when appending a new one', async () => {
    const priorHistory = JSON.stringify([{ frozenOn: '2026-01-01T00:00:00.000Z', resumedOn: '2026-01-10T00:00:00.000Z', reason: 'Old' }])
    const db = makeFreezeMockDb({ id: 'mem-1', status: 'ACTIVE', freezeHistory: priorHistory })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await freezeMembership({ id: 'mem-1' })

    const updateCall = db.membership.update.mock.calls[0][0]
    const history = JSON.parse(updateCall.data.freezeHistory)
    expect(history).toHaveLength(2)
    expect(history[0].reason).toBe('Old')
    expect(history[1].resumedOn).toBeNull()
  })

  it('resume rejects a missing membership', async () => {
    const db = makeFreezeMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await resumeMembership({ id: 'missing' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('M27-012')
  })

  it('resume rejects a membership that is not FROZEN', async () => {
    const db = makeFreezeMockDb({ id: 'mem-1', status: 'ACTIVE', freezeHistory: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await resumeMembership({ id: 'mem-1' })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('M27-015')
  })

  it('resume pushes endDate forward by exactly the frozen number of days and closes the open entry', async () => {
    const now = new Date('2026-07-18T12:00:00.000Z')
    vi.useFakeTimers()
    vi.setSystemTime(now)

    const frozenOn = new Date('2026-07-08T12:00:00.000Z') // exactly 10 days before "now"
    const endDate = new Date('2026-08-01T00:00:00.000Z')
    const history = JSON.stringify([{ frozenOn: frozenOn.toISOString(), resumedOn: null, reason: 'Injury' }])
    const db = makeFreezeMockDb({ id: 'mem-1', status: 'FROZEN', freezeHistory: history, endDate })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await resumeMembership({ id: 'mem-1' })
    expect(res.success).toBe(true)

    const updateCall = db.membership.update.mock.calls[0][0]
    expect(updateCall.data.status).toBe('ACTIVE')
    const newHistory = JSON.parse(updateCall.data.freezeHistory)
    expect(newHistory[0].resumedOn).not.toBeNull()

    const expectedEndDate = new Date(endDate.getTime() + 10 * 86400000)
    expect((updateCall.data.endDate as Date).getTime()).toBe(expectedEndDate.getTime())

    vi.useRealTimers()
  })

  it('resume falls back to a plain status flip (no endDate change) when FROZEN but no open freeze entry exists', async () => {
    const endDate = new Date('2026-08-01T00:00:00.000Z')
    const history = JSON.stringify([{ frozenOn: '2026-07-01T00:00:00.000Z', resumedOn: '2026-07-05T00:00:00.000Z', reason: 'Already closed' }])
    const db = makeFreezeMockDb({ id: 'mem-1', status: 'FROZEN', freezeHistory: history, endDate })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await resumeMembership({ id: 'mem-1' })
    expect(res.success).toBe(true)

    const updateCall = db.membership.update.mock.calls[0][0]
    expect(updateCall.data.status).toBe('ACTIVE')
    expect(updateCall.data.endDate).toBeUndefined()
  })
})

