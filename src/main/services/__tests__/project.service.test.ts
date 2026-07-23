import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { generateProjectInvoice } from '../project.service'

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
