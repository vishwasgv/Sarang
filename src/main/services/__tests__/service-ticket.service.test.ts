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
  const db: Record<string, any> = {
    serviceTicket: {
      findUnique: vi.fn().mockResolvedValue(ticket),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ ...ticket, ...data })),
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
})
