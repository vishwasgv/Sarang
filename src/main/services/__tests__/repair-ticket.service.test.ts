import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../database/db', () => ({ getPrisma: vi.fn() }))
vi.mock('../audit.service', () => ({ logAction: vi.fn() }))

import { getPrisma } from '../../database/db'
import {
  createRepairTicket, listRepairTickets, getRepairTicket,
  getSerialServiceHistory, updateRepairTicketStatus
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
    vendorId: null, vendorRmaNumber: null, sentToVendorDate: null, vendorResponseDate: null,
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

  it('getSerialServiceHistory returns every ticket opened against that serial', async () => {
    const db = makeMockDb({ ticket: makeTicket() })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    const res = await getSerialServiceHistory('ser-1')
    expect(res.success).toBe(true)
    expect(res.data?.tickets).toHaveLength(1)
    expect(res.data?.replacedOnTicket).toBeNull()
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

  it('stamps sentToVendorDate exactly once on SENT_TO_VENDOR', async () => {
    const ticket = makeTicket({ status: 'DIAGNOSED' })
    const db = makeMockDb({ ticket, serial: makeSerial() })
    vi.mocked(getPrisma).mockReturnValue(db as never)

    await updateRepairTicketStatus({ id: 'rt-1', status: 'SENT_TO_VENDOR', vendorId: 'sup-1', vendorRmaNumber: 'VRMA-1' })
    expect(db.repairTicket.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sentToVendorDate: expect.any(Date) })
    }))
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
    expect(db.productSerial.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ser-2' },
      data: expect.objectContaining({ status: 'SOLD', invoiceId: 'inv-1' })
    }))
    expect(db.inventory.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { productId: 'prod-1' },
      update: { quantity: { decrement: 1 } }
    }))
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
