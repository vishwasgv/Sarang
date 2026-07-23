import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))
vi.mock('../billing.service', () => ({ billingService: { createInvoice: vi.fn() } }))

import { getPrisma } from '../../database/db'
import { billingService } from '../billing.service'
import { generateTicketInvoice } from '../service-ticket.service'

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
