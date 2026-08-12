import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { listTimeEntries, createTimeEntry, updateTimeEntry, generateTimeEntryInvoice, generateInvoiceForServiceProject } from '../time-entry.service'

// Regression coverage for the Phase 28 re-audit finding: TimeEntry.hours/
// ratePerHour/amount are Prisma Decimal fields — Electron's IPC can't
// serialize a Decimal instance and throws "An object could not be cloned"
// on every response that includes one. Live-verified: creating a time entry
// with real hours/rate crashed, though the row was silently written to the
// DB anyway with the correct server-computed amount. A FakeDecimal test
// double (toString/valueOf only, like a real Decimal.js instance) proves
// serializeTimeEntry actually converts every field to a plain number.

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1', employeeId: null, caseId: 'case-1', projectId: null,
    date: new Date(), description: 'Drafting petition',
    hours: new FakeDecimal(3) as unknown as number,
    ratePerHour: new FakeDecimal(2000) as unknown as number,
    amount: new FakeDecimal(6000) as unknown as number,
    isBilled: false, invoiceId: null,
    createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeEntry> | null = null) {
  const db: Record<string, any> = {
    timeEntry: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      findUnique: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeEntry({ id: 'entry-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeEntry({ ...existing, ...data }))
      ),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('time-entry.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createTimeEntry returns hours/ratePerHour/amount as plain numbers', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTimeEntry({ caseId: 'case-1', date: '2026-07-02', description: 'Drafting petition', hours: 3, ratePerHour: 2000 })

    expect(res.success).toBe(true)
    const data = (res as { data: Record<string, unknown> }).data
    expect(typeof data.hours).toBe('number')
    expect(typeof data.ratePerHour).toBe('number')
    expect(typeof data.amount).toBe('number')
  })

  // Real bug found live (2026-07-28 service-vertical audit): plain
  // `Math.round(hours * ratePerHour * 100) / 100` crosses IEEE-754's classic
  // 1.005 boundary wrong — hours=0.5, ratePerHour=2.01 gives a raw product of
  // 1.005, which Math.round(1.005*100)/100 rounds DOWN to 1 instead of 1.01.
  // This amount is baked straight into an invoice's unitPrice by
  // generateTimeEntryInvoice, so the drift compounds into a real invoice.
  it('computes amount correctly at the 1.005 float-rounding boundary', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTimeEntry({ caseId: 'case-1', date: '2026-07-02', description: 'Quick consult', hours: 0.5, ratePerHour: 2.01 })

    expect(res.success).toBe(true)
    const createCall = db.timeEntry.create.mock.calls[0][0] as { data: { amount: number } }
    expect(createCall.data.amount).toBe(1.01)
  })

  it('listTimeEntries returns plain numbers, not Decimal instances', async () => {
    const db = makeMockDb(makeEntry())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listTimeEntries({})

    expect(res.success).toBe(true)
    const data = (res as { data: Array<Record<string, unknown>> }).data
    expect(typeof data[0].hours).toBe('number')
    expect(typeof data[0].amount).toBe('number')
  })

  it('updateTimeEntry returns plain numbers after recomputing amount', async () => {
    const db = makeMockDb(makeEntry())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateTimeEntry({ id: 'entry-1', hours: 5 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { amount: unknown } }).data.amount).toBe('number')
  })
})

// Phase 40 — generateTimeEntryInvoice: aggregates unbilled time entries for
// one client into a single itemized invoice.

function makeCaseEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-1', caseId: 'case-1', projectId: null,
    date: new Date('2026-07-01'), description: 'Drafting petition',
    hours: 3, ratePerHour: 2000, amount: 6000, isBilled: false,
    case: { id: 'case-1', clientId: 'client-1' }, project: null,
    ...overrides,
  }
}

function makeProjectEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'entry-2', caseId: null, projectId: 'proj-1',
    date: new Date('2026-07-02'), description: 'Consulting session',
    hours: 2, ratePerHour: 1500, amount: 3000, isBilled: false,
    case: null, project: { id: 'proj-1', clientId: 'client-1' },
    ...overrides,
  }
}

function makeInvoiceMockDb(entries: Array<Record<string, unknown>>) {
  const product = { id: 'product-1', hsnCode: '998212', productName: 'Legal Advisory Services' }
  return {
    timeEntry: {
      findMany: vi.fn().mockResolvedValue(entries),
      updateMany: vi.fn().mockResolvedValue({ count: entries.length }),
    },
    product: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(product),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
}

describe('time-entry.service — generateTimeEntryInvoice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects an empty selection', async () => {
    const res = await generateTimeEntryInvoice([])
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TE28-006')
  })

  it('rejects when some entries no longer exist', async () => {
    const db = makeInvoiceMockDb([makeCaseEntry()])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateTimeEntryInvoice(['entry-1', 'entry-missing'])
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TE28-007')
  })

  it('rejects when an entry is already billed', async () => {
    const db = makeInvoiceMockDb([makeCaseEntry({ isBilled: true })])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateTimeEntryInvoice(['entry-1'])
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TE28-008')
  })

  it('rejects a freestanding entry with no case or project', async () => {
    const db = makeInvoiceMockDb([makeCaseEntry({ caseId: null, case: null })])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateTimeEntryInvoice(['entry-1'])
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TE28-009')
  })

  it('rejects entries belonging to different clients', async () => {
    const db = makeInvoiceMockDb([
      makeCaseEntry({ case: { id: 'case-1', clientId: 'client-1' } }),
      makeCaseEntry({ id: 'entry-2', case: { id: 'case-2', clientId: 'client-2' } }),
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateTimeEntryInvoice(['entry-1', 'entry-2'])
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TE28-010')
  })

  it('rejects mixing legal-case and project-linked entries', async () => {
    const db = makeInvoiceMockDb([
      makeCaseEntry({ case: { id: 'case-1', clientId: 'client-1' } }),
      makeProjectEntry({ project: { id: 'proj-1', clientId: 'client-1' } }),
    ])
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateTimeEntryInvoice(['entry-1', 'entry-2'])
    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TE28-011')
  })

  it('generates one itemized invoice for homogeneous legal-case entries and marks them billed', async () => {
    const entries = [makeCaseEntry()]
    const db = makeInvoiceMockDb(entries)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-1' } } as never)

    const res = await generateTimeEntryInvoice(['entry-1'])

    expect(res.success).toBe(true)
    expect((res as { data: { invoiceId: string } }).data.invoiceId).toBe('invoice-1')
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'client-1',
      items: [expect.objectContaining({ productId: 'product-1', unitPrice: 6000 })],
    }))
    // Atomic claim happens first (guards against a concurrent double-invoke)...
    expect(db.timeEntry.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['entry-1'] }, isBilled: false, invoiceId: null },
      data: { invoiceId: 'PENDING_INVOICE_GENERATION' },
    })
    // ...then finalized with the real invoice id once billing succeeds.
    expect(db.timeEntry.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['entry-1'] } },
      data: { isBilled: true, invoiceId: 'invoice-1' },
    })
  })

  // Regression for a real bug found 2026-07-22: taxRate used to be
  // hardcoded on the invoice item, permanently overriding the product's
  // own configurable rate.
  it('does not hardcode a taxRate override on the item — falls through to the product\'s own configurable rate', async () => {
    const entries = [makeCaseEntry()]
    const db = makeInvoiceMockDb(entries)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-1' } } as never)

    await generateTimeEntryInvoice(['entry-1'])

    const call = vi.mocked(billingService.createInvoice).mock.calls[0][0]
    expect(call.items[0]).not.toHaveProperty('taxRate')
  })

  it('deduplicates repeated ids in the selection before claiming', async () => {
    const entries = [makeCaseEntry()]
    const db = makeInvoiceMockDb(entries)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'invoice-1' } } as never)

    const res = await generateTimeEntryInvoice(['entry-1', 'entry-1'])

    expect(res.success).toBe(true)
    expect(db.timeEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { in: ['entry-1'] } }) }))
  })

  it('rejects the batch and releases its claim when a concurrent call wins the race', async () => {
    // Simulates two near-simultaneous generate calls for the same entry: the
    // pre-claim findMany still sees it as unbilled (stale snapshot), but by
    // the time this call's atomic claim UPDATE runs, a concurrent winner has
    // already flipped isBilled/invoiceId — so the claim's WHERE clause
    // matches 0 rows instead of 1.
    const db = makeInvoiceMockDb([makeCaseEntry()])
    db.timeEntry.updateMany = vi.fn()
      .mockResolvedValueOnce({ count: 0 }) // claim attempt: lost the race
      .mockResolvedValue({ count: 0 })     // release-of-our-own-claim call (no-op, we claimed nothing)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateTimeEntryInvoice(['entry-1'])

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('TE28-008')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })

  it('propagates a billing failure without marking entries billed, and releases the claim', async () => {
    const db = makeInvoiceMockDb([makeCaseEntry()])
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'BILL-001', message: 'no stock' } } as never)

    const res = await generateTimeEntryInvoice(['entry-1'])

    expect(res.success).toBe(false)
    // Claimed, then released — never finalized with isBilled:true.
    expect(db.timeEntry.updateMany).not.toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isBilled: true }) }))
    expect(db.timeEntry.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['entry-1'] } }, data: { invoiceId: null } })
  })
})

// Phase 63 — ServiceProject.billingMethod-aware invoicing.
describe('generateInvoiceForServiceProject', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeProjectDb(overrides: Record<string, unknown> = {}) {
    const db: Record<string, any> = {
      serviceProject: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'sp-1', clientId: 'cust-1', projectName: 'Website Revamp', billingMethod: 'FIXED_COST', totalContractValue: new FakeDecimal(50000)
        })
      },
      product: {
        findFirst: vi.fn().mockResolvedValue({ id: 'prod-svc', hsnCode: '998311' }),
        create: vi.fn().mockResolvedValue({ id: 'prod-svc-new' })
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
      timeEntry: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      ...overrides
    }
    return db
  }

  it('returns an error for a non-existent service project', async () => {
    const db = makeProjectDb({ serviceProject: { findUnique: vi.fn().mockResolvedValue(null) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await generateInvoiceForServiceProject({ serviceProjectId: 'ghost' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SP-001')
  })

  it('FIXED_COST bills the full contract value as a single line, quantity 1', async () => {
    const db = makeProjectDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)
    const res = await generateInvoiceForServiceProject({ serviceProjectId: 'sp-1' })

    expect(res.success).toBe(true)
    const createCall = vi.mocked(billingService.createInvoice).mock.calls[0][0] as { items: Array<{ quantity: number; unitPrice: number }> }
    expect(createCall.items[0]).toMatchObject({ quantity: 1, unitPrice: 50000 })
  })

  it('HOURLY requires explicit timeEntryIds and delegates to generateTimeEntryInvoice', async () => {
    const db = makeProjectDb({ serviceProject: { findUnique: vi.fn().mockResolvedValue({ id: 'sp-1', clientId: 'cust-1', projectName: 'Retainer Work', billingMethod: 'HOURLY', totalContractValue: null }) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const resNoEntries = await generateInvoiceForServiceProject({ serviceProjectId: 'sp-1' })
    expect(resNoEntries.success).toBe(false)
    expect((resNoEntries as { error: { code: string } }).error.code).toBe('SP-002')
  })

  it('a DAILY_* method requires an explicit dayCount, and bills contractValue × dayCount', async () => {
    const db = makeProjectDb({ serviceProject: { findUnique: vi.fn().mockResolvedValue({ id: 'sp-1', clientId: 'cust-1', projectName: 'Consulting Sprint', billingMethod: 'DAILY_PER_PROJECT', totalContractValue: new FakeDecimal(3000) }) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-2' } } as never)

    const resNoDayCount = await generateInvoiceForServiceProject({ serviceProjectId: 'sp-1' })
    expect(resNoDayCount.success).toBe(false)
    expect((resNoDayCount as { error: { code: string } }).error.code).toBe('SP-004')

    const res = await generateInvoiceForServiceProject({ serviceProjectId: 'sp-1', dayCount: 5 })
    expect(res.success).toBe(true)
    const createCall = vi.mocked(billingService.createInvoice).mock.calls[0][0] as { items: Array<{ quantity: number; unitPrice: number }> }
    expect(createCall.items[0]).toMatchObject({ quantity: 5, unitPrice: 3000 })
  })

  it('rejects a FIXED_COST project with no contract value set', async () => {
    const db = makeProjectDb({ serviceProject: { findUnique: vi.fn().mockResolvedValue({ id: 'sp-1', clientId: 'cust-1', projectName: 'No Value Set', billingMethod: 'FIXED_COST', totalContractValue: null }) } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const res = await generateInvoiceForServiceProject({ serviceProjectId: 'sp-1' })

    expect(res.success).toBe(false)
    expect((res as { error: { code: string } }).error.code).toBe('SP-003')
  })
})
