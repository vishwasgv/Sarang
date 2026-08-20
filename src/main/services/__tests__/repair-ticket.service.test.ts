import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import {
  createRepairTicket, listRepairTickets, getRepairTicket,
  getSerialServiceHistory, lookupSerialService, updateRepairTicketStatus,
  recordVendorClaim, recordVendorRecovery, writeOffVendorClaim
} from '../repair-ticket.service'

function makeSerial(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ser-1', productId: 'prod-1', serialNumber: 'SN-001', imeiNumber: null,
    status: 'SOLD', invoiceId: 'inv-1', warrantyExpiryDate: null,
    ...overrides,
  }
}

function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rt-1', claimNumber: 'RMA-00001', serialId: 'ser-1', productId: 'prod-1',
    customerId: 'cust-1', issueDescription: 'Screen cracked', status: 'RECEIVED',
    receivedDate: new Date('2026-07-01T00:00:00Z'), deliveredDate: null,
    vendorId: null, vendorRmaNumber: null, sentToVendorDate: null, vendorResponseDate: null, vendorSlaDueDate: null,
    vendorClaimAmount: null, vendorRecoveredAmount: 0, vendorClaimClosedAt: null,
    replacementSerialId: null, repairCost: null, notes: null, createdById: 'user-1',
    createdAt: new Date('2026-07-01T00:00:00Z'), updatedAt: new Date('2026-07-01T00:00:00Z'),
    serial: { id: 'ser-1', serialNumber: 'SN-001', imeiNumber: null, status: 'SOLD', warrantyExpiryDate: null },
    replacementSerial: null,
    product: { id: 'prod-1', productName: 'Galaxy S24' },
    customer: { id: 'cust-1', customerName: 'Ramesh Kumar', phone: '9990001111' },
    vendor: null,
    ...overrides,
  }
}

function makeMockDb(opts: { serial?: ReturnType<typeof makeSerial> | null; ticket?: ReturnType<typeof makeTicket> | null; replacementSerial?: ReturnType<typeof makeSerial> | null } = {}) {
  let settingRow: { settingKey: string; settingValue: string } | null = null
  const db: Record<string, any> = {
    productSerial: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id: string } }) => {
        if (opts.replacementSerial && where.id === opts.replacementSerial.id) return Promise.resolve(opts.replacementSerial)
        if (opts.serial && where.id === opts.serial.id) return Promise.resolve(opts.serial)
        return Promise.resolve(null)
      }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    repairTicket: {
      findUnique: vi.fn().mockImplementation(({ where }: { where: { id?: string; replacementSerialId?: string } }) => {
        if (where.id) return Promise.resolve(opts.ticket && opts.ticket.id === where.id ? opts.ticket : null)
        if (where.replacementSerialId) return Promise.resolve(null)
        return Promise.resolve(null)
      }),
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue(opts.ticket ? [opts.ticket] : []),
      count: vi.fn().mockResolvedValue(opts.ticket ? 1 : 0),
      create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeTicket({ id: 'rt-new', ...data }))
      ),
      update: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(makeTicket({ ...opts.ticket, ...data }))
      ),
    },
    inventory: {
      upsert: vi.fn().mockResolvedValue({}),
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

describe('repairTicketService.createRepairTicket', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a serial that has never been sold', async () => {
    const db = makeMockDb({ serial: makeSerial({ status: 'AVAILABLE' }) })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createRepairTicket({ serialId: 'ser-1', issueDescription: 'Not turning on' })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RPR-002')
  })

  it('rejects when the serial does not exist', async () => {
    const db = makeMockDb({ serial: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createRepairTicket({ serialId: 'nope', issueDescription: 'x' })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RPR-001')
  })

  it('creates a ticket with a generated claim number for a sold unit', async () => {
    const db = makeMockDb({ serial: makeSerial() })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await createRepairTicket({ serialId: 'ser-1', customerId: 'cust-1', issueDescription: 'Screen cracked' })
    expect(res.success).toBe(true)
    expect(res.data?.claimNumber).toBe('RMA-00001')
    expect(db.repairTicket.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ serialId: 'ser-1', productId: 'prod-1', status: 'RECEIVED' })
    }))
  })

  // Phase 67 §9.1 — Electronics: repair turnaround by technician.
  it('passes technicianId through to the created ticket when provided at intake', async () => {
    const db = makeMockDb({ serial: makeSerial() })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await createRepairTicket({ serialId: 'ser-1', issueDescription: 'Screen cracked', technicianId: 'tech-1' })
    expect(db.repairTicket.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ technicianId: 'tech-1' })
    }))
  })
})

describe('repairTicketService.listRepairTickets / getRepairTicket / getSerialServiceHistory', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists tickets and returns the turnaround field', async () => {
    const db = makeMockDb({ ticket: makeTicket() })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listRepairTickets({})
    expect(res.success).toBe(true)
    expect(res.data?.tickets).toHaveLength(1)
    expect(res.data?.tickets[0].claimNumber).toBe('RMA-00001')
    expect(typeof res.data?.tickets[0].turnaroundDays).toBe('number')
  })

  it('getRepairTicket returns not-found for a missing id', async () => {
    const db = makeMockDb({ ticket: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getRepairTicket('missing')
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RPR-005')
  })

  // Phase 67 §9.1 — Electronics: RMA SLA tracker.
  it('returns isOverdue false and daysWithVendor null for a ticket never sent to vendor', async () => {
    const db = makeMockDb({ ticket: makeTicket({ status: 'DIAGNOSED' }) })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listRepairTickets({})
    expect(res.data?.tickets[0].isOverdue).toBe(false)
    expect(res.data?.tickets[0].daysWithVendor).toBeNull()
  })

  it('returns isOverdue true for a SENT_TO_VENDOR ticket past its SLA due date', async () => {
    const ticket = makeTicket({
      status: 'SENT_TO_VENDOR',
      sentToVendorDate: new Date('2026-01-01T00:00:00Z'),
      vendorSlaDueDate: new Date('2026-01-31T00:00:00Z'),
    })
    const db = makeMockDb({ ticket })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listRepairTickets({})
    expect(res.data?.tickets[0].isOverdue).toBe(true)
    expect(typeof res.data?.tickets[0].daysWithVendor).toBe('number')
  })

  it('returns isOverdue false for a returned ticket even if it came back after its SLA due date', async () => {
    const ticket = makeTicket({
      status: 'RETURNED_TO_CUSTOMER',
      sentToVendorDate: new Date('2026-01-01T00:00:00Z'),
      vendorResponseDate: new Date('2026-02-15T00:00:00Z'),
      vendorSlaDueDate: new Date('2026-01-31T00:00:00Z'),
      deliveredDate: new Date('2026-02-16T00:00:00Z'),
    })
    const db = makeMockDb({ ticket })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listRepairTickets({})
    expect(res.data?.tickets[0].isOverdue).toBe(false)
  })

  it('freezes daysWithVendor once vendorResponseDate is set, instead of counting to today', async () => {
    const ticket = makeTicket({
      status: 'AWAITING_PARTS',
      sentToVendorDate: new Date('2026-01-01T00:00:00Z'),
      vendorResponseDate: new Date('2026-01-11T00:00:00Z'),
    })
    const db = makeMockDb({ ticket })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await listRepairTickets({})
    expect(res.data?.tickets[0].daysWithVendor).toBe(10)
  })

  it('getSerialServiceHistory returns every ticket opened against that serial', async () => {
    const db = makeMockDb({ ticket: makeTicket() })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSerialServiceHistory('ser-1')
    expect(res.success).toBe(true)
    expect(res.data?.tickets).toHaveLength(1)
    expect(res.data?.replacedOnTicket).toBeNull()
  })
})

// Phase 67 §9.1 — Electronics: serial-number service lookup.
describe('repairTicketService.lookupSerialService', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeLookupSerial(overrides: Record<string, unknown> = {}) {
    return {
      id: 'ser-1', productId: 'prod-1', serialNumber: 'SN-001', imeiNumber: '111111111111111', imei2Number: null,
      status: 'SOLD', invoiceId: 'inv-1', warrantyExpiryDate: null,
      product: { id: 'prod-1', productName: 'Galaxy S24' },
      ...overrides,
    }
  }

  function makeLookupDb(opts: { serial?: ReturnType<typeof makeLookupSerial> | null; invoice?: Record<string, unknown> | null; tickets?: unknown[] } = {}) {
    return {
      productSerial: { findFirst: vi.fn().mockResolvedValue(opts.serial ?? null) },
      invoice: { findUnique: vi.fn().mockResolvedValue(opts.invoice ?? null) },
      repairTicket: {
        findMany: vi.fn().mockResolvedValue(opts.tickets ?? []),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    }
  }

  it('rejects an empty search term', async () => {
    const db = makeLookupDb()
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await lookupSerialService('   ')
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RPR-024')
  })

  it('returns not-found when no serial matches by serial number or either IMEI', async () => {
    const db = makeLookupDb({ serial: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await lookupSerialService('NOPE')
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RPR-025')
  })

  it('searches by serial number, IMEI, or IMEI2 in a single query', async () => {
    const db = makeLookupDb({ serial: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await lookupSerialService('123456789012345')
    expect(db.productSerial.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ serialNumber: '123456789012345' }, { imeiNumber: '123456789012345' }, { imei2Number: '123456789012345' }] }
    }))
  })

  it('returns purchase info from the linked invoice when the serial has been sold', async () => {
    const db = makeLookupDb({
      serial: makeLookupSerial(),
      invoice: {
        id: 'inv-1', invoiceNumber: 'INV-00001', invoiceDate: new Date('2026-06-01T00:00:00Z'),
        customer: { customerName: 'Ramesh Kumar', phone: '9990001111' },
        items: [{ unitPrice: 25000 }]
      }
    })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await lookupSerialService('SN-001')
    expect(res.success).toBe(true)
    expect(res.data?.purchase).toEqual({
      invoiceId: 'inv-1', invoiceNumber: 'INV-00001', invoiceDate: new Date('2026-06-01T00:00:00Z').toISOString(),
      customerName: 'Ramesh Kumar', customerPhone: '9990001111', unitPrice: 25000
    })
  })

  it('returns null purchase info when the serial was never sold', async () => {
    const db = makeLookupDb({ serial: makeLookupSerial({ invoiceId: null }) })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await lookupSerialService('SN-001')
    expect(res.success).toBe(true)
    expect(res.data?.purchase).toBeNull()
  })

  it('includes the full repair ticket history for the resolved serial', async () => {
    const db = makeLookupDb({ serial: makeLookupSerial({ invoiceId: null }), tickets: [makeTicket()] })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await lookupSerialService('SN-001')
    expect(res.success).toBe(true)
    expect(res.data?.tickets).toHaveLength(1)
    expect(res.data?.tickets[0].claimNumber).toBe('RMA-00001')
  })
})

describe('repairTicketService.updateRepairTicketStatus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects a transition not allowed by the status table', async () => {
    const ticket = makeTicket({ status: 'RETURNED_TO_CUSTOMER' })
    const db = makeMockDb({ ticket, serial: makeSerial() })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateRepairTicketStatus({ id: 'rt-1', status: 'DIAGNOSED' })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RPR-009')
  })

  it('allows a normal forward transition (RECEIVED -> DIAGNOSED)', async () => {
    const ticket = makeTicket({ status: 'RECEIVED' })
    const db = makeMockDb({ ticket, serial: makeSerial() })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateRepairTicketStatus({ id: 'rt-1', status: 'DIAGNOSED' })
    expect(res.success).toBe(true)
    expect(db.productSerial.update).not.toHaveBeenCalled()
  })

  // Phase 67 §9.1 — Electronics: repair turnaround by technician. Assignable
  // via a same-status no-op transition, independent of the status-advance
  // flow — mirrors how vendorRmaNumber can be re-saved this same way.
  it('reassigns technicianId via a same-status no-op transition', async () => {
    const ticket = makeTicket({ status: 'DIAGNOSED', technicianId: null })
    const db = makeMockDb({ ticket, serial: makeSerial() })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateRepairTicketStatus({ id: 'rt-1', status: 'DIAGNOSED', technicianId: 'tech-1' })
    expect(res.success).toBe(true)
    expect(db.repairTicket.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ technicianId: 'tech-1' })
    }))
  })

  it('keeps the existing technicianId when not provided on an update', async () => {
    const ticket = makeTicket({ status: 'DIAGNOSED', technicianId: 'tech-1' })
    const db = makeMockDb({ ticket, serial: makeSerial() })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateRepairTicketStatus({ id: 'rt-1', status: 'SENT_TO_VENDOR', vendorId: 'sup-1' })
    expect(db.repairTicket.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ technicianId: 'tech-1' })
    }))
  })

  it('stamps sentToVendorDate exactly once on SENT_TO_VENDOR', async () => {
    const ticket = makeTicket({ status: 'DIAGNOSED' })
    const db = makeMockDb({ ticket, serial: makeSerial() })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateRepairTicketStatus({ id: 'rt-1', status: 'SENT_TO_VENDOR', vendorId: 'sup-1', vendorRmaNumber: 'VRMA-1' })
    expect(db.repairTicket.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sentToVendorDate: expect.any(Date) })
    }))
  })

  // Phase 67 §9.1 — Electronics: RMA SLA tracker.
  it('sets vendorSlaDueDate to 30 days out on SENT_TO_VENDOR', async () => {
    const ticket = makeTicket({ status: 'DIAGNOSED' })
    const db = makeMockDb({ ticket, serial: makeSerial() })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const before = Date.now()
    await updateRepairTicketStatus({ id: 'rt-1', status: 'SENT_TO_VENDOR', vendorId: 'sup-1', vendorRmaNumber: 'VRMA-1' })

    const call = db.repairTicket.update.mock.calls[0][0] as { data: { vendorSlaDueDate: Date } }
    const deltaDays = (call.data.vendorSlaDueDate.getTime() - before) / (1000 * 60 * 60 * 24)
    expect(deltaDays).toBeGreaterThan(29.99)
    expect(deltaDays).toBeLessThan(30.01)
  })

  it('does not re-stamp vendorSlaDueDate on a later transition once already sent to vendor', async () => {
    const existingDue = new Date('2026-08-01T00:00:00Z')
    const ticket = makeTicket({ status: 'SENT_TO_VENDOR', sentToVendorDate: new Date('2026-07-02T00:00:00Z'), vendorSlaDueDate: existingDue })
    const db = makeMockDb({ ticket, serial: makeSerial() })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateRepairTicketStatus({ id: 'rt-1', status: 'AWAITING_PARTS' })

    const call = db.repairTicket.update.mock.calls[0][0] as { data: { vendorSlaDueDate: Date } }
    expect(call.data.vendorSlaDueDate).toEqual(existingDue)
  })

  it('REPLACED requires a replacementSerialId', async () => {
    const ticket = makeTicket({ status: 'DIAGNOSED' })
    const db = makeMockDb({ ticket, serial: makeSerial() })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateRepairTicketStatus({ id: 'rt-1', status: 'REPLACED' })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RPR-010')
  })

  it('REPLACED rejects a replacement serial from a different product', async () => {
    const ticket = makeTicket({ status: 'DIAGNOSED' })
    const replacement = makeSerial({ id: 'ser-2', productId: 'prod-OTHER', status: 'AVAILABLE' })
    const db = makeMockDb({ ticket, serial: makeSerial(), replacementSerial: replacement })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateRepairTicketStatus({ id: 'rt-1', status: 'REPLACED', replacementSerialId: 'ser-2' })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RPR-012')
  })

  it('REPLACED rejects a replacement serial that is not AVAILABLE', async () => {
    const ticket = makeTicket({ status: 'DIAGNOSED' })
    const replacement = makeSerial({ id: 'ser-2', productId: 'prod-1', status: 'SOLD' })
    const db = makeMockDb({ ticket, serial: makeSerial(), replacementSerial: replacement })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateRepairTicketStatus({ id: 'rt-1', status: 'REPLACED', replacementSerialId: 'ser-2' })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RPR-013')
  })

  it('REPLACED marks the original serial DEFECTIVE, the replacement SOLD, and decrements inventory', async () => {
    const ticket = makeTicket({ status: 'DIAGNOSED' })
    const original = makeSerial({ id: 'ser-1', productId: 'prod-1', status: 'SOLD', invoiceId: 'inv-1' })
    const replacement = makeSerial({ id: 'ser-2', productId: 'prod-1', status: 'AVAILABLE' })
    const db = makeMockDb({ ticket, serial: original, replacementSerial: replacement })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateRepairTicketStatus({ id: 'rt-1', status: 'REPLACED', replacementSerialId: 'ser-2' })
    expect(res.success).toBe(true)
    expect(db.productSerial.update).toHaveBeenCalledWith({ where: { id: 'ser-1' }, data: { status: 'DEFECTIVE' } })
    // Real bug found live (2026-07-28 product-vertical audit): this claim is
    // now a conditional updateMany (matching serial.service.ts's
    // markSerialSoldTx), not a plain unconditional update — see the new
    // "atomic replacement-serial claim" describe block below for the race
    // this guards against.
    expect(db.productSerial.updateMany).toHaveBeenCalledWith({
      where: { id: 'ser-2', status: 'AVAILABLE' },
      data: expect.objectContaining({ status: 'SOLD', invoiceId: 'inv-1' })
    })
    expect(db.inventory.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { productId: 'prod-1' },
      update: { quantity: { decrement: 1 } }
    }))
  })

  // Real bug found live (2026-07-28 product-vertical audit): the replacement
  // claim used to be an unconditional update, with the only "is this serial
  // still available" check done on a stale pre-transaction read. Two
  // repair tickets picking the same in-stock replacement serial moments
  // apart could both pass that stale check, and the second to commit would
  // silently overwrite the first's invoiceId link.
  it('rejects marking REPLACED if the replacement unit was just claimed by another ticket inside the transaction', async () => {
    const ticket = makeTicket({ status: 'DIAGNOSED' })
    const original = makeSerial({ id: 'ser-1', productId: 'prod-1', status: 'SOLD', invoiceId: 'inv-1' })
    const replacement = makeSerial({ id: 'ser-2', productId: 'prod-1', status: 'AVAILABLE' })
    const db = makeMockDb({ ticket, serial: original, replacementSerial: replacement })
    db.productSerial.updateMany = vi.fn().mockResolvedValue({ count: 0 }) // another ticket claimed it first, inside the transaction
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateRepairTicketStatus({ id: 'rt-1', status: 'REPLACED', replacementSerialId: 'ser-2' })

    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RPR-016')
    expect(db.inventory.upsert).not.toHaveBeenCalled()
  })

  it('CANCELLED is not reachable from REPAIRED (already terminal-bound)', async () => {
    const ticket = makeTicket({ status: 'REPAIRED' })
    const db = makeMockDb({ ticket, serial: makeSerial() })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateRepairTicketStatus({ id: 'rt-1', status: 'CANCELLED' })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RPR-009')
  })

  it('RETURNED_TO_CUSTOMER stamps deliveredDate', async () => {
    const ticket = makeTicket({ status: 'REPAIRED' })
    const db = makeMockDb({ ticket, serial: makeSerial() })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateRepairTicketStatus({ id: 'rt-1', status: 'RETURNED_TO_CUSTOMER' })
    expect(db.repairTicket.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ deliveredDate: expect.any(Date) })
    }))
  })

  it('returns not-found for a missing ticket id', async () => {
    const db = makeMockDb({ ticket: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await updateRepairTicketStatus({ id: 'missing', status: 'DIAGNOSED' })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RPR-008')
  })
})

describe('repairTicketService.recordVendorClaim / recordVendorRecovery / writeOffVendorClaim', () => {
  it('recordVendorClaim rejects a negative amount', async () => {
    const db = makeMockDb({ ticket: makeTicket() })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await recordVendorClaim({ id: 'rt-1', amount: -50 })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RPR-017')
  })

  it('recordVendorClaim returns not-found for a missing ticket id', async () => {
    const db = makeMockDb({ ticket: null })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await recordVendorClaim({ id: 'missing', amount: 1000 })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RPR-008')
  })

  it('recordVendorClaim stamps vendorClaimAmount on the ticket', async () => {
    const ticket = makeTicket()
    const db = makeMockDb({ ticket })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await recordVendorClaim({ id: 'rt-1', amount: 1200 })
    expect(res.success).toBe(true)
    expect(db.repairTicket.update).toHaveBeenCalledWith({ where: { id: 'rt-1' }, data: { vendorClaimAmount: 1200 } })
  })

  it('recordVendorRecovery rejects a zero or negative amount', async () => {
    const db = makeMockDb({ ticket: makeTicket({ vendorClaimAmount: 1000 }) })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await recordVendorRecovery({ id: 'rt-1', amount: 0 })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RPR-019')
  })

  it('recordVendorRecovery rejects when no claim has been recorded yet', async () => {
    const db = makeMockDb({ ticket: makeTicket({ vendorClaimAmount: null }) })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await recordVendorRecovery({ id: 'rt-1', amount: 500 })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RPR-020')
  })

  it('recordVendorRecovery accumulates onto vendorRecoveredAmount without closing a partial recovery', async () => {
    const ticket = makeTicket({ vendorClaimAmount: 1000, vendorRecoveredAmount: 200 })
    const db = makeMockDb({ ticket })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await recordVendorRecovery({ id: 'rt-1', amount: 300 })
    expect(res.success).toBe(true)
    expect(db.repairTicket.update).toHaveBeenCalledWith({
      where: { id: 'rt-1' },
      data: { vendorRecoveredAmount: 500, vendorClaimClosedAt: null }
    })
  })

  it('recordVendorRecovery auto-closes the claim once fully recovered', async () => {
    const ticket = makeTicket({ vendorClaimAmount: 1000, vendorRecoveredAmount: 800 })
    const db = makeMockDb({ ticket })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await recordVendorRecovery({ id: 'rt-1', amount: 200 })
    expect(res.success).toBe(true)
    expect(db.repairTicket.update).toHaveBeenCalledWith({
      where: { id: 'rt-1' },
      data: { vendorRecoveredAmount: 1000, vendorClaimClosedAt: expect.any(Date) }
    })
  })

  it('writeOffVendorClaim rejects when no claim has been recorded yet', async () => {
    const db = makeMockDb({ ticket: makeTicket({ vendorClaimAmount: null }) })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await writeOffVendorClaim({ id: 'rt-1' })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RPR-020')
  })

  it('writeOffVendorClaim rejects an already-closed claim', async () => {
    const ticket = makeTicket({ vendorClaimAmount: 1000, vendorRecoveredAmount: 500, vendorClaimClosedAt: new Date('2026-08-01T00:00:00Z') })
    const db = makeMockDb({ ticket })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await writeOffVendorClaim({ id: 'rt-1' })
    expect(res.success).toBe(false)
    expect(res.error?.code).toBe('RPR-022')
  })

  it('writeOffVendorClaim stamps vendorClaimClosedAt without changing vendorRecoveredAmount', async () => {
    const ticket = makeTicket({ vendorClaimAmount: 1000, vendorRecoveredAmount: 300 })
    const db = makeMockDb({ ticket })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await writeOffVendorClaim({ id: 'rt-1' })
    expect(res.success).toBe(true)
    expect(db.repairTicket.update).toHaveBeenCalledWith({ where: { id: 'rt-1' }, data: { vendorClaimClosedAt: expect.any(Date) } })
  })
})
