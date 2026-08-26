import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { generateTicketInvoice, createTicket, getQuoteToJobConversionStats } from '../service-ticket.service'

// Phase 58 §1 (2026-07-17) — legacy Service/Consultant invoicing bridge.
// Unlike Project/JobCard, ServiceTicket has no stored monetary field at all
// (nor does its linked WorkLog — hours only, no rate), so the caller must
// supply the billable amount explicitly. These tests cover that the amount
// is validated and actually used, independent of any DB-derived figure.

function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tkt-1', ticketNumber: 'TKT-00001', title: 'Server outage investigation',
    customerId: 'cust-1', invoiceId: null,
    ...overrides,
  }
}

function makeMockDb(ticket: ReturnType<typeof makeTicket> | null, opts: { existingProduct?: { id: string } | null } = {}) {
  let currentInvoiceId: string | null = ticket?.invoiceId ?? null
  const db: Record<string, any> = {
    serviceTicket: {
      findUnique: vi.fn().mockImplementation(() => Promise.resolve(ticket ? { ...ticket, invoiceId: currentInvoiceId } : null)),
      // Regression for a real double-invoice race found 2026-07-22:
      // generateTicketInvoice now atomically claims the ticket
      // (updateMany where invoiceId: null) before doing any real work —
      // mirror that claim/release lifecycle here so tests exercise the
      // actual guard, not a bypass.
      updateMany: vi.fn().mockImplementation(({ where }: { where: { invoiceId: null } }) => {
        if (currentInvoiceId !== null) return Promise.resolve({ count: 0 })
        currentInvoiceId = 'CLAIMING'
        return Promise.resolve({ count: 1 })
      }),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
        if ('invoiceId' in data) currentInvoiceId = data.invoiceId as string | null
        return Promise.resolve({ ...ticket, ...data })
      }),
    },
    product: {
      findFirst: vi.fn().mockResolvedValue(opts.existingProduct ?? null),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'prod-new', ...data })),
    },
  }
  return db
}

describe('service-ticket.service.generateTicketInvoice', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a zero or negative amount before even looking up the ticket', async () => {
    const res = await generateTicketInvoice('tkt-1', 0)

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('TKT-004')
    expect(vi.mocked(getPrisma)).not.toHaveBeenCalled()
  })

  it('fails when the ticket has no linked customer', async () => {
    const ticket = makeTicket({ customerId: null })
    vi.mocked(getPrisma).mockReturnValue(makeMockDb(ticket) as never)

    const res = await generateTicketInvoice('tkt-1', 5000)

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('TKT-006')
  })

  it('fails when an invoice was already generated for this ticket', async () => {
    const ticket = makeTicket({ invoiceId: 'inv-existing' })
    vi.mocked(getPrisma).mockReturnValue(makeMockDb(ticket) as never)

    const res = await generateTicketInvoice('tkt-1', 5000)

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('TKT-007')
  })

  it('bills exactly the caller-supplied amount, since no field on the model itself holds one', async () => {
    const ticket = makeTicket()
    const db = makeMockDb(ticket, { existingProduct: { id: 'prod-consulting' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)

    const res = await generateTicketInvoice('tkt-1', 7500)

    expect(res.success).toBe(true)
    const call = vi.mocked(billingService.createInvoice).mock.calls[0][0] as { items: Array<{ unitPrice: number }> }
    expect(call.items[0].unitPrice).toBe(7500)
    expect(db.serviceTicket.update).toHaveBeenCalledWith({ where: { id: 'tkt-1' }, data: { invoiceId: 'inv-1' } })
  })

  // Regression for a real bug found 2026-07-22: `taxRate: 18` used to be
  // hardcoded on the invoice ITEM, permanently overriding the product's own
  // configurable rate — the same bug class fixed across 13 other vertical
  // services this session.
  it('does not hardcode a taxRate override on the item — falls through to the product\'s own configurable rate', async () => {
    const ticket = makeTicket()
    const db = makeMockDb(ticket, { existingProduct: { id: 'prod-consulting' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: true, data: { id: 'inv-1' } } as never)

    await generateTicketInvoice('tkt-1', 7500)

    const call = vi.mocked(billingService.createInvoice).mock.calls[0][0] as { items: Array<Record<string, unknown>> }
    expect(call.items[0]).not.toHaveProperty('taxRate')
  })

  // Regression for a real double-invoice race found 2026-07-22: the old
  // code checked `ticket.invoiceId` then wrote it later with no atomic
  // claim in between.
  it('rejects a concurrent second call while the first call\'s invoice generation is still in progress', async () => {
    const ticket = makeTicket()
    const db = makeMockDb(ticket, { existingProduct: { id: 'prod-consulting' } })
    // Simulate the claim already being held by another in-flight call.
    db.serviceTicket.updateMany = vi.fn().mockResolvedValue({ count: 0 })
    db.serviceTicket.findUnique = vi.fn().mockResolvedValue({ ...ticket, invoiceId: 'CLAIMING' })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await generateTicketInvoice('tkt-1', 7500)

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('TKT-008')
    expect(billingService.createInvoice).not.toHaveBeenCalled()
  })

  it('releases the claim if billing invoice creation fails', async () => {
    const ticket = makeTicket()
    const db = makeMockDb(ticket, { existingProduct: { id: 'prod-consulting' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)
    vi.mocked(billingService.createInvoice).mockResolvedValue({ success: false, error: { code: 'INVOC-001', message: 'boom' } } as never)

    const res = await generateTicketInvoice('tkt-1', 7500)

    expect(res.success).toBe(false)
    expect(db.serviceTicket.update).toHaveBeenCalledWith({ where: { id: 'tkt-1' }, data: { invoiceId: null } })
  })
})

// Phase 67 §9.1 — Service items 1 (SLA timer) and 5 (quote-to-job conversion).
function makeCreateMockDb(quotation: { status: string; serviceTicket: { id: string } | null } | null = null) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    quotation: {
      findUnique: vi.fn().mockResolvedValue(quotation),
      count: vi.fn().mockResolvedValue(0),
    },
    serviceTicket: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'tkt-new', status: 'OPEN', createdAt: new Date(), updatedAt: new Date(), ...data, customer: null, assignedTo: null, quotation: null })
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

describe('service-ticket.service.createTicket', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets slaDueAt from priority — URGENT gets the shortest window', async () => {
    const db = makeCreateMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const before = Date.now()

    const res = await createTicket({ title: 'Server down', priority: 'URGENT' })

    expect(res.success).toBe(true)
    const call = db.serviceTicket.create.mock.calls[0][0] as { data: { slaDueAt: Date } }
    const hoursUntilDue = (call.data.slaDueAt.getTime() - before) / (60 * 60 * 1000)
    expect(hoursUntilDue).toBeCloseTo(4, 1)
  })

  it('gives a LOW priority ticket the longest SLA window', async () => {
    const db = makeCreateMockDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)
    const before = Date.now()

    await createTicket({ title: 'Minor cosmetic issue', priority: 'LOW' })

    const call = db.serviceTicket.create.mock.calls[0][0] as { data: { slaDueAt: Date } }
    const hoursUntilDue = (call.data.slaDueAt.getTime() - before) / (60 * 60 * 1000)
    expect(hoursUntilDue).toBeCloseTo(168, 1)
  })

  it('links a ticket to an ACCEPTED, unconverted quotation', async () => {
    const db = makeCreateMockDb({ status: 'ACCEPTED', serviceTicket: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTicket({ title: 'Install new AC unit', quotationId: 'quo-1' })

    expect(res.success).toBe(true)
    expect(db.serviceTicket.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ quotationId: 'quo-1' }),
    }))
  })

  it('rejects converting a quotation that is not ACCEPTED', async () => {
    const db = makeCreateMockDb({ status: 'DRAFT', serviceTicket: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTicket({ title: 'Install new AC unit', quotationId: 'quo-1' })

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('TKT-010')
  })

  it('rejects converting a quotation that was already converted to another ticket', async () => {
    const db = makeCreateMockDb({ status: 'ACCEPTED', serviceTicket: { id: 'tkt-existing' } })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTicket({ title: 'Install new AC unit', quotationId: 'quo-1' })

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('TKT-011')
  })

  it('rejects a quotation that does not exist', async () => {
    const db = makeCreateMockDb(null)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createTicket({ title: 'Install new AC unit', quotationId: 'ghost' })

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('TKT-009')
  })
})

describe('service-ticket.service.getQuoteToJobConversionStats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('computes the conversion rate from accepted quotations to linked tickets', async () => {
    const db = makeCreateMockDb()
    db.quotation.count = vi.fn()
      .mockResolvedValueOnce(10) // acceptedCount
      .mockResolvedValueOnce(4)  // convertedCount
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getQuoteToJobConversionStats()

    expect(res.success).toBe(true)
    expect(res.data).toEqual({ acceptedQuotations: 10, convertedToTicket: 4, conversionRatePercent: 40 })
  })

  it('reports an honest zero rate when there are no accepted quotations at all', async () => {
    const db = makeCreateMockDb()
    db.quotation.count = vi.fn().mockResolvedValue(0)
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getQuoteToJobConversionStats()

    expect(res.data?.conversionRatePercent).toBe(0)
  })
})
