import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { listRetainers, createRetainer, updateRetainer, generateInvoiceForRetainer } from '../retainer.service'

// Regression coverage for two Phase 30 re-audit findings on
// retainer.service.ts:
//
// 1. Decimal serialization — RetainerAgreement.monthlyAmount (non-nullable)
//    and hoursPerMonth (nullable) are Prisma Decimal fields, returned
//    unserialized by listRetainers/createRetainer/updateRetainer. Electron's
//    IPC can't serialize a Decimal instance and throws "An object could not
//    be cloned". Live-verified: creating a retainer with a real
//    monthlyAmount crashed (row silently written to the DB anyway).
//
// 2. Reminder dedup precision — scheduleRetainerReminder matched on
//    `retainerId.slice(-6)` — a bare 6-character substring embedded in the
//    notification body. Since NotificationQueue has no column linking back
//    to a RetainerAgreement (these are firm-internal reminders with
//    customerId always null), a coincidental 6-character collision between
//    two retainers' cuids could misfire the delete. Fixed by embedding and
//    matching on the full cuid instead (same fix pattern as Phase 29's
//    compliance-task.service.ts).

class FakeDecimal {
  constructor(private value: number) {}
  toString() { return String(this.value) }
  valueOf() { return this.value }
}

function makeRetainer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ret-abc123', clientId: 'cust-1', assignedToId: null,
    title: 'Monthly Compliance Retainer', retainerType: 'FIXED_FEE', status: 'ACTIVE',
    monthlyAmount: new FakeDecimal(20000) as unknown as number,
    billingDay: 5,
    hoursPerMonth: new FakeDecimal(10) as unknown as number,
    deliverables: null,
    startDate: new Date(), endDate: null, notes: null,
    createdAt: new Date(), updatedAt: new Date(),
    client: { id: 'cust-1', customerName: 'Acme Corp', phone: null },
    ...overrides,
  }
}

function makeMockDb(existing: ReturnType<typeof makeRetainer> | null = null) {
  const db: Record<string, any> = {
    retainerAgreement: {
      findMany: vi.fn().mockResolvedValue(existing ? [existing] : []),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeRetainer({ id: 'ret-abc123', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeRetainer({ ...existing, ...data }))
      ),
    },
    notificationQueue: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
    },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
  }
  return db
}

describe('retainer.service — Decimal serialization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('createRetainer returns monthlyAmount and hoursPerMonth as plain numbers', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createRetainer({
      clientId: 'cust-1', title: 'Monthly Compliance Retainer',
      monthlyAmount: 20000, hoursPerMonth: 10, startDate: '2026-01-01',
    })

    expect(res.success).toBe(true)
    const data = (res as { data: { monthlyAmount: unknown; hoursPerMonth: unknown } }).data
    expect(typeof data.monthlyAmount).toBe('number')
    expect(typeof data.hoursPerMonth).toBe('number')
  })

  it('createRetainer returns hoursPerMonth as null when unset, not a Decimal', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    db.retainerAgreement.create = vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(makeRetainer({ id: 'ret-abc123', ...data, hoursPerMonth: null }))
    )

    const res = await createRetainer({
      clientId: 'cust-1', title: 'Fixed Fee Only', monthlyAmount: 15000, startDate: '2026-01-01',
    })

    expect(res.success).toBe(true)
    expect((res as { data: { hoursPerMonth: unknown } }).data.hoursPerMonth).toBeNull()
  })

  it('listRetainers returns monthlyAmount as a plain number, not a Decimal instance', async () => {
    const db = makeMockDb(makeRetainer())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listRetainers({})

    expect(res.success).toBe(true)
    expect(typeof (res as { data: Array<{ monthlyAmount: unknown }> }).data[0].monthlyAmount).toBe('number')
  })

  it('updateRetainer returns monthlyAmount as a plain number', async () => {
    const db = makeMockDb(makeRetainer())
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateRetainer({ id: 'ret-abc123', monthlyAmount: 25000 })

    expect(res.success).toBe(true)
    expect(typeof (res as { data: { monthlyAmount: unknown } }).data.monthlyAmount).toBe('number')
  })
})

describe('retainer.service — reminder dedup precision', () => {
  beforeEach(() => vi.clearAllMocks())

  it('matches and embeds the full retainer id, not a 6-character slice', async () => {
    const db = makeMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createRetainer({
      clientId: 'cust-1', title: 'Monthly Compliance Retainer',
      monthlyAmount: 20000, startDate: '2026-01-01',
    })
    // scheduleRetainerReminder fires fire-and-forget; flush microtasks
    await new Promise((r) => setTimeout(r, 0))

    expect(db.notificationQueue.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ templateBody: { contains: '[ret-abc123]' } }),
      })
    )
  })
})

// ─── Invoice Generation (Phase 54B) ────────────────────────────────────────
// Before this, RetainerAgreement had NO invoice-generation path at all —
// scheduleRetainerReminder only ever sent a "please generate the invoice"
// notification. generateInvoiceForRetainer closes that gap, using a
// per-period (YYYY-MM) claim instead of a one-off nullable invoiceId since a
// retainer recurs every month.

describe('retainer.service — generateInvoiceForRetainer', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeDbForInvoice(retainer: ReturnType<typeof makeRetainer>) {
    const db: Record<string, any> = {
      retainerAgreement: {
        findUnique: vi.fn().mockResolvedValue(retainer),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({}),
      },
      product: {
        findFirst: vi.fn().mockResolvedValue({ id: 'prod-consulting' }),
        create: vi.fn().mockResolvedValue({ id: 'prod-consulting' }),
      },
      auditLog: { create: vi.fn().mockResolvedValue({}) },
    }
    return db
  }

  it('generates an invoice for the current period and claims lastInvoicedPeriod atomically', async () => {
    const retainer = makeRetainer({ lastInvoicedPeriod: null })
    const db = makeDbForInvoice(retainer)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)

    const res = await generateInvoiceForRetainer('ret-abc123', '2026-07')

    expect(res.success).toBe(true)
    expect((res as { data: { invoiceId: string; period: string } }).data).toEqual({ invoiceId: 'inv-1', period: '2026-07' })
    expect(db.retainerAgreement.updateMany).toHaveBeenCalledWith({
      where: { id: 'ret-abc123', lastInvoicedPeriod: null },
      data: { lastInvoicedPeriod: '2026-07' },
    })
    expect(billingService.createInvoice).toHaveBeenCalledWith(expect.objectContaining({
      customerId: 'cust-1',
      items: [expect.objectContaining({ unitPrice: 20000 })],
    }))
  })

  it('refuses to invoice the same period twice', async () => {
    const retainer = makeRetainer({ lastInvoicedPeriod: '2026-07' })
    const db = makeDbForInvoice(retainer)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateInvoiceForRetainer('ret-abc123', '2026-07')

    expect(res.success).toBe(false)
    expect(db.retainerAgreement.updateMany).not.toHaveBeenCalled()
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })

  it('rolls back lastInvoicedPeriod to its prior value if invoice creation fails', async () => {
    const retainer = makeRetainer({ lastInvoicedPeriod: '2026-06' })
    const db = makeDbForInvoice(retainer)
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { message: 'boom' } } as never)

    const res = await generateInvoiceForRetainer('ret-abc123', '2026-07')

    expect(res.success).toBe(false)
    expect(db.retainerAgreement.update).toHaveBeenCalledWith({ where: { id: 'ret-abc123' }, data: { lastInvoicedPeriod: '2026-06' } })
  })

  it('returns an error when the retainer does not exist', async () => {
    const db = makeDbForInvoice(null as never)
    db.retainerAgreement.findUnique = vi.fn().mockResolvedValue(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateInvoiceForRetainer('ret-missing', '2026-07')

    expect(res.success).toBe(false)
  })
})
