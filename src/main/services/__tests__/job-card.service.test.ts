import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))
vi.mock('../inventory.service', () => ({ inventoryService: { reduceStockTx: vi.fn() } }))
vi.mock('../sequence.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../sequence.service')>()
  return { ...actual, generateSequenceNumber: vi.fn().mockResolvedValue('JOB-00001') }
})

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { inventoryService } from '../inventory.service'
import { generateJobCardInvoice, createJobCard, updateJobCard, addJobCardPart, removeJobCardPart } from '../job-card.service'
import { ServiceError } from '../../errors/service-error'

// Phase 58 §1 (2026-07-17) — legacy Repair Shop invoicing bridge. JobCard had
// no way to generate an invoice at all before this. Key non-trivial logic:
// bill actualCost once the shop has recorded a final figure, otherwise fall
// back to estimatedCost so a job can still be invoiced up-front.

function makeJobCard(overrides: Record<string, unknown> = {}) {
  return {
    id: 'jc-1', jobNumber: 'JC-00001', title: 'Laptop screen replacement',
    customerId: 'cust-1', estimatedCost: 3000, actualCost: 0, invoiceId: null,
    ...overrides,
  }
}

function makeMockDb(job: ReturnType<typeof makeJobCard> | null, opts: { existingProduct?: { id: string } | null } = {}) {
  const db: Record<string, any> = {
    jobCard: {
      findUnique: vi.fn().mockResolvedValue(job),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ ...job, ...data })),
      // Atomic invoiceId claim (see generateJobCardInvoice) — succeeds only
      // while the row's invoiceId is genuinely still null, mirroring the
      // real `where: { id, invoiceId: null }` conditional update.
      updateMany: vi.fn().mockImplementation(() => Promise.resolve({ count: job && !job.invoiceId ? 1 : 0 })),
    },
    product: {
      findFirst: vi.fn().mockResolvedValue(opts.existingProduct ?? null),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'prod-new', ...data })),
    },
  }
  return db
}

describe('job-card.service.generateJobCardInvoice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('bills actualCost when the shop has recorded a final figure, not estimatedCost', async () => {
    const job = makeJobCard({ estimatedCost: 3000, actualCost: 2800 })
    const db = makeMockDb(job, { existingProduct: { id: 'prod-repair' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)

    await generateJobCardInvoice('jc-1')

    const call = vi.mocked(billingService.createInvoice).mock.calls[0][0] as { items: Array<{ unitPrice: number }> }
    expect(call.items[0].unitPrice).toBe(2800)
  })

  it('falls back to estimatedCost when actualCost has not been recorded yet (still zero)', async () => {
    const job = makeJobCard({ estimatedCost: 3000, actualCost: 0 })
    const db = makeMockDb(job, { existingProduct: { id: 'prod-repair' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-2' } } as never)

    await generateJobCardInvoice('jc-1')

    const call = vi.mocked(billingService.createInvoice).mock.calls[0][0] as { items: Array<{ unitPrice: number }> }
    expect(call.items[0].unitPrice).toBe(3000)
  })

  it('fails when the job card has no linked customer', async () => {
    const job = makeJobCard({ customerId: null })
    vi.mocked(getPrisma).mockReturnValue(makeMockDb(job) as never)

    const res = await generateJobCardInvoice('jc-1')

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('JC-004')
  })

  it('fails when an invoice was already generated', async () => {
    const job = makeJobCard({ invoiceId: 'inv-existing' })
    vi.mocked(getPrisma).mockReturnValue(makeMockDb(job) as never)

    const res = await generateJobCardInvoice('jc-1')

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('JC-005')
  })

  it('fails when both estimatedCost and actualCost are zero — nothing to bill', async () => {
    const job = makeJobCard({ estimatedCost: 0, actualCost: 0 })
    vi.mocked(getPrisma).mockReturnValue(makeMockDb(job) as never)

    const res = await generateJobCardInvoice('jc-1')

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('JC-006')
  })

  it('marks the job card invoiced on success', async () => {
    const job = makeJobCard({ actualCost: 2800 })
    const db = makeMockDb(job, { existingProduct: { id: 'prod-repair' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-3' } } as never)

    const res = await generateJobCardInvoice('jc-1')

    expect(res.success).toBe(true)
    expect(db.jobCard.update).toHaveBeenCalledWith({ where: { id: 'jc-1' }, data: { invoiceId: 'inv-3' } })
  })
})

// Real bug found 2026-07-23: generateJobCardInvoice had no atomic claim on
// invoiceId — two concurrent calls for the same job card could both pass a
// stale "already invoiced?" check and each create a real, separate
// Invoice. Fixed with the same atomic conditional-claim + release-on-
// failure shape as car-job-card.service.ts's generateCarJobInvoice.

describe('job-card.service.generateJobCardInvoice — invoice-claim atomicity', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects without calling billingService.createInvoice when the claim fails (already invoiced)', async () => {
    const job = makeJobCard({ actualCost: 2800, invoiceId: 'inv-existing' })
    const db = makeMockDb(job, { existingProduct: { id: 'prod-repair' } })
    db.jobCard.updateMany = vi.fn().mockResolvedValue({ count: 0 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateJobCardInvoice('jc-1')

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('JC-005')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })

  it('claims invoiceId atomically before calling billingService.createInvoice', async () => {
    const job = makeJobCard({ actualCost: 2800 })
    const db = makeMockDb(job, { existingProduct: { id: 'prod-repair' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)

    await generateJobCardInvoice('jc-1')

    expect(db.jobCard.updateMany).toHaveBeenCalledWith({ where: { id: 'jc-1', invoiceId: null }, data: { invoiceId: 'PENDING_INVOICE_GENERATION' } })
    const claimCallOrder = db.jobCard.updateMany.mock.invocationCallOrder[0]
    const createInvoiceCallOrder = vi.mocked(billingService.createInvoice).mock.invocationCallOrder[0]
    expect(claimCallOrder).toBeLessThan(createInvoiceCallOrder)
  })

  it('releases the claim (sets invoiceId back to null) when billingService.createInvoice fails', async () => {
    const job = makeJobCard({ actualCost: 2800 })
    const db = makeMockDb(job, { existingProduct: { id: 'prod-repair' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'BILL-001', message: 'failed' } } as never)

    const res = await generateJobCardInvoice('jc-1')

    expect(res.success).toBe(false)
    expect(db.jobCard.update).toHaveBeenCalledWith({ where: { id: 'jc-1' }, data: { invoiceId: null } })
  })
})

// Phase 58 §2 — Repair: warranty-on-repair (JobCard.warrantyDays/warrantyExpiryDate)

function makeUpdateMockDb(existing: Record<string, unknown>) {
  const base = { receivedDate: new Date(), createdAt: new Date(), updatedAt: new Date(), ...existing }
  const db: Record<string, any> = {
    jobCard: {
      findUnique: vi.fn().mockResolvedValue(base),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ ...base, ...data })),
      create: vi.fn(),
    },
  }
  return db
}

describe('job-card.service.updateJobCard — warranty', () => {
  beforeEach(() => vi.clearAllMocks())

  it('computes warrantyExpiryDate = deliveredDate + warrantyDays when a job transitions to DELIVERED with warrantyDays already set', async () => {
    const db = makeUpdateMockDb({ id: 'jc-1', status: 'READY', jobNumber: 'JC-00001', warrantyDays: 30 })
    // findUnique is called twice in the update flow in some branches; keep it consistent
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const before = Date.now()
    const res = await updateJobCard({ id: 'jc-1', status: 'DELIVERED' })
    const after = Date.now()

    expect(res.success).toBe(true)
    const call = db.jobCard.update.mock.calls[0][0]
    expect(call.data.warrantyExpiryDate).toBeInstanceOf(Date)
    const deliveredMs = (call.data.deliveredDate as Date).getTime()
    const expiryMs = (call.data.warrantyExpiryDate as Date).getTime()
    expect(expiryMs - deliveredMs).toBe(30 * 86400000)
    expect(deliveredMs).toBeGreaterThanOrEqual(before)
    expect(deliveredMs).toBeLessThanOrEqual(after)
  })

  it('does not set warrantyExpiryDate on delivery when no warrantyDays is set', async () => {
    const db = makeUpdateMockDb({ id: 'jc-1', status: 'READY', jobNumber: 'JC-00001', warrantyDays: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateJobCard({ id: 'jc-1', status: 'DELIVERED' })

    const call = db.jobCard.update.mock.calls[0][0]
    expect('warrantyExpiryDate' in call.data).toBe(false)
  })

  it('lets warrantyDays be set explicitly as part of the same delivery update, not just pre-set earlier', async () => {
    const db = makeUpdateMockDb({ id: 'jc-1', status: 'READY', jobNumber: 'JC-00001', warrantyDays: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateJobCard({ id: 'jc-1', status: 'DELIVERED', warrantyDays: 90 })

    expect(res.success).toBe(true)
    const call = db.jobCard.update.mock.calls[0][0]
    expect(call.data.warrantyDays).toBe(90)
    const deliveredMs = (call.data.deliveredDate as Date).getTime()
    const expiryMs = (call.data.warrantyExpiryDate as Date).getTime()
    expect(expiryMs - deliveredMs).toBe(90 * 86400000)
  })

  it('recomputes warrantyExpiryDate from the existing deliveredDate when warrantyDays is set/changed after delivery', async () => {
    const deliveredDate = new Date('2026-01-01T00:00:00.000Z')
    const db: Record<string, any> = {
      jobCard: {
        findUnique: vi.fn()
          .mockResolvedValueOnce({ id: 'jc-1', status: 'DELIVERED', jobNumber: 'JC-00001', warrantyDays: null })
          .mockResolvedValueOnce({ deliveredDate }),
        update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'jc-1', receivedDate: new Date(), createdAt: new Date(), updatedAt: new Date(), ...data })
        ),
      },
    }
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateJobCard({ id: 'jc-1', warrantyDays: 60 })

    expect(res.success).toBe(true)
    const call = db.jobCard.update.mock.calls[0][0]
    expect((call.data.warrantyExpiryDate as Date).getTime()).toBe(deliveredDate.getTime() + 60 * 86400000)
  })

  it('clears warrantyDays when explicitly set to null', async () => {
    const db = makeUpdateMockDb({ id: 'jc-1', status: 'DELIVERED', jobNumber: 'JC-00001', warrantyDays: 30 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateJobCard({ id: 'jc-1', warrantyDays: null })

    const call = db.jobCard.update.mock.calls[0][0]
    expect(call.data.warrantyDays).toBeNull()
  })
})

describe('job-card.service.createJobCard — warrantyClaimAgainstId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('persists an optional warrantyClaimAgainstId, never validated/rejected at create time', async () => {
    const db: Record<string, any> = {
      jobCard: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: 'jc-new', jobNumber: 'JC-00001', receivedDate: new Date(), createdAt: new Date(), updatedAt: new Date(),
            ...data, customer: null, assignedTo: null, warrantyClaimAgainst: { jobNumber: 'JC-00000' },
          })
        ),
      },
    }
    db.$transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db))
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createJobCard({ title: 'Comeback repair', warrantyClaimAgainstId: 'jc-original' })

    expect(res.success).toBe(true)
    expect(db.jobCard.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ warrantyClaimAgainstId: 'jc-original' }),
    }))
    expect((res as { data: { warrantyClaimAgainstJobNumber: string } }).data.warrantyClaimAgainstJobNumber).toBe('JC-00000')
  })
})

// Phase 58 §2 — Repair: parts-used tracking with real inventory deduction

function makePartsMockDb(job: Record<string, unknown> | null, product: Record<string, unknown> | null) {
  const db: Record<string, any> = {
    jobCard: { findUnique: vi.fn().mockResolvedValue(job) },
    product: { findUnique: vi.fn().mockResolvedValue(product) },
    jobCardPart: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'part-new', createdAt: new Date(), product: { productName: 'Test Part' }, ...data })
      ),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    inventory: { update: vi.fn().mockResolvedValue({}) },
    inventoryMovement: { create: vi.fn().mockResolvedValue({}) },
  }
  db.$transaction = vi.fn((cb: (tx: unknown) => unknown) => cb(db))
  return db
}

describe('job-card.service.addJobCardPart', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a non-positive quantity', async () => {
    const res = await addJobCardPart({ jobCardId: 'jc-1', productId: 'prod-1', quantity: 0 })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('JCP-001')
  })

  it('rejects a missing job card', async () => {
    const db = makePartsMockDb(null, { id: 'prod-1', sellingPrice: 100 })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await addJobCardPart({ jobCardId: 'jc-missing', productId: 'prod-1', quantity: 2 })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('JCP-002')
  })

  it('rejects a missing product', async () => {
    const db = makePartsMockDb({ id: 'jc-1', jobNumber: 'JC-00001' }, null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await addJobCardPart({ jobCardId: 'jc-1', productId: 'prod-missing', quantity: 2 })
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('JCP-003')
  })

  it('snapshots the product sellingPrice as unitPrice and deducts real inventory via reduceStockTx', async () => {
    const db = makePartsMockDb({ id: 'jc-1', jobNumber: 'JC-00001' }, { id: 'prod-1', sellingPrice: 250 })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(inventoryService.reduceStockTx).mockResolvedValue(undefined as never)

    const res = await addJobCardPart({ jobCardId: 'jc-1', productId: 'prod-1', quantity: 3 })

    expect(res.success).toBe(true)
    expect(inventoryService.reduceStockTx).toHaveBeenCalledWith(
      db, 'prod-1', 3, expect.stringContaining('JC-00001'), 'JOB_CARD', 'JC-00001', undefined
    )
    expect(db.jobCardPart.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ jobCardId: 'jc-1', productId: 'prod-1', quantity: 3, unitPrice: 250 }),
    }))
    expect((res as { data: { unitPrice: number } }).data.unitPrice).toBe(250)
  })

  it('translates an insufficient-stock ServiceError (INV-002) into a friendly JCP-004', async () => {
    const db = makePartsMockDb({ id: 'jc-1', jobNumber: 'JC-00001' }, { id: 'prod-1', sellingPrice: 250 })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(inventoryService.reduceStockTx).mockRejectedValue(new ServiceError('INV-002', 'Insufficient stock for product prod-1.'))

    const res = await addJobCardPart({ jobCardId: 'jc-1', productId: 'prod-1', quantity: 100 })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('JCP-004')
  })
})

describe('job-card.service.removeJobCardPart', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a missing part usage record', async () => {
    const db = makePartsMockDb(null, null)
    db.jobCardPart.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await removeJobCardPart('part-missing')
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('JCP-005')
  })

  it('restores the exact quantity to Inventory and writes a REPAIR_RETURN movement, without touching averageCost', async () => {
    const db = makePartsMockDb({ id: 'jc-1', jobNumber: 'JC-00001' }, null)
    db.jobCardPart.findUnique = vi.fn().mockResolvedValue({ id: 'part-1', jobCardId: 'jc-1', productId: 'prod-1', quantity: 3, unitPrice: 250 })
    db.jobCard.findUnique = vi.fn().mockResolvedValue({ jobNumber: 'JC-00001' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await removeJobCardPart('part-1')

    expect(res.success).toBe(true)
    expect(db.inventory.update).toHaveBeenCalledWith({ where: { productId: 'prod-1' }, data: { quantity: { increment: 3 } } })
    expect(db.inventoryMovement.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ productId: 'prod-1', movementType: 'REPAIR_RETURN', quantity: 3 }),
    }))
    // Confirms averageCost is never referenced in the restore path.
    expect(db.inventory.update).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ averageCost: expect.anything() }) }))
    expect(db.jobCardPart.delete).toHaveBeenCalledWith({ where: { id: 'part-1' } })
  })
})
