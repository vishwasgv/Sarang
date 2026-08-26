import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { generateProjectInvoice, createProject, getEngagementConversionStats, getProposalWinRateStats } from '../project.service'

// Phase 58 §1 (2026-07-17) — legacy SERVICE/CONSULTANT invoicing bridge.
// Project had no way to generate an invoice at all before this; these tests
// cover the real guard logic (no customer, no amount, already invoiced) and
// the lookup-or-create SAC product line, matching the pattern already
// covered for CarJobCard/Placement invoice generation.

function makeProject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prj-1', projectNumber: 'PRJ-00001', title: 'Website Revamp',
    customerId: 'cust-1', estimatedAmount: 50000, invoiceId: null,
    ...overrides,
  }
}

function makeMockDb(project: ReturnType<typeof makeProject> | null, opts: { existingProduct?: { id: string } | null } = {}) {
  const db: Record<string, any> = {
    project: {
      findUnique: vi.fn().mockResolvedValue(project),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ ...project, ...data })),
      // Atomic invoiceId claim (see generateProjectInvoice) — succeeds only
      // while the row's invoiceId is genuinely still null, mirroring the
      // real `where: { id, invoiceId: null }` conditional update.
      updateMany: vi.fn().mockImplementation(() => Promise.resolve({ count: project && !project.invoiceId ? 1 : 0 })),
    },
    product: {
      findFirst: vi.fn().mockResolvedValue(opts.existingProduct ?? null),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'prod-new', ...data })),
    },
  }
  return db
}

describe('project.service.generateProjectInvoice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fails with a clear error when the project has no linked customer', async () => {
    const project = makeProject({ customerId: null })
    vi.mocked(getPrisma).mockReturnValue(makeMockDb(project) as never)

    const res = await generateProjectInvoice('prj-1')

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('PRJ-004')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })

  it('fails when an invoice was already generated for this project', async () => {
    const project = makeProject({ invoiceId: 'inv-existing' })
    vi.mocked(getPrisma).mockReturnValue(makeMockDb(project) as never)

    const res = await generateProjectInvoice('prj-1')

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('PRJ-005')
  })

  it('fails when estimatedAmount is zero — nothing to bill', async () => {
    const project = makeProject({ estimatedAmount: 0 })
    vi.mocked(getPrisma).mockReturnValue(makeMockDb(project) as never)

    const res = await generateProjectInvoice('prj-1')

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('PRJ-006')
  })

  it('reuses an existing consulting-services product instead of creating a duplicate', async () => {
    const project = makeProject()
    const db = makeMockDb(project, { existingProduct: { id: 'prod-existing-consulting' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)

    const res = await generateProjectInvoice('prj-1')

    expect(res.success).toBe(true)
    expect(db.product.create).not.toHaveBeenCalled()
    const call = vi.mocked(billingService.createInvoice).mock.calls[0][0] as { items: Array<{ productId: string; unitPrice: number }> }
    // Regression: no hardcoded taxRate — it must fall through to the
    // product's own (editable) taxRate rather than silently override it.
    expect(call.items).toEqual([{ productId: 'prod-existing-consulting', quantity: 1, unitPrice: 50000 }])
  })

  it('creates the SAC consulting-services product on first use, then marks the project invoiced', async () => {
    const project = makeProject()
    const db = makeMockDb(project, { existingProduct: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-2' } } as never)

    const res = await generateProjectInvoice('prj-1')

    expect(res.success).toBe(true)
    expect(res.data).toEqual({ invoiceId: 'inv-2' })
    expect(db.product.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ hsnCode: '998313' }) }))
    expect(db.project.update).toHaveBeenCalledWith({ where: { id: 'prj-1' }, data: { invoiceId: 'inv-2' } })
  })

  it('propagates a billing failure (e.g. insufficient permission downstream) without marking the project invoiced', async () => {
    const project = makeProject()
    const db = makeMockDb(project, { existingProduct: { id: 'prod-x' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'BILL-001', message: 'Something went wrong.' } } as never)

    const res = await generateProjectInvoice('prj-1')

    expect(res.success).toBe(false)
    // The invoiceId claim taken before billing was attempted must be
    // released (not left stuck at the sentinel value) — never "marked
    // invoiced" with a real invoice id.
    expect(db.project.update).toHaveBeenCalledWith({ where: { id: 'prj-1' }, data: { invoiceId: null } })
  })
})

// Real bug found 2026-07-23: generateProjectInvoice had no atomic claim on
// invoiceId — two concurrent calls for the same project could both pass a
// stale "already invoiced?" check and each create a real, separate
// Invoice. Fixed with the same atomic conditional-claim + release-on-
// failure shape as car-job-card.service.ts's generateCarJobInvoice.

describe('project.service.generateProjectInvoice — invoice-claim atomicity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects without calling billingService.createInvoice when the claim fails (already invoiced)', async () => {
    const project = makeProject({ invoiceId: 'inv-existing' })
    const db = makeMockDb(project)
    db.project.updateMany = vi.fn().mockResolvedValue({ count: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateProjectInvoice('prj-1')

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('PRJ-005')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })

  it('claims invoiceId atomically before calling billingService.createInvoice', async () => {
    const project = makeProject()
    const db = makeMockDb(project, { existingProduct: { id: 'prod-1' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)

    await generateProjectInvoice('prj-1')

    expect(db.project.updateMany).toHaveBeenCalledWith({ where: { id: 'prj-1', invoiceId: null }, data: { invoiceId: 'PENDING_INVOICE_GENERATION' } })
    const claimCallOrder = db.project.updateMany.mock.invocationCallOrder[0]
    const createInvoiceCallOrder = vi.mocked(billingService.createInvoice).mock.invocationCallOrder[0]
    expect(claimCallOrder).toBeLessThan(createInvoiceCallOrder)
  })
})

// Phase 67 §9.1 — Consultant item 1: engagement-letter -> project
// auto-conversion. Same TKT-009/010/011-style guard shape as
// service-ticket.service.ts's own createTicket, generalized to PRJ-009/010/011.
function makeCreateMockDb(quotation: { status: string; project: { id: string } | null } | null = null) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    quotation: {
      findUnique: vi.fn().mockResolvedValue(quotation),
      count: vi.fn().mockResolvedValue(0),
    },
    project: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'prj-new', status: 'OPEN', createdAt: new Date(), updatedAt: new Date(), tasks: [], workLogs: [], ...data, customer: null, assignedTo: null, quotation: null })
      ),
    },
    setting: {
      findUnique: vi.fn(async () => settingRow),
      updateMany: vi.fn(async ({ where, data }: { where: { settingValue: string }; data: { settingValue: string } }) => {
        if (!settingRow || settingRow.settingValue !== where.settingValue) return { count: 0 }
        settingRow = { ...settingRow, settingValue: data.settingValue }
        return { count: 1 }
      }),
      create: vi.fn(async ({ data }: { data: { settingKey: string; settingValue: string } }) => {
        settingRow = { settingKey: data.settingKey, settingValue: data.settingValue }
        return settingRow
      }),
    },
  }
  db.$transaction = vi.fn(async (cb: (tx: unknown) => unknown) => cb(db))
  return db
}

describe('project.service.createProject — engagement-letter conversion guards', () => {
  beforeEach(() => vi.clearAllMocks())

  it('links a project to an ACCEPTED, unconverted quotation', async () => {
    const db = makeCreateMockDb({ status: 'ACCEPTED', project: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createProject({ title: 'Website Revamp', quotationId: 'quo-1' })

    expect(res.success).toBe(true)
    expect(db.project.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ quotationId: 'quo-1' }),
    }))
  })

  it('rejects converting a quotation that is not ACCEPTED', async () => {
    const db = makeCreateMockDb({ status: 'DRAFT', project: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createProject({ title: 'Website Revamp', quotationId: 'quo-1' })

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('PRJ-010')
  })

  it('rejects converting a quotation that was already converted to another project', async () => {
    const db = makeCreateMockDb({ status: 'ACCEPTED', project: { id: 'prj-existing' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createProject({ title: 'Website Revamp', quotationId: 'quo-1' })

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('PRJ-011')
  })

  it('rejects a quotation that does not exist', async () => {
    const db = makeCreateMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createProject({ title: 'Website Revamp', quotationId: 'ghost' })

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('PRJ-009')
  })

  it('creates a project with no quotation at all, unaffected', async () => {
    const db = makeCreateMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createProject({ title: 'Internal audit' })

    expect(res.success).toBe(true)
    expect(db.quotation.findUnique).not.toHaveBeenCalled()
  })
})

describe('project.service.getEngagementConversionStats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('computes a real conversion rate from accepted-vs-converted counts', async () => {
    const db = { quotation: { count: vi.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(3) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getEngagementConversionStats()

    expect(res.success).toBe(true)
    expect(res.data).toEqual({ acceptedQuotations: 4, convertedToProject: 3, conversionRatePercent: 75 })
  })

  it('reports 0% (not NaN) when there are no accepted quotations at all', async () => {
    const db = { quotation: { count: vi.fn().mockResolvedValue(0) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getEngagementConversionStats()

    expect(res.data?.conversionRatePercent).toBe(0)
  })
})

describe('project.service.getProposalWinRateStats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('computes win rate from decided proposals only, excluding pending ones', async () => {
    const db = {
      quotation: {
        count: vi.fn()
          .mockResolvedValueOnce(10) // total
          .mockResolvedValueOnce(6) // won (ACCEPTED)
          .mockResolvedValueOnce(2), // lost (EXPIRED)
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getProposalWinRateStats()

    expect(res.success).toBe(true)
    // decided = 6 + 2 = 8, winRate = 6/8 = 75%; pending = 10 - 8 = 2
    expect(res.data).toEqual({ totalProposals: 10, won: 6, lost: 2, pending: 2, winRatePercent: 75 })
  })

  it('reports 0% (not NaN) when nothing has been decided yet', async () => {
    const db = { quotation: { count: vi.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(0).mockResolvedValueOnce(0) } }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getProposalWinRateStats()

    expect(res.data).toEqual({ totalProposals: 3, won: 0, lost: 0, pending: 3, winRatePercent: 0 })
  })
})
