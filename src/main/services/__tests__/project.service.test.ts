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
    expect(call.items).toEqual([{ productId: 'prod-existing-consulting', quantity: 1, unitPrice: 50000, taxRate: 18 }])
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
    expect(db.project.update).not.toHaveBeenCalled()
  })
})
