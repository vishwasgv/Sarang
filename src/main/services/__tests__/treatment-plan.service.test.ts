import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { createTreatmentPlan, generateInvoiceFromTreatmentPlan } from '../treatment-plan.service'

// Regression coverage for two Phase 25 re-audit findings:
// 1. The handler injected the session's userId into createdById, which is
//    FK'd to Employee (a separate, unlinked table from User) — every create
//    failed with a foreign key violation, live-verified with the real admin
//    User.id. Fixed by never passing the session's userId as createdById;
//    threading it through as userId for the audit log instead.
// 2. totalEstimatedCost is a Prisma Decimal, which Electron's IPC cannot
//    serialize ("An object could not be cloned") — masked until finding #1
//    was fixed, since the FK violation always threw first. Fixed by
//    converting it to a plain number before returning.

// Mimics Prisma's Decimal: a class instance, not a plain number, whose
// numeric value only comes out via toString()/valueOf() — exactly the shape
// that crashes Electron's structured-clone IPC serialization.
class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeMockDb() {
  const db: Record<string, any> = {
    treatmentPlan: {
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'plan-1', ...data, totalEstimatedCost: new FakeDecimal((data.totalEstimatedCost as number) ?? 0) })
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('treatment-plan.service — createdById must never be a User id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates successfully when createdById is not supplied (the fixed handler behaviour)', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTreatmentPlan({ patientId: 'pat-1', title: 'Root canal', userId: 'user-1' })

    expect(res.success).toBe(true)
    expect(db.treatmentPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ createdById: null }) })
    )
  })

  it('records the real userId on the audit log entry, not on the FK field', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createTreatmentPlan({ patientId: 'pat-1', title: 'Crown', userId: 'user-42' })

    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: 'user-42', entityType: 'TreatmentPlan' }) })
    )
  })

  it('returns totalEstimatedCost as a plain number, never a Decimal instance (IPC-serialization safety)', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTreatmentPlan({ patientId: 'pat-1', title: 'Bridge', totalEstimatedCost: 12000 })

    expect(res.success).toBe(true)
    const cost = (res as { data: { totalEstimatedCost: unknown } }).data.totalEstimatedCost
    expect(typeof cost).toBe('number')
    expect(cost).toBe(12000)
  })
})

// Phase 67 §9.1 item 21.1 — Dental Clinic: treatment-plan conversion tracking.
describe('treatment-plan.service — generateInvoiceFromTreatmentPlan', () => {
  beforeEach(() => vi.clearAllMocks())

  function makePlan(overrides: Record<string, unknown> = {}) {
    return {
      id: 'plan-1', patientId: 'pat-1', status: 'ACCEPTED', title: 'Root canal', invoiceId: null,
      planItems: JSON.stringify([{ toothNumber: 14, procedure: 'Root Canal', estimatedCost: 5000, itemStatus: 'PENDING' }]),
      ...overrides,
    }
  }

  // makeClaimingDb wires up the atomic-claim shape (updateMany gated on
  // invoiceId: null) every generateXInvoice in this codebase shares —
  // findUnique is called twice by the fixed implementation (once to resolve
  // the not-found/already-billed error when the claim fails, once for the
  // real post-claim read), so both mocks must return the plan/null
  // consistently across calls.
  function makeClaimingDb(plan: Record<string, unknown> | null, opts: { claimCount?: number } = {}) {
    const claimCount = opts.claimCount ?? (plan && !plan.invoiceId ? 1 : 0)
    const db: Record<string, any> = {
      treatmentPlan: {
        updateMany: vi.fn().mockResolvedValue({ count: claimCount }),
        findUnique: vi.fn().mockResolvedValue(plan),
        update: vi.fn().mockResolvedValue({}),
      },
      product: { findFirst: vi.fn().mockResolvedValue({ id: 'prod-dental' }) },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    return db
  }

  it('bills an accepted plan, creating one invoice line per priced item', async () => {
    const db = makeClaimingDb(makePlan())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)

    const res = await generateInvoiceFromTreatmentPlan({ treatmentPlanId: 'plan-1' }, 'user-1')

    expect(res.success).toBe(true)
    expect(db.treatmentPlan.updateMany).toHaveBeenCalledWith({
      where: { id: 'plan-1', invoiceId: null },
      data: { invoiceId: 'PENDING_INVOICE_GENERATION' },
    })
    expect(billingService.createInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'pat-1',
        items: [expect.objectContaining({ productId: 'prod-dental', quantity: 1, unitPrice: 5000, variantInfo: 'Tooth #14 — Root Canal' })],
      }),
      'user-1'
    )
    expect(db.treatmentPlan.update).toHaveBeenCalledWith({ where: { id: 'plan-1' }, data: { invoiceId: 'inv-1' } })
  })

  it('rejects billing a plan that is still PROPOSED, and releases the claim', async () => {
    const db = makeClaimingDb(makePlan({ status: 'PROPOSED' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateInvoiceFromTreatmentPlan({ treatmentPlanId: 'plan-1' })

    expect(res.success).toBe(false)
    expect(billingService.createInvoice).not.toHaveBeenCalled()
    expect(db.treatmentPlan.update).toHaveBeenCalledWith({ where: { id: 'plan-1' }, data: { invoiceId: null } })
  })

  it('rejects billing a DECLINED plan', async () => {
    const db = makeClaimingDb(makePlan({ status: 'DECLINED' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateInvoiceFromTreatmentPlan({ treatmentPlanId: 'plan-1' })

    expect(res.success).toBe(false)
  })

  it('rejects re-billing a plan that already has an invoiceId', async () => {
    const plan = makePlan({ invoiceId: 'inv-old' })
    const db = makeClaimingDb(plan, { claimCount: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateInvoiceFromTreatmentPlan({ treatmentPlanId: 'plan-1' })

    expect(res.success).toBe(false)
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })

  it('rejects a plan with no positively-priced items', async () => {
    const db = makeClaimingDb(makePlan({ planItems: JSON.stringify([{ procedure: 'Consultation', estimatedCost: 0, itemStatus: 'DONE' }]) }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateInvoiceFromTreatmentPlan({ treatmentPlanId: 'plan-1' })

    expect(res.success).toBe(false)
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })

  // Real bug found in this audit: two near-simultaneous calls for the same
  // plan (double-click, or two staff terminals) used to both pass a plain
  // `if (plan.invoiceId)` read-check before either write landed, so both
  // could call billingService.createInvoice — double-billing the patient.
  // The fix claims the row atomically first; a losing concurrent call must
  // see claim.count === 0 and never touch billing at all.
  it('rejects a concurrent second call that loses the atomic claim, without calling billing', async () => {
    const db = makeClaimingDb(makePlan(), { claimCount: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateInvoiceFromTreatmentPlan({ treatmentPlanId: 'plan-1' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TP-006')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
    expect(db.treatmentPlan.update).not.toHaveBeenCalled()
  })

  it('releases the claim when billing itself fails', async () => {
    const db = makeClaimingDb(makePlan())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'INVOC-002', message: 'boom' } } as never)

    const res = await generateInvoiceFromTreatmentPlan({ treatmentPlanId: 'plan-1' })

    expect(res.success).toBe(false)
    expect(db.treatmentPlan.update).toHaveBeenCalledWith({ where: { id: 'plan-1' }, data: { invoiceId: null } })
  })
})
