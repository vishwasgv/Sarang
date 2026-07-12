import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { listMilestones, createMilestone, updateMilestone, generateMilestoneInvoice, deleteMilestone } from '../service-project-milestone.service'

// Regression coverage for the Phase 30 re-audit finding:
// ServiceProjectMilestone.milestoneAmount is a Prisma Decimal field,
// returned unserialized by listMilestones/createMilestone/updateMilestone.
// Electron's IPC can't serialize a Decimal instance and throws "An object
// could not be cloned". serializeMilestone is also exported and reused by
// service-project.service.ts to serialize the nested milestones[] array on
// a project response — covered separately in service-project.service.test.ts.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeMilestone(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ms-1', projectId: 'proj-1', milestoneName: 'Design Phase',
    milestoneAmount: new FakeDecimal(25000) as unknown as number,
    dueDate: null, completedDate: null, invoiceId: null, status: 'UPCOMING', notes: null,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeMilestone> | null = null) {
  const db: Record<string, any> = {
    serviceProjectMilestone: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeMilestone({ id: 'ms-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeMilestone({ ...existing, ...data }))
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('service-project-milestone.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createMilestone returns milestoneAmount as a plain number', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createMilestone({ projectId: 'proj-1', milestoneName: 'Design Phase', milestoneAmount: 25000 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { milestoneAmount: unknown } }).data.milestoneAmount).toBe('number')
  })

  it('createMilestone returns milestoneAmount as null when unset, not a Decimal', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    db.serviceProjectMilestone.create = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(makeMilestone({ id: 'ms-new', ...data, milestoneAmount: null }))
    )

    const res = await createMilestone({ projectId: 'proj-1', milestoneName: 'Discovery Phase' })

    expect(res.success).toBe(true)
    expect((res as { data: { milestoneAmount: unknown } }).data.milestoneAmount).toBeNull()
  })

  it('listMilestones returns milestoneAmount as a plain number, not a Decimal instance', async () => {
    const db = makeMockDb(makeMilestone())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listMilestones('proj-1')

    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ milestoneAmount: unknown }> }).data[0].milestoneAmount).toBe('number')
  })

  it('updateMilestone returns milestoneAmount as a plain number', async () => {
    const db = makeMockDb(makeMilestone())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateMilestone({ id: 'ms-1', status: 'COMPLETED', milestoneAmount: 30000 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { milestoneAmount: unknown } }).data.milestoneAmount).toBe('number')
  })

  it('rejects a negative milestoneAmount before touching the database', async () => {
    const db = makeMockDb(makeMilestone())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateMilestone({ id: 'ms-1', milestoneAmount: -500 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('MS30-009')
    expect(db.serviceProjectMilestone.update).not.toHaveBeenCalled()
  })
})

// Phase 40 — generateMilestoneInvoice

function makeMilestoneWithProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ms-1', projectId: 'proj-1', milestoneName: 'Design Phase',
    milestoneAmount: 25000, invoiceId: null, status: 'COMPLETED',
    project: { id: 'proj-1', clientId: 'client-1', projectName: 'Villa Renovation' },
    ...overrides,
  }
}

function makeInvoiceMockDb(milestone: ReturnType<typeof makeMilestoneWithProject> | null) {
  // Mirrors the real atomic claim: UPDATE...WHERE invoiceId IS NULL only
  // matches (and only "wins") when the milestone exists and isn't already
  // invoiced/claimed.
  const canClaim = !!milestone && !milestone.invoiceId
  return {
    serviceProjectMilestone: {
      updateMany: vi.fn().mockResolvedValue({ count: canClaim ? 1 : 0 }),
      findUnique: vi.fn().mockResolvedValue(milestone),
      update: vi.fn().mockResolvedValue({}),
    },
    product: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'product-1', hsnCode: '998311' }),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
}

describe('service-project-milestone.service — generateMilestoneInvoice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing milestone', async () => {
    const db = makeInvoiceMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateMilestoneInvoice('ms-missing')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('MS30-005')
  })

  it('rejects a milestone that already has an invoice', async () => {
    const db = makeInvoiceMockDb(makeMilestoneWithProject({ invoiceId: 'invoice-existing' }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateMilestoneInvoice('ms-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('MS30-006')
  })

  it('rejects a milestone with no amount set', async () => {
    const db = makeInvoiceMockDb(makeMilestoneWithProject({ milestoneAmount: null }))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateMilestoneInvoice('ms-1')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('MS30-007')
  })

  it('generates an invoice and marks the milestone INVOICED', async () => {
    const db = makeInvoiceMockDb(makeMilestoneWithProject())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-1' } } as never)

    const res = await generateMilestoneInvoice('ms-1')

    expect(res.success).toBe(true)
    expect((res as { data: { invoiceId: string } }).data.invoiceId).toBe('invoice-1')
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'client-1',
      items: [expect.objectContaining({ productId: 'product-1', unitPrice: 25000 })],
    }))
    expect(db.serviceProjectMilestone.update).toHaveBeenCalledWith({
      where: { id: 'ms-1' },
      data: { invoiceId: 'invoice-1', status: 'INVOICED' },
    })
  })

  it('propagates a billing failure without marking the milestone invoiced, and releases the claim', async () => {
    const db = makeInvoiceMockDb(makeMilestoneWithProject())
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'BILL-001', message: 'failed' } } as never)

    const res = await generateMilestoneInvoice('ms-1')

    expect(res.success).toBe(false)
    expect(db.serviceProjectMilestone.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'INVOICED' }) }))
    expect(db.serviceProjectMilestone.update).toHaveBeenCalledWith({ where: { id: 'ms-1' }, data: { invoiceId: null } })
  })

  it('rejects and releases the claim when a concurrent call wins the race', async () => {
    const db = makeInvoiceMockDb(makeMilestoneWithProject())
    db.serviceProjectMilestone.updateMany = vi.fn().mockResolvedValueOnce({ count: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateMilestoneInvoice('ms-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('MS30-006')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })
})

// Evaluation-fix regression: deleteMilestone had no invoice guard, unlike
// the structurally identical ShootBooking (SHT-002)/EventBooking (EVT-002).

describe('service-project-milestone.service — deleteMilestone invoice guard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('blocks deleting a milestone that already has an invoice', async () => {
    const db = {
      serviceProjectMilestone: {
        findUnique: vi.fn().mockResolvedValue({ invoiceId: 'invoice-1' }),
        delete: vi.fn(),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deleteMilestone('ms-1')

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('MS30-010')
    expect(db.serviceProjectMilestone.delete).not.toHaveBeenCalled()
  })

  it('allows deleting a milestone with no invoice', async () => {
    const db = {
      serviceProjectMilestone: {
        findUnique: vi.fn().mockResolvedValue({ invoiceId: null }),
        delete: vi.fn().mockResolvedValue({}),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await deleteMilestone('ms-1')

    expect(res.success).toBe(true)
    expect(db.serviceProjectMilestone.delete).toHaveBeenCalledWith({ where: { id: 'ms-1' } })
  })
})
